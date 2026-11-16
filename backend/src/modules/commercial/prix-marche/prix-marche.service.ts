import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, toSkipTake } from '../../../common';
import { Prisma, type TypePrix, type Unite } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { decoderTexte, ENTETE_CSV, celluleCsv, lireCsv, normaliserNom } from './prix-marche.csv';
import { QueryPrixMarcheDto } from './prix-marche.dto';
import {
  type Bareme,
  debutPeriode,
  type Observation,
  positionPrix,
  type PositionPrix,
  prixMarche,
  type PrixMarche,
  statistiques,
} from './prix-marche.rules';

/** Quotes whose prices count: the client agreed to them. */
const DEVIS_RETENUS = ['SIGNE', 'ACCEPTE'] as const;
/** Supplier orders whose prices count: really sent (not the automatic draft, not cancelled). */
const COMMANDES_EXCLUES = ['CREEE', 'ANNULEE'] as const;

type Cle = string;
const cle = (id: number, unite: Unite, type: TypePrix = 'VENTE'): Cle => `${id}:${unite}:${type}`;

/** Prices found for a set of prestations or materials, by « id:unit:VENTE|ACHAT ». */
interface Releve {
  observations: Map<Cle, Observation[]>;
  baremes: Map<Cle, Bareme>;
}

export interface LignePrixMarche {
  ligneId: number;
  vente: PrixMarche | null;
  /** Materials only: what suppliers charge */
  achat: PrixMarche | null;
  position: PositionPrix | null;
}

const pousser = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
  const l = m.get(k);
  if (l) l.push(v);
  else m.set(k, [v]);
};

/**
 * Prix de marché (29/10): ranges of the company's own prices — signed quotes for the sale price
 * of prestations and materials, supplier orders for the purchase price of materials — over the
 * period chosen in the settings (6, 12 or 24 months). An imported price list (CSV) takes over when
 * there are fewer than 3 prices. Never shown to the chef de chantier (no amounts for him).
 */
@Injectable()
export class PrixMarcheService {
  constructor(private readonly prisma: PrismaService) {}

  async periodeMois(companyId: number): Promise<number> {
    return (
      await this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { prixMarcheMois: true },
      })
    ).prixMarcheMois;
  }

  /** Every price of the period for these prestations / materials (null = all of them). */
  private async relever(
    companyId: number,
    mois: number,
    prestationIds: number[] | null,
    materiauIds: number[] | null,
  ): Promise<{ prestations: Releve; materiaux: Releve }> {
    const since = debutPeriode(mois);
    const prestations: Releve = { observations: new Map(), baremes: new Map() };
    const materiaux: Releve = { observations: new Map(), baremes: new Map() };
    const filtre = (ids: number[] | null) => (ids ? { in: ids } : { not: null });
    const vides = (ids: number[] | null) => ids !== null && ids.length === 0;

    const lignesDevis =
      vides(prestationIds) && vides(materiauIds)
        ? []
        : await this.prisma.ligneDevis.findMany({
            where: {
              OR: [
                ...(vides(prestationIds) ? [] : [{ prestationId: filtre(prestationIds) }]),
                ...(vides(materiauIds) ? [] : [{ materiauId: filtre(materiauIds) }]),
              ],
              devis: {
                companyId,
                statut: { in: [...DEVIS_RETENUS] },
                OR: [
                  { signatureClientDate: { gte: since } },
                  { signatureConseillerDate: { gte: since } },
                  { dateValidation: { gte: since } },
                  { updatedAt: { gte: since } },
                ],
              },
            },
            select: {
              prestationId: true,
              materiauId: true,
              unite: true,
              prixUnitaireVente: true,
              devis: {
                select: {
                  signatureClientDate: true,
                  signatureConseillerDate: true,
                  dateValidation: true,
                  updatedAt: true,
                },
              },
            },
          });
    for (const l of lignesDevis) {
      const date =
        l.devis.signatureClientDate ??
        l.devis.signatureConseillerDate ??
        l.devis.dateValidation ??
        l.devis.updatedAt;
      if (date < since) continue;
      const obs = { prix: l.prixUnitaireVente.toNumber(), date };
      if (l.prestationId) pousser(prestations.observations, cle(l.prestationId, l.unite), obs);
      else if (l.materiauId) pousser(materiaux.observations, cle(l.materiauId, l.unite), obs);
    }

    if (!vides(materiauIds)) {
      const achats = await this.prisma.ligneCommandeFournisseur.findMany({
        where: {
          materiauId: filtre(materiauIds),
          commandeFournisseur: {
            companyId,
            date: { gte: since },
            statutLivraison: { notIn: [...COMMANDES_EXCLUES] },
          },
        },
        select: {
          materiauId: true,
          unite: true,
          prixUnitaire: true,
          commandeFournisseur: { select: { date: true } },
        },
      });
      for (const a of achats)
        pousser(materiaux.observations, cle(a.materiauId!, a.unite, 'ACHAT'), {
          prix: a.prixUnitaire.toNumber(),
          date: a.commandeFournisseur.date,
        });
    }

    const baremes = await this.prisma.prixReference.findMany({
      where: {
        companyId,
        OR: [
          ...(vides(prestationIds) ? [] : [{ prestationId: filtre(prestationIds) }]),
          ...(vides(materiauIds) ? [] : [{ materiauId: filtre(materiauIds) }]),
        ],
      },
      select: {
        prestationId: true,
        materiauId: true,
        unite: true,
        type: true,
        prixMin: true,
        prixMax: true,
        source: true,
      },
    });
    for (const b of baremes) {
      const v = { prixMin: b.prixMin.toNumber(), prixMax: b.prixMax.toNumber(), source: b.source };
      if (b.prestationId) prestations.baremes.set(cle(b.prestationId, b.unite), v);
      else if (b.materiauId) materiaux.baremes.set(cle(b.materiauId, b.unite, b.type), v);
    }
    return { prestations, materiaux };
  }

  private calcul(r: Releve, k: Cle, source: 'DEVIS' | 'COMMANDES'): PrixMarche | null {
    return prixMarche(statistiques(r.observations.get(k) ?? []), source, r.baremes.get(k) ?? null);
  }

  /** Market price of prestations, for their catalogue unit (quote assistant, 29/10). */
  async pourPrestations(
    companyId: number,
    items: { id: number; unite: Unite }[],
  ): Promise<Map<number, PrixMarche | null>> {
    if (!items.length) return new Map();
    const mois = await this.periodeMois(companyId);
    const { prestations } = await this.relever(
      companyId,
      mois,
      items.map((i) => i.id),
      [],
    );
    return new Map(items.map((i) => [i.id, this.calcul(prestations, cle(i.id, i.unite), 'DEVIS')]));
  }

  /** « Prix de marché » page: the catalogue, a page at a time, with its market prices. */
  async liste(user: AuthUser, query: QueryPrixMarcheDto) {
    const mois = await this.periodeMois(user.companyId);
    const search = query.search?.trim();
    if ((query.type ?? 'PRESTATION') === 'PRESTATION') {
      const where: Prisma.PrestationWhereInput = {
        companyId: user.companyId,
        actif: true,
        ...(search && { nom: { contains: search, mode: 'insensitive' } }),
      };
      const [rows, total] = await Promise.all([
        this.prisma.prestation.findMany({
          where,
          orderBy: { nom: 'asc' },
          ...toSkipTake(query),
          select: {
            id: true,
            nom: true,
            unite: true,
            prixVenteMin: true,
            prixVenteMax: true,
            categorie: { select: { nom: true } },
          },
        }),
        this.prisma.prestation.count({ where }),
      ]);
      const { prestations } = await this.relever(
        user.companyId,
        mois,
        rows.map((r) => r.id),
        [],
      );
      const data = rows.map((r) => ({
        type: 'PRESTATION' as const,
        id: r.id,
        nom: r.nom,
        categorie: r.categorie.nom,
        unite: r.unite,
        catalogue: { min: r.prixVenteMin.toNumber(), max: r.prixVenteMax.toNumber() },
        vente: this.calcul(prestations, cle(r.id, r.unite), 'DEVIS'),
        achat: null,
      }));
      return { periodeMois: mois, ...paginate(data, total, query) };
    }
    const where: Prisma.MateriauWhereInput = {
      companyId: user.companyId,
      actif: true,
      ...(search && { nom: { contains: search, mode: 'insensitive' } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.materiau.findMany({
        where,
        orderBy: { nom: 'asc' },
        ...toSkipTake(query),
        select: { id: true, nom: true, unite: true, prixAchatFixe: true },
      }),
      this.prisma.materiau.count({ where }),
    ]);
    const { materiaux } = await this.relever(
      user.companyId,
      mois,
      [],
      rows.map((r) => r.id),
    );
    const data = rows.map((r) => ({
      type: 'MATERIAU' as const,
      id: r.id,
      nom: r.nom,
      categorie: null,
      unite: r.unite,
      catalogue: { min: r.prixAchatFixe.toNumber(), max: r.prixAchatFixe.toNumber() },
      vente: this.calcul(materiaux, cle(r.id, r.unite), 'DEVIS'),
      achat: this.calcul(materiaux, cle(r.id, r.unite, 'ACHAT'), 'COMMANDES'),
    }));
    return { periodeMois: mois, ...paginate(data, total, query) };
  }

  /** Quote editor: market price of each catalogue line, and where its price sits. */
  async pourDevis(
    user: AuthUser,
    devisId: number,
  ): Promise<{ periodeMois: number; lignes: LignePrixMarche[] }> {
    const devis = await this.prisma.devis.findFirst({
      where: { id: devisId, companyId: user.companyId },
      select: {
        lignes: {
          select: {
            id: true,
            prestationId: true,
            materiauId: true,
            unite: true,
            prixUnitaireVente: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException(`Devis #${devisId} introuvable`);
    const mois = await this.periodeMois(user.companyId);
    const pIds = [
      ...new Set(devis.lignes.flatMap((l) => (l.prestationId ? [l.prestationId] : []))),
    ];
    const mIds = [...new Set(devis.lignes.flatMap((l) => (l.materiauId ? [l.materiauId] : [])))];
    const { prestations, materiaux } = await this.relever(user.companyId, mois, pIds, mIds);
    const lignes = devis.lignes.flatMap((l): LignePrixMarche[] => {
      if (!l.prestationId && !l.materiauId) return [];
      const vente = l.prestationId
        ? this.calcul(prestations, cle(l.prestationId, l.unite), 'DEVIS')
        : this.calcul(materiaux, cle(l.materiauId!, l.unite), 'DEVIS');
      const achat = l.materiauId
        ? this.calcul(materiaux, cle(l.materiauId, l.unite, 'ACHAT'), 'COMMANDES')
        : null;
      return [
        {
          ligneId: l.id,
          vente,
          achat,
          position: vente ? positionPrix(l.prixUnitaireVente.toNumber(), vente) : null,
        },
      ];
    });
    return { periodeMois: mois, lignes };
  }

  // ── imported price list (CSV, Admin) ──────────────────────────────────────

  async infoBareme(user: AuthUser) {
    const [nombre, dernier] = await Promise.all([
      this.prisma.prixReference.count({ where: { companyId: user.companyId } }),
      this.prisma.prixReference.findFirst({
        where: { companyId: user.companyId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, importePar: { select: { nom: true, prenom: true } } },
      }),
    ]);
    return {
      nombre,
      importeLe: dernier?.createdAt ?? null,
      importePar: dernier?.importePar ?? null,
    };
  }

  /**
   * Replaces the whole price list. Lines are matched to the catalogue by name (case and accents
   * ignored). Nothing is changed when no line is valid.
   */
  async importer(user: AuthUser, fichier: { buffer: Buffer; size: number } | undefined) {
    if (!fichier?.buffer?.length)
      throw new BusinessException('FICHIER_MANQUANT', 'Choisissez un fichier CSV.');
    if (fichier.buffer.includes(0))
      throw new BusinessException(
        'FICHIER_TYPE_REFUSE',
        'Ce fichier n’est pas un CSV (texte). Dans Excel : Fichier → Enregistrer sous → CSV.',
      );
    const { lignes, erreurs } = lireCsv(decoderTexte(fichier.buffer));

    const [prestations, materiaux] = await Promise.all([
      this.prisma.prestation.findMany({
        where: { companyId: user.companyId },
        select: { id: true, nom: true },
      }),
      this.prisma.materiau.findMany({
        where: { companyId: user.companyId },
        select: { id: true, nom: true },
      }),
    ]);
    const index = (rows: { id: number; nom: string }[]) =>
      new Map(rows.map((r) => [normaliserNom(r.nom), r.id]));
    const parNomP = index(prestations);
    const parNomM = index(materiaux);

    const data: Prisma.PrixReferenceCreateManyInput[] = [];
    const vus = new Set<string>();
    for (const l of lignes) {
      const id = (l.type === 'PRESTATION' ? parNomP : parNomM).get(normaliserNom(l.nom));
      if (!id) {
        erreurs.push({
          ligne: l.numero,
          raison: `${l.type === 'PRESTATION' ? 'Prestation' : 'Matériau'} « ${l.nom} » introuvable dans le catalogue.`,
        });
        continue;
      }
      const k = `${l.type}:${id}:${l.unite}:${l.typePrix}`;
      if (vus.has(k)) {
        erreurs.push({
          ligne: l.numero,
          raison: `« ${l.nom} » (${l.unite}, ${l.typePrix}) apparaît deux fois : la première ligne est gardée.`,
        });
        continue;
      }
      vus.add(k);
      data.push({
        companyId: user.companyId,
        prestationId: l.type === 'PRESTATION' ? id : null,
        materiauId: l.type === 'MATERIAU' ? id : null,
        type: l.typePrix,
        unite: l.unite,
        prixMin: l.prixMin,
        prixMax: l.prixMax,
        source: l.source,
        importeParId: user.id,
      });
    }
    erreurs.sort((a, b) => a.ligne - b.ligne);
    // No valid line: the current list is kept, the errors are shown
    if (!data.length)
      return {
        importees: 0,
        ignorees: erreurs.length,
        erreurs: erreurs.slice(0, 50),
        conserve: true,
      };
    await this.prisma.$transaction([
      this.prisma.prixReference.deleteMany({ where: { companyId: user.companyId } }),
      this.prisma.prixReference.createMany({ data }),
    ]);
    return {
      importees: data.length,
      ignorees: erreurs.length,
      erreurs: erreurs.slice(0, 50),
      conserve: false,
    };
  }

  async viderBareme(user: AuthUser) {
    const { count } = await this.prisma.prixReference.deleteMany({
      where: { companyId: user.companyId },
    });
    return { supprimees: count };
  }

  /**
   * Template to fill in (or the current list to edit): every active prestation (sale price) and
   * material (purchase + sale), with the imported prices when there are some. UTF-8 with BOM and
   * « ; » so that Excel in French opens it directly.
   */
  async modeleCsv(user: AuthUser): Promise<string> {
    const [prestations, materiaux, baremes] = await Promise.all([
      this.prisma.prestation.findMany({
        where: { companyId: user.companyId, actif: true },
        orderBy: { nom: 'asc' },
        select: { id: true, nom: true, unite: true },
      }),
      this.prisma.materiau.findMany({
        where: { companyId: user.companyId, actif: true },
        orderBy: { nom: 'asc' },
        select: { id: true, nom: true, unite: true },
      }),
      this.prisma.prixReference.findMany({ where: { companyId: user.companyId } }),
    ]);
    const b = new Map(
      baremes.map((r) => [
        `${r.prestationId ? 'P' : 'M'}:${r.prestationId ?? r.materiauId}:${r.unite}:${r.type}`,
        r,
      ]),
    );
    const ligne = (
      type: string,
      nom: string,
      unite: Unite,
      tp: TypePrix,
      ref: (typeof baremes)[number] | undefined,
    ) =>
      [
        type,
        nom,
        unite,
        ref ? ref.prixMin.toNumber() : null,
        ref ? ref.prixMax.toNumber() : null,
        tp,
        ref?.source ?? null,
      ]
        .map(celluleCsv)
        .join(';');
    const out = [ENTETE_CSV.join(';')];
    for (const p of prestations)
      out.push(ligne('PRESTATION', p.nom, p.unite, 'VENTE', b.get(`P:${p.id}:${p.unite}:VENTE`)));
    for (const m of materiaux) {
      out.push(ligne('MATERIAU', m.nom, m.unite, 'ACHAT', b.get(`M:${m.id}:${m.unite}:ACHAT`)));
      out.push(ligne('MATERIAU', m.nom, m.unite, 'VENTE', b.get(`M:${m.id}:${m.unite}:VENTE`)));
    }
    return '\uFEFF' + out.join('\r\n') + '\r\n';
  }
}
