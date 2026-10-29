import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  type AuthUser,
  BusinessException,
  lineTotal,
  type Money,
  toDecimal,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DevisLignesService } from '../../commercial/devis/devis-lignes.service';
import { assertEditable } from '../../commercial/devis/devis-status';
import { PricingService } from '../../referentiel/catalogue/pricing/pricing.service';
import {
  LLM_CLIENT,
  LLM_VISION_CLIENT,
  type LlmClient,
  LlmError,
} from '../assistant/llm/llm.client';
import {
  TRANSCRIPTION_CLIENT,
  type TranscriptionClient,
} from '../assistant/llm/transcription.client';
import { AUDIO_ACCEPTE, detectAudio } from './audio-type';
import { PrixMarcheService } from '../../commercial/prix-marche/prix-marche.service';
import {
  positionPrix,
  type PositionPrix,
  type PrixMarche,
} from '../../commercial/prix-marche/prix-marche.rules';
import type { Unite } from '../../../generated/prisma/client';
import {
  type CatalogueEntry,
  extractLength,
  extractSurface,
  guessQuantity,
  scoreCatalogue,
} from './catalogue-match';
import { detectFileType } from '../../core/storage/file-type';
import type { UploadedBinary } from '../../core/storage/upload.config';
import {
  type AnalysePhoto,
  buildMessages,
  buildPhotoMessages,
  type LigneProposee,
  MAX_LIGNES,
  MAX_PHOTOS_IA,
  parseAnalysePhoto,
  parseProposition,
  PHOTO_SCHEMA,
  PROPOSITION_SCHEMA,
} from './devis-ia.prompt';
import { AppliquerDevisIaDto, ProposerDevisIaDto } from './dto/devis-ia.dto';

/** The whole catalogue is sent to the model when it is small; otherwise the best matches. */
const FULL_CATALOGUE_MAX = 200;
const CANDIDATES_MAX = 120;
/** Guided mode keeps the best keyword matches only. */
const GUIDED_MAX = 8;

export interface LignePropositionView {
  prestationId: number;
  nom: string;
  categorie: string;
  unite: string;
  quantite: number;
  /** Suggested unit price from the catalogue's pricing engine (never from the AI) */
  prixUnitaireHT: Money;
  totalHT: Money;
  justification: string;
  /** 29/10: range of the company's signed prices (or imported list) for this prestation */
  marche: PrixMarche | null;
  /** Where the catalogue price sits in that range */
  positionMarche: PositionPrix | null;
}

export interface PropositionView {
  /** false = keyword matching only (no OpenAI key, or the AI failed) */
  modeIA: boolean;
  lignes: LignePropositionView[];
  /** Described work with no matching prestation: to price by hand */
  nonCouverts: string[];
  /** What was assumed (dimensions…): to check before sending the quote */
  hypotheses: string[];
  totalHT: Money;
  avertissement: string | null;
  /** Quote from photos (C37 of 21/10): what the AI saw; null for a text description */
  analysePhoto?: AnalysePhoto | null;
}

type PropositionBrute = { lignes: LigneProposee[]; nonCouverts: string[]; hypotheses: string[] };

/** Image analysis is slower than text: up to 60 s before giving up. */
const PHOTO_TIMEOUT_MS = 60_000;
const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Step 15 — quote assistant. The technician describes the job; the assistant proposes catalogue
 * lines with quantities. Prices ALWAYS come from the pricing engine. Nothing is written until
 * the technician reviews the proposal and applies it (POST …/appliquer).
 */
@Injectable()
export class DevisIaService {
  private readonly logger = new Logger(DevisIaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly lignes: DevisLignesService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
    @Inject(LLM_VISION_CLIENT) private readonly vision: LlmClient | null,
    @Inject(TRANSCRIPTION_CLIENT) private readonly transcription: TranscriptionClient | null,
    private readonly marche: PrixMarcheService,
  ) {}

  /**
   * Devis vocal (29/10): the recording made in the browser → text, which the technician reads
   * (and corrects) in the « Texte » tab before asking for the lines. The audio is NOT stored.
   */
  async transcrire(
    user: AuthUser,
    devisId: number,
    audio: UploadedBinary | undefined,
  ): Promise<{ texte: string }> {
    const devis = await this.editableDevis(user, devisId);
    if (!audio?.buffer?.length)
      throw new BusinessException('AUDIO_MANQUANT', 'Aucun enregistrement reçu. Réessayez.');
    const type = detectAudio(audio.buffer);
    if (!type)
      throw new BusinessException(
        'FICHIER_TYPE_REFUSE',
        `Enregistrement audio non reconnu (${AUDIO_ACCEPTE}).`,
      );
    if (!this.transcription) {
      throw new BusinessException(
        'IA_NON_CONFIGUREE',
        'La transcription vocale n’est pas configurée sur le serveur (OPENAI_API_KEY). Tapez la description dans le champ texte.',
      );
    }
    let texte: string;
    try {
      texte = await this.transcription.transcrire(audio.buffer, `dictee.${type.ext}`, type.mime);
    } catch (error) {
      const kind = error instanceof LlmError ? error.type : 'LLM_INDISPONIBLE';
      await this.logError(
        user.companyId,
        `VOCAL_${kind}`,
        `Devis ${devis.reference} : ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BusinessException(
        'TRANSCRIPTION_INDISPONIBLE',
        kind === 'QUOTA'
          ? 'Trop de demandes de transcription pour le moment : réessayez dans une minute.'
          : 'La transcription n’a pas abouti. Réessayez, ou tapez la description.',
      );
    }
    if (!texte)
      throw new BusinessException(
        'AUCUNE_PAROLE',
        'Aucune parole reconnue : parlez plus près du micro et réessayez.',
      );
    return { texte };
  }

  async proposer(
    user: AuthUser,
    devisId: number,
    dto: ProposerDevisIaDto,
  ): Promise<PropositionView> {
    const devis = await this.editableDevis(user, devisId);
    const catalogue = await this.loadCatalogue(user.companyId);
    if (!catalogue.length) {
      throw new BusinessException(
        'CATALOGUE_VIDE',
        'Le catalogue ne contient aucune prestation active.',
      );
    }

    const scored = scoreCatalogue(dto.description, catalogue);
    let proposition: PropositionBrute;
    let modeIA = false;
    let avertissement: string | null = null;

    if (this.llm) {
      const candidates = pickCandidates(catalogue, scored);
      try {
        const raw = await this.llm.completeJson(
          buildMessages(dto.description, candidates),
          PROPOSITION_SCHEMA,
          { maxTokens: 1500 },
        );
        const parsed = parseProposition(raw, new Set(candidates.map((c) => c.id)));
        if (!parsed) throw new LlmError('LLM_REPONSE_INVALIDE', 'réponse hors format');
        proposition = parsed;
        modeIA = true;
      } catch (error) {
        const type = error instanceof LlmError ? error.type : 'LLM_INDISPONIBLE';
        await this.logError(
          user.companyId,
          type,
          `Devis ${devis.reference} : ${error instanceof Error ? error.message : String(error)}`,
        );
        proposition = this.guided(dto.description, scored);
        avertissement = 'L’IA n’a pas pu répondre : proposition faite par mots-clés, à vérifier.';
      }
    } else {
      proposition = this.guided(dto.description, scored);
    }

    return this.toView(user, catalogue, proposition, modeIA, avertissement);
  }

  /**
   * Quote from 1 to 3 photos (C37 of 21/10), with an optional short description. The photos go to
   * the language model and are NOT stored. A blurry photo, or the AI failing, falls back on the
   * description (keyword matching) when there is one; otherwise the technician is told to use
   * the « Texte » tab.
   */
  async proposerPhoto(
    user: AuthUser,
    devisId: number,
    description: string,
    photos: UploadedBinary[] | undefined,
  ): Promise<PropositionView> {
    const devis = await this.editableDevis(user, devisId);
    if (!photos?.length)
      throw new BusinessException('PHOTO_MANQUANTE', 'Ajoutez au moins une photo du chantier.');
    if (photos.length > MAX_PHOTOS_IA)
      throw new BusinessException('TROP_DE_PHOTOS', `${MAX_PHOTOS_IA} photos au maximum.`);
    const images = photos.map((p) => {
      const type = detectFileType(p.buffer);
      if (!type || !PHOTO_MIMES.includes(type.mime)) {
        throw new BusinessException(
          'FICHIER_TYPE_REFUSE',
          'Seules les photos sont acceptées (JPEG, PNG, WebP).',
        );
      }
      return `data:${type.mime};base64,${p.buffer.toString('base64')}`;
    });
    const vision = this.vision;
    if (!vision) {
      throw new BusinessException(
        'IA_NON_CONFIGUREE',
        'L’analyse de photos demande un modèle IA qui lit les images (OPENAI_VISION_MODEL non configuré). Utilisez l’onglet « Texte ».',
      );
    }
    const catalogue = await this.loadCatalogue(user.companyId);
    if (!catalogue.length)
      throw new BusinessException(
        'CATALOGUE_VIDE',
        'Le catalogue ne contient aucune prestation active.',
      );

    const texte = description.trim();
    const scored = scoreCatalogue(texte, catalogue);
    const candidates = pickCandidates(catalogue, scored);
    try {
      const raw = await vision.completeJson(
        buildPhotoMessages(images, texte, candidates),
        PHOTO_SCHEMA,
        { maxTokens: 1800, timeoutMs: PHOTO_TIMEOUT_MS },
      );
      const parsed = parseProposition(raw, new Set(candidates.map((c) => c.id)));
      if (!parsed) throw new LlmError('LLM_REPONSE_INVALIDE', 'réponse hors format');
      const analyse = parseAnalysePhoto(raw);

      const hypotheses = [...parsed.hypotheses];
      if (analyse.surfaceEstimeeM2 !== null) {
        hypotheses.unshift(
          `Surface estimée sur photo ≈ ${String(analyse.surfaceEstimeeM2).replace('.', ',')} m² — ${analyse.objetReference ? 'approximative' : 'très approximative (aucun objet de référence)'}, à mesurer sur place.`,
        );
      }
      let avertissement: string | null = null;
      if (analyse.qualitePhoto === 'INSUFFISANTE') {
        avertissement =
          texte.length >= 10
            ? 'Photo peu exploitable (floue, sombre ou trop serrée) : proposition complétée à partir de votre description, à vérifier.'
            : 'Photo peu exploitable (floue, sombre ou trop serrée) : reprenez-la ou décrivez les travaux dans l’onglet « Texte ».';
        if (texte.length >= 10 && !parsed.lignes.length) {
          const guided = this.guided(texte, scored);
          return this.toView(
            user,
            catalogue,
            { ...guided, hypotheses: [...hypotheses, ...guided.hypotheses] },
            false,
            avertissement,
            analyse,
          );
        }
      }
      return this.toView(user, catalogue, { ...parsed, hypotheses }, true, avertissement, analyse);
    } catch (error) {
      const type = error instanceof LlmError ? error.type : 'LLM_INDISPONIBLE';
      await this.logError(
        user.companyId,
        `PHOTO_${type}`,
        `Devis ${devis.reference} : ${error instanceof Error ? error.message : String(error)}`,
      );
      if (texte.length >= 10) {
        return this.toView(
          user,
          catalogue,
          this.guided(texte, scored),
          false,
          'L’IA n’a pas pu analyser les photos : proposition faite à partir de votre description, par mots-clés.',
          null,
        );
      }
      throw new BusinessException(
        'IA_PHOTO_INDISPONIBLE',
        'L’IA n’a pas pu analyser les photos. Réessayez dans un instant ou décrivez les travaux dans l’onglet « Texte ».',
      );
    }
  }

  /** Prices every proposed line with the catalogue's pricing engine (never the AI). */
  private async toView(
    user: AuthUser,
    catalogue: CatalogueEntry[],
    proposition: PropositionBrute,
    modeIA: boolean,
    avertissement: string | null,
    analysePhoto: AnalysePhoto | null = null,
  ): Promise<PropositionView> {
    const byId = new Map(catalogue.map((c) => [c.id, c]));
    const lignes: LignePropositionView[] = [];
    // 29/10: market price shown next to the catalogue price (a failure never blocks the proposal)
    const marches = await this.marche
      .pourPrestations(
        user.companyId,
        proposition.lignes.map((l) => ({
          id: l.prestationId,
          unite: byId.get(l.prestationId)!.unite as Unite,
        })),
      )
      .catch(() => new Map<number, PrixMarche | null>());
    for (const l of proposition.lignes) {
      const entry = byId.get(l.prestationId)!;
      const prix = await this.unitPrice(user, l.prestationId);
      if (!prix) continue; // prestation that cannot be priced (inactive meanwhile…): skipped
      const marche = marches.get(entry.id) ?? null;
      lignes.push({
        marche,
        positionMarche: marche ? positionPrix(toDecimal(prix).toNumber(), marche) : null,
        prestationId: entry.id,
        nom: entry.nom,
        categorie: entry.sousCategorie
          ? `${entry.categorie} › ${entry.sousCategorie}`
          : entry.categorie,
        unite: entry.unite,
        quantite: l.quantite,
        prixUnitaireHT: prix,
        totalHT: lineTotal(prix, l.quantite),
        justification: l.justification,
      });
    }

    const hypotheses = [...proposition.hypotheses];
    if (!lignes.length)
      hypotheses.push(
        'Aucune prestation du catalogue ne correspond : précisez la description ou ajoutez les lignes à la main.',
      );

    return {
      modeIA,
      lignes,
      nonCouverts: proposition.nonCouverts,
      hypotheses,
      totalHT: lignes.reduce((sum, l) => sum.plus(l.totalHT), toDecimal(0)),
      avertissement,
      analysePhoto,
    };
  }

  /** Adds the lines the technician kept, all at once (one transaction). Returns the quote. */
  async appliquer(user: AuthUser, devisId: number, dto: AppliquerDevisIaDto) {
    await this.editableDevis(user, devisId);
    return this.lignes.addMany(
      user,
      devisId,
      dto.lignes.map((l) => ({ prestationId: l.prestationId, quantite: l.quantite })),
    );
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Keyword matching only: the best prestations, quantities from the surface / length written. */
  private guided(description: string, scored: ReturnType<typeof scoreCatalogue>) {
    const best = scored[0]?.score ?? 0;
    const kept = scored
      .filter((e) => e.score >= Math.max(3, best / 2))
      .slice(0, Math.min(GUIDED_MAX, MAX_LIGNES));
    const surface = extractSurface(description);
    const longueur = extractLength(description);

    const hypotheses = [
      'Mode sans IA : prestations trouvées par mots-clés. Retirez celles qui ne conviennent pas.',
    ];
    if (kept.some((e) => e.unite === 'M2') && !surface)
      hypotheses.push('Aucune surface (m²) dans la description : quantités en m² mises à 1.');
    if (kept.some((e) => e.unite === 'ML') && !longueur)
      hypotheses.push('Aucune longueur (ml) dans la description : quantités en ml mises à 1.');

    return {
      lignes: kept.map((e) => ({
        prestationId: e.id,
        quantite: guessQuantity(e.unite, surface, longueur),
        justification: `Mots-clés : ${e.nom}`,
      })),
      nonCouverts: [] as string[],
      hypotheses,
    };
  }

  private async editableDevis(user: AuthUser, devisId: number) {
    const devis = await this.prisma.devis.findFirst({
      where: { id: devisId, companyId: user.companyId },
      select: { id: true, reference: true, statut: true },
    });
    if (!devis) throw new NotFoundException(`Devis #${devisId} introuvable`);
    assertEditable(devis.statut);
    return devis;
  }

  private async loadCatalogue(companyId: number): Promise<CatalogueEntry[]> {
    const rows = await this.prisma.prestation.findMany({
      where: { companyId, actif: true, categorie: { actif: true } },
      select: {
        id: true,
        nom: true,
        description: true,
        unite: true,
        categorie: { select: { nom: true } },
        sousCategorie: { select: { nom: true } },
      },
      orderBy: [{ categorieId: 'asc' }, { nom: 'asc' }],
      take: 3000,
    });
    return rows.map((r) => ({
      id: r.id,
      nom: r.nom,
      description: r.description,
      unite: r.unite,
      categorie: r.categorie.nom,
      sousCategorie: r.sousCategorie?.nom ?? null,
    }));
  }

  /** Suggested unit price, exactly like a catalogue line added by hand (no options chosen). */
  private async unitPrice(user: AuthUser, prestationId: number): Promise<Money | null> {
    try {
      const { result } = await this.pricing.price(user, prestationId, {
        quantite: 1,
        choixIds: [],
      });
      return result.prixVenteSuggereUnite;
    } catch {
      return null;
    }
  }

  /** AI errors are logged with the chatbot's (page Assistant IA → Journal). Never the prompt. */
  private async logError(companyId: number, type: string, detail: string) {
    this.logger.warn(`Devis IA — ${type}: ${detail}`);
    await this.prisma.assistantErreur
      .create({ data: { companyId, type: `DEVIS_${type}`, detail: detail.slice(0, 500) } })
      .catch(() => undefined);
  }
}

/**
 * What the model may choose from. Small catalogue: all of it (the model understands synonyms
 * that keyword matching misses). Large catalogue: best keyword matches first, completed with the
 * rest up to the limit — never an empty list, even when no keyword matches.
 */
function pickCandidates(catalogue: CatalogueEntry[], scored: CatalogueEntry[]): CatalogueEntry[] {
  if (catalogue.length <= FULL_CATALOGUE_MAX) return catalogue;
  const chosen = new Map(scored.slice(0, CANDIDATES_MAX).map((e) => [e.id, e]));
  for (const e of catalogue) {
    if (chosen.size >= CANDIDATES_MAX) break;
    if (!chosen.has(e.id)) chosen.set(e.id, e);
  }
  return [...chosen.values()];
}
