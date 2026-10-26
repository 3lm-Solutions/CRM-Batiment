import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException, paginate, ReferencePrefix, ReferenceService, toSkipTake } from '../../../common';
import { FactureStatut, FactureType, Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { MailService } from '../../core/mail/mail.service';
import { factureMail } from '../../core/mail/templates/finance.templates';
import { AnnulerFactureDto, CreateSituationDto, EmettreFactureDto, FactureLigneDto, PayerFactureDto, QueryFacturesDto, UpdateFactureDto } from './dto/factures.dto';
import { type FactureEvent, FactureEvents } from './facture.events';
import { acompteHT, buildLine, finaleHT, type InvoiceLine, invoiceTotals, negate, situationAmounts } from './facture.calculator';
import { FactureMachine } from './facture-status';
import { completerQrFacture, FACTURE_CLIENT_SELECT, newPublicToken } from './facture.views';

const ISSUED: FactureStatut[] = ['ENVOYEE', 'PAYEE'];

const INCLUDE = {
  lignes: { orderBy: { ordre: 'asc' } },
  devis: { select: { id: true, reference: true, totalHT: true, client: { select: { id: true, nom: true, prenom: true } } } },
  factureOrigine: { select: { id: true, reference: true } },
  avoirs: { select: { id: true, reference: true, montantTTC: true } },
} satisfies Prisma.FactureInclude;

const TYPE_LABEL: Record<FactureType, string> = {
  ACOMPTE: "Facture d'acompte",
  SITUATION: 'Situation de travaux',
  FINALE: 'Facture',
  AVOIR: 'Avoir',
};

/** The quote fields an invoice needs. */
interface DevisForInvoice {
  id: number;
  companyId: number;
  reference: string;
  statut: string;
  totalHT: Prisma.Decimal;
  tauxTVA: Prisma.Decimal;
}

@Injectable()
export class FacturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly mail: MailService,
    private readonly events: EventEmitter2,
  ) {}

  // ── creation ────────────────────────────────────────────────────────────

  /**
   * P0.3 — deposit invoice (BROUILLON) from a signed quote, inside the signing transaction.
   * Idempotent: a quote that already has a non-cancelled deposit creates nothing.
   */
  async createAcompte(tx: DbClient, devis: DevisForInvoice): Promise<number | null> {
    const existing = await tx.facture.findFirst({
      where: { devisId: devis.id, typeFacture: 'ACOMPTE', statut: { not: 'ANNULEE' } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const { acomptePercentDefault: percent } = await tx.company.findUniqueOrThrow({
      where: { id: devis.companyId },
      select: { acomptePercentDefault: true },
    });
    if (percent.lte(0)) return null;

    const line = buildLine({
      description: `Acompte de ${percent.toString()} % sur le devis ${devis.reference}`,
      quantite: 1,
      unite: 'FORFAIT',
      prixUnitaireHT: acompteHT(devis.totalHT, percent),
      tauxTVA: devis.tauxTVA,
    });
    const facture = await this.createDraft(tx, devis, 'ACOMPTE', [line], { acomptePercent: percent, acompteMontant: line.montantHT });
    return facture.id;
  }

  async creerSituation(user: AuthUser, devisId: number, dto: CreateSituationDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      const devis = await this.getSignedDevis(tx, user, devisId);
      const factures = await tx.facture.findMany({ where: { devisId, statut: { not: 'ANNULEE' } } });

      if (factures.some((f) => f.typeFacture === 'FINALE')) {
        throw new BusinessException('FINALE_EXISTANTE', 'La facture finale existe déjà.');
      }
      const situations = factures.filter((f) => f.typeFacture === 'SITUATION');
      if (situations.some((f) => f.statut === 'BROUILLON')) {
        throw new BusinessException('SITUATION_EN_COURS', 'Émettez ou annulez d’abord la situation en brouillon.');
      }
      // The deposit is repaid on progress invoices: it must be issued (or cancelled) first
      const acomptes = factures.filter((f) => f.typeFacture === 'ACOMPTE');
      if (acomptes.some((f) => f.statut === 'BROUILLON')) {
        throw new BusinessException(
          'ACOMPTE_EN_BROUILLON',
          'La facture d’acompte est encore en brouillon : émettez-la ou annulez-la avant une situation de travaux.',
        );
      }
      const dernier = Math.max(0, ...situations.map((s) => s.avancementCumule?.toNumber() ?? 0));
      if (dto.avancementCumule <= dernier) {
        throw new BusinessException('AVANCEMENT_INVALIDE', `L’avancement cumulé doit dépasser ${dernier} %.`);
      }

      const numero = situations.length + 1;
      const acomptesEmis = acomptes.filter((f) => ISSUED.includes(f.statut));
      const montants = situationAmounts({
        devisHT: devis.totalHT,
        acomptesHT: acomptesEmis.map((f) => f.montantHT),
        avancementPrecedent: dernier,
        avancementCumule: dto.avancementCumule,
        situationsDejaHT: situations.map((s) => s.montantHT),
      });
      const lines: InvoiceLine[] = [
        buildLine({
          description: `Situation n°${numero} — avancement cumulé ${dto.avancementCumule} % du devis ${devis.reference} (travaux de ${dernier} % à ${dto.avancementCumule} %)`,
          quantite: 1,
          unite: 'FORFAIT',
          prixUnitaireHT: montants.brutHT,
          tauxTVA: devis.tauxTVA,
        }),
      ];
      if (montants.remboursementAcompteHT.gt(0)) {
        lines.push(
          buildLine({
            description: `Remboursement de l’acompte ${acomptesEmis.map((f) => f.reference).filter(Boolean).join(', ')} au prorata de l’avancement`,
            quantite: 1,
            unite: 'FORFAIT',
            prixUnitaireHT: montants.remboursementAcompteHT.negated(),
            tauxTVA: devis.tauxTVA,
          }),
        );
      }
      return (await this.createDraft(tx, devis, 'SITUATION', lines, { numeroSituation: numero, avancementCumule: dto.avancementCumule })).id;
    });
    return this.findOne(user, id);
  }

  /** Final invoice: every quote line, minus each deposit and progress invoice already issued. */
  async creerFinale(user: AuthUser, devisId: number) {
    const id = await this.prisma.$transaction(async (tx) => {
      const devis = await this.getSignedDevis(tx, user, devisId);
      const factures = await tx.facture.findMany({ where: { devisId, statut: { not: 'ANNULEE' } } });

      if (factures.some((f) => f.typeFacture === 'FINALE')) {
        throw new BusinessException('FINALE_EXISTANTE', 'La facture finale existe déjà pour ce devis.');
      }
      const anterieures = factures.filter((f) => f.typeFacture === 'ACOMPTE' || f.typeFacture === 'SITUATION');
      if (anterieures.some((f) => f.statut === 'BROUILLON')) {
        throw new BusinessException(
          'FACTURE_EN_BROUILLON',
          'Un acompte ou une situation est encore en brouillon : émettez-le ou annulez-le avant la facture finale.',
        );
      }

      const lignesDevis = await tx.ligneDevis.findMany({ where: { devisId }, orderBy: { ordre: 'asc' } });
      const lines: InvoiceLine[] = lignesDevis.map((l) =>
        buildLine({
          description: l.description ?? 'Prestation',
          quantite: l.quantite,
          unite: l.unite,
          prixUnitaireHT: l.prixUnitaireVente,
          tauxTVA: devis.tauxTVA,
        }),
      );
      for (const f of anterieures.filter((f) => ISSUED.includes(f.statut))) {
        lines.push(
          buildLine({
            description: `Déduction ${TYPE_LABEL[f.typeFacture].toLowerCase()} ${f.reference}`,
            quantite: 1,
            unite: 'FORFAIT',
            prixUnitaireHT: f.montantHT.negated(),
            tauxTVA: devis.tauxTVA,
          }),
        );
      }
      // Guard: never bill more than the quote
      finaleHT(devis.totalHT, anterieures.filter((f) => ISSUED.includes(f.statut)).map((f) => f.montantHT));
      return (await this.createDraft(tx, devis, 'FINALE', lines)).id;
    });
    return this.findOne(user, id);
  }

  // ── read ────────────────────────────────────────────────────────────────

  async findAll(user: AuthUser, query: QueryFacturesDto) {
    // The role scope (e.g. a chef's own job sites) is ANDed with the filters: a filter or a
    // search can narrow it but never replace it (a spread let `chefChantierId: undefined`
    // or a search `OR` silently override the scope).
    const where: Prisma.FactureWhereInput = {
      AND: [
        this.scope(user),
        {
          statut: query.statuts?.length ? { in: query.statuts } : undefined,
          typeFacture: query.type,
          devisId: query.devisId,
          ...(query.search && {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { referenceDevis: { contains: query.search, mode: 'insensitive' } },
              { devis: { client: { nom: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }),
        },
      ],
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.facture.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { devis: { select: { id: true, reference: true, client: { select: { id: true, nom: true, prenom: true } } } } },
        ...toSkipTake(query),
      }),
      this.prisma.facture.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const facture = await this.prisma.facture.findFirst({ where: { id, ...this.scope(user) }, include: INCLUDE });
    if (!facture) throw new NotFoundException(`Facture #${id} introuvable`);
    if (await completerQrFacture(this.prisma, facture)) return this.prisma.facture.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    return facture;
  }

  /** « View this invoice » link / QR code: the issued invoice, read only, without an account (21/10). */
  async findPublic(token: string) {
    if (!token || token.length > 100) throw new NotFoundException('Facture introuvable');
    const facture = await this.prisma.facture.findFirst({
      where: { lienPublicToken: token, statut: { in: ['ENVOYEE', 'PAYEE', 'ANNULEE'] }, reference: { not: null } },
      select: { ...FACTURE_CLIENT_SELECT, company: { select: { logo: true } } },
    });
    if (!facture) throw new NotFoundException('Facture introuvable');
    const { company, ...rest } = facture;
    return { ...rest, logo: company.logo };
  }

  // ── draft edition ───────────────────────────────────────────────────────

  async update(user: AuthUser, id: number, dto: UpdateFactureDto) {
    await this.getDraft(user, id);
    await this.prisma.facture.update({ where: { id }, data: dto });
    return this.findOne(user, id);
  }

  async addLigne(user: AuthUser, id: number, dto: FactureLigneDto) {
    await this.prisma.$transaction(async (tx) => {
      const facture = await this.getDraft(user, id, tx);
      const ordre = await tx.factureLigne.count({ where: { factureId: id } });
      await tx.factureLigne.create({ data: { ...buildLine({ ...dto, tauxTVA: facture.tauxTVA }), factureId: id, ordre } });
      await this.recalculate(tx, id);
    });
    return this.findOne(user, id);
  }

  async updateLigne(user: AuthUser, id: number, ligneId: number, dto: FactureLigneDto) {
    await this.prisma.$transaction(async (tx) => {
      const facture = await this.getDraft(user, id, tx);
      const { count } = await tx.factureLigne.updateMany({
        where: { id: ligneId, factureId: id },
        data: buildLine({ ...dto, tauxTVA: facture.tauxTVA }),
      });
      if (!count) throw new NotFoundException(`Ligne #${ligneId} introuvable`);
      await this.recalculate(tx, id);
    });
    return this.findOne(user, id);
  }

  async removeLigne(user: AuthUser, id: number, ligneId: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.getDraft(user, id, tx);
      const { count } = await tx.factureLigne.deleteMany({ where: { id: ligneId, factureId: id } });
      if (!count) throw new NotFoundException(`Ligne #${ligneId} introuvable`);
      await this.recalculate(tx, id);
    });
    return this.findOne(user, id);
  }

  async removeDraft(user: AuthUser, id: number): Promise<void> {
    await this.getDraft(user, id);
    await this.prisma.facture.delete({ where: { id } });
  }

  // ── lifecycle ───────────────────────────────────────────────────────────

  /**
   * BROUILLON → ENVOYEE: the invoice gets its number NOW (continuous numbering of issued
   * invoices), client and company details are frozen, and it can no longer be edited.
   */
  async emettre(user: AuthUser, id: number, dto: EmettreFactureDto) {
    await this.prisma.$transaction(async (tx) => {
      const facture = await this.getDraft(user, id, tx);
      if (facture.montantHT.isZero()) throw new BusinessException('FACTURE_VIDE', 'Une facture à 0 € ne peut pas être émise.');
      await this.issue(tx, facture.id, facture.statut, facture.companyId, facture.dateEcheance);
    });
    const facture = await this.findOne(user, id);
    this.emit(FactureEvents.EMISE, user, facture);
    const emailSent = dto.envoyerEmail === false ? false : await this.envoyerEmail(user, id);
    // Re-read when the email went out: the answer then carries « envoyée le … »
    return { facture: emailSent ? await this.findOne(user, id) : facture, emailSent };
  }

  /** Email the client (again) about an issued invoice. */
  async envoyerEmail(user: AuthUser, id: number): Promise<boolean> {
    const facture = await this.findOne(user, id);
    if (!ISSUED.includes(facture.statut) || !facture.reference) {
      throw new BusinessException('FACTURE_NON_EMISE', 'Seule une facture émise peut être envoyée.');
    }
    if (!facture.emailClient) return false;
    const sent = await this.mail.send(
      facture.emailClient,
      factureMail({
        clientNom: [facture.prenomClient, facture.nomClient].filter(Boolean).join(' '),
        entreprise: facture.companyNom ?? '',
        reference: facture.reference,
        type: TYPE_LABEL[facture.typeFacture],
        montantTTC: facture.montantTTC.toNumber(),
        dateEcheance: facture.dateEcheance,
      }),
    );
    // Shown on the invoice (« Envoyée le … à … »): was never recorded before 20/10 (bug B1)
    if (sent) {
      await this.prisma.facture.update({ where: { id }, data: { dateEnvoiClient: new Date(), emailEnvoiClient: facture.emailClient } });
    }
    return sent;
  }

  async marquerPayee(user: AuthUser, id: number, dto: PayerFactureDto) {
    const facture = await this.findOne(user, id);
    if (facture.typeFacture === 'AVOIR') throw new BusinessException('AVOIR', 'Un avoir ne se « paie » pas.');
    await this.transition(this.prisma, facture, 'PAYEE', {
      datePaiement: dto.datePaiement ? new Date(dto.datePaiement) : new Date(),
      referencePaiement: dto.referencePaiement,
    });
    const payee = await this.findOne(user, id);
    this.emit(FactureEvents.PAYEE, user, payee);
    return payee;
  }

  /**
   * Draft → cancelled (no number was used). Issued → a credit note (AVOIR) is issued with
   * its own number and the invoice becomes ANNULEE. A paid invoice needs a refund first.
   */
  async annuler(user: AuthUser, id: number, dto: AnnulerFactureDto) {
    const avoirId = await this.prisma.$transaction(async (tx) => {
      const facture = await tx.facture.findFirst({ where: { id, companyId: user.companyId }, include: { lignes: true } });
      if (!facture) throw new NotFoundException(`Facture #${id} introuvable`);
      if (facture.typeFacture === 'AVOIR') throw new BusinessException('AVOIR', 'Un avoir ne s’annule pas.');

      if (facture.statut === 'BROUILLON') {
        await this.transition(tx, facture, 'ANNULEE');
        return null;
      }
      FactureMachine.assert(facture.statut, 'ANNULEE');

      const devis = await tx.devis.findUniqueOrThrow({ where: { id: facture.devisId } });
      const lines = facture.lignes.map((l) =>
        negate(buildLine({ description: l.description, quantite: l.quantite, unite: l.unite, prixUnitaireHT: l.prixUnitaireHT, tauxTVA: l.tauxTVA })),
      );
      const avoir = await this.createDraft(tx, devis, 'AVOIR', lines, {
        factureOrigineId: facture.id,
        notesLegales: `Avoir annulant la facture ${facture.reference}${dto.motif ? ` — ${dto.motif}` : ''}`,
      });
      await this.issue(tx, avoir.id, 'BROUILLON', facture.companyId, null);
      await this.transition(tx, facture, 'ANNULEE');
      return avoir.id;
    });
    const facture = await this.findOne(user, id);
    this.emit(FactureEvents.ANNULEE, user, facture);
    return { facture, avoir: avoirId ? await this.findOne(user, avoirId) : null };
  }

  // ── internals ───────────────────────────────────────────────────────────

  private emit(
    event: string,
    user: AuthUser,
    f: { id: number; companyId: number; reference: string | null; typeFacture: FactureType; montantTTC: Prisma.Decimal },
  ) {
    this.events.emit(event, {
      companyId: f.companyId,
      factureId: f.id,
      reference: f.reference,
      type: f.typeFacture,
      montantTTC: f.montantTTC.toNumber(),
      userId: user.id,
    } satisfies FactureEvent);
  }

  private async createDraft(
    tx: DbClient,
    devis: DevisForInvoice,
    type: FactureType,
    lines: InvoiceLine[],
    extra: Partial<Prisma.FactureUncheckedCreateInput> = {},
  ) {
    return tx.facture.create({
      data: {
        companyId: devis.companyId,
        devisId: devis.id,
        referenceDevis: devis.reference,
        typeFacture: type,
        tauxTVA: devis.tauxTVA,
        ...invoiceTotals(lines, devis.tauxTVA),
        ...extra,
        lignes: { create: lines.map((l, ordre) => ({ ...l, ordre })) },
      },
    });
  }

  private async issue(tx: DbClient, id: number, from: FactureStatut, companyId: number, dateEcheance: Date | null) {
    const facture = await tx.facture.findUniqueOrThrow({
      where: { id },
      include: { devis: { include: { client: true, company: true } } },
    });
    const { client, company } = facture.devis;
    const now = new Date();
    await this.transition(tx, { id, statut: from }, 'ENVOYEE', {
      reference: await this.references.next(ReferencePrefix.FACTURE, companyId, tx),
      dateEmission: now,
      date: now,
      dateEcheance: dateEcheance ?? new Date(now.getTime() + 30 * 86_400_000),
      // Legal snapshot: an issued invoice must not change if the client or company is edited later
      nomClient: client.nom,
      prenomClient: client.prenom,
      emailClient: client.email,
      telephoneClient: client.telephone,
      adresseClient: client.adresseClient ?? client.adresseChantier,
      companyNom: company.nom,
      companyEmail: company.email,
      companyTelephone: company.telephone,
      companyAdresse: company.adresse,
      companySiret: company.siret,
      // Payment QR code (SEPA EPC) and « view online » QR code — 21/10
      companyIban: company.iban,
      companyBic: company.bic,
      lienPublicToken: newPublicToken(),
    });
  }

  private async transition(
    db: DbClient,
    facture: { id: number; statut: FactureStatut },
    to: FactureStatut,
    data: Prisma.FactureUpdateManyMutationInput = {},
  ) {
    FactureMachine.assert(facture.statut, to);
    const { count } = await db.facture.updateMany({ where: { id: facture.id, statut: facture.statut }, data: { ...data, statut: to } });
    if (!count) throw new BusinessException('FACTURE_MODIFIEE', 'La facture vient de changer de statut. Rechargez.');
  }

  private async recalculate(db: DbClient, factureId: number) {
    const facture = await db.facture.findUniqueOrThrow({ where: { id: factureId }, include: { lignes: true } });
    await db.facture.update({ where: { id: factureId }, data: invoiceTotals(facture.lignes, facture.tauxTVA) });
  }

  private async getDraft(user: AuthUser, id: number, db: DbClient = this.prisma) {
    const facture = await db.facture.findFirst({ where: { id, companyId: user.companyId } });
    if (!facture) throw new NotFoundException(`Facture #${id} introuvable`);
    if (facture.statut !== 'BROUILLON') {
      throw new BusinessException('FACTURE_EMISE', 'Une facture émise ne se modifie plus : annulez-la (avoir) si nécessaire.');
    }
    return facture;
  }

  private async getSignedDevis(db: DbClient, user: AuthUser, devisId: number) {
    const devis = await db.devis.findFirst({ where: { id: devisId, companyId: user.companyId } });
    if (!devis) throw new NotFoundException(`Devis #${devisId} introuvable`);
    if (devis.statut !== 'SIGNE') throw new BusinessException('DEVIS_NON_SIGNE', 'Seul un devis signé se facture.');
    return devis;
  }

  /**
   * Chef de chantier: ISSUED invoices of his job sites, read only (decision C2 of 20/10:
   * drafts are office work in progress and stay invisible to him).
   */
  private scope(user: AuthUser): Prisma.FactureWhereInput {
    return user.role === Role.CHEF_CHANTIER
      ? { companyId: user.companyId, statut: { not: 'BROUILLON' }, devis: { chantier: { chefChantierId: user.id } } }
      : { companyId: user.companyId };
  }
}
