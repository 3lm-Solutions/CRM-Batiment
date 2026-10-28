import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, ReferencePrefix, ReferenceService, toSkipTake } from '../../../common';
import type { Prisma, ProspectStatut } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { QualifierProspectDto, QueryProspectsDto, UpdateProspectDto } from './dto/assistant.dto';
import { ProspectDedupService } from './prospect-dedup.service';
import { isComplete, normalizeEmail, normalizePhone } from './prospect-fields';
import { ProspectMachine } from './prospect-status';
import { promouvoirClient } from '../../referentiel/clients/client-statut';

const LIST_SELECT = {
  id: true,
  statut: true,
  source: true,
  emailSujet: true,
  clientNom: true,
  clientPrenom: true,
  clientEmail: true,
  clientTelephone: true,
  adresse: true,
  typeProjet: true,
  description: true,
  delai: true,
  clientId: true,
  doublonDeId: true,
  demandeDevisId: true,
  derniereActivite: true,
  createdAt: true,
  _count: { select: { messages: true } },
} satisfies Prisma.ChatSessionSelect;

/**
 * Back-office of the chatbot (spec P1): prospects coming from the chatbot, qualification by the
 * sales team into a DemandeDevis (normal pipeline), rejection with a reason.
 */
@Injectable()
export class ProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly dedup: ProspectDedupService,
  ) {}

  async findAll(user: AuthUser, query: QueryProspectsDto) {
    const where: Prisma.ChatSessionWhereInput = {
      companyId: user.companyId,
      statut: query.statuts?.length ? { in: query.statuts } : undefined,
      source: query.source,
      // Empty conversations (visitor said nothing) are noise
      messages: { some: { role: 'user' } },
      ...(query.search && {
        OR: [
          { clientNom: { contains: query.search, mode: 'insensitive' } },
          { clientEmail: { contains: query.search, mode: 'insensitive' } },
          { clientTelephone: { contains: query.search } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { emailSujet: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.chatSession.findMany({ where, select: LIST_SELECT, orderBy: { derniereActivite: 'desc' }, ...toSkipTake(query) }),
      this.prisma.chatSession.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const p = await this.prisma.chatSession.findFirst({
      where: { id, companyId: user.companyId },
      select: {
        ...LIST_SELECT,
        notesInternes: true,
        motifRejet: true,
        traiteLe: true,
        traitePar: { select: { id: true, nom: true, prenom: true } },
        client: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
        demandeDevis: { select: { id: true, reference: true, statut: true } },
        doublonDe: { select: { id: true, clientNom: true, statut: true, createdAt: true } },
        messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, contenu: true, createdAt: true } },
        feedbacks: { select: { rating: true, commentaire: true, createdAt: true } },
      },
    });
    if (!p) throw new NotFoundException(`Prospect #${id} introuvable`);
    return p;
  }

  /** The sales team completes or corrects the details before qualifying. */
  async update(user: AuthUser, id: number, dto: UpdateProspectDto) {
    const p = await this.findOne(user, id);
    if (p.statut === 'QUALIFIE') throw new BusinessException('PROSPECT_QUALIFIE', 'Prospect déjà transformé : modifiez la demande de devis.');
    const email = dto.clientEmail === undefined ? undefined : dto.clientEmail === null ? null : normalizeEmail(dto.clientEmail);
    const tel = dto.clientTelephone === undefined ? undefined : dto.clientTelephone === null ? null : normalizePhone(dto.clientTelephone);
    if (dto.clientEmail && !email) throw new BusinessException('EMAIL_INVALIDE', 'Email invalide.');
    if (dto.clientTelephone && !tel) throw new BusinessException('TELEPHONE_INVALIDE', 'Numéro de téléphone invalide.');
    await this.prisma.chatSession.update({ where: { id }, data: { ...dto, clientEmail: email, clientTelephone: tel } });
    return this.findOne(user, id);
  }

  /**
   * Prospect → DemandeDevis (source CHATBOT), in one transaction. The client is: the one given,
   * else the one found by email/phone (no duplicate), else created from the conversation.
   */
  async qualifier(user: AuthUser, id: number, dto: QualifierProspectDto) {
    const p = await this.findOne(user, id);
    ProspectMachine.assert(p.statut, 'QUALIFIE');
    const fields = { nom: p.clientNom, email: p.clientEmail, telephone: p.clientTelephone, description: p.description };
    if (!isComplete(fields)) {
      throw new BusinessException('PROSPECT_INCOMPLET', 'Complétez le nom, un moyen de contact et la description avant de qualifier.');
    }

    const demande = await this.prisma.$transaction(async (tx) => {
      let clientId = dto.clientId ?? p.clientId ?? null;
      if (dto.clientId) {
        const ok = await tx.client.count({ where: { id: dto.clientId, companyId: user.companyId, archivedAt: null } });
        if (!ok) throw new BusinessException('CLIENT_INTROUVABLE', `Client #${dto.clientId} introuvable.`);
      }
      clientId ??= (await this.dedup.findClient(user.companyId, p.clientEmail, p.clientTelephone, tx))?.id ?? null;
      if (!clientId) {
        const type = p.typeProjet
          ? await tx.typeProjet.findFirst({ where: { companyId: user.companyId, nom: p.typeProjet }, select: { id: true } })
          : null;
        const client = await tx.client.create({
          data: {
            companyId: user.companyId,
            nom: p.clientNom!,
            prenom: p.clientPrenom,
            email: p.clientEmail,
            telephone: p.clientTelephone,
            adresseChantier: p.adresse,
            // CHATBOT or EMAIL (the prospect's real origin)
            source: p.source,
            // 27/10: a qualified chatbot / email prospect is a qualified prospect
            statut: 'QUALIFIE',
            besoin: p.description,
            ...(type && { typeProjetLinks: { create: { typeProjetId: type.id } } }),
          },
        });
        clientId = client.id;
      } else {
        await promouvoirClient(tx, clientId, 'QUALIFIE');
      }
      const created = await tx.demandeDevis.create({
        data: {
          companyId: user.companyId,
          clientId,
          createurId: user.id,
          // CHATBOT or EMAIL (22/10): the request keeps where the prospect came from
          source: p.source,
          description: p.description!,
          besoinStructure: { typeProjet: p.typeProjet, delai: p.delai, adresse: p.adresse, conversationId: p.id } as Prisma.InputJsonValue,
          reference: await this.references.next(ReferencePrefix.DEMANDE, user.companyId, tx),
        },
        select: { id: true, reference: true },
      });
      // Conditional: two people qualifying at once → only one demande
      const { count } = await tx.chatSession.updateMany({
        where: { id, statut: { in: ProspectMachine.sources('QUALIFIE') } },
        data: { statut: 'QUALIFIE', clientId, demandeDevisId: created.id, traiteParId: user.id, traiteLe: new Date() },
      });
      if (!count) throw new BusinessException('PROSPECT_DEJA_TRAITE', 'Ce prospect vient d’être traité.');
      return created;
    });
    return { prospect: await this.findOne(user, id), demande };
  }

  async rejeter(user: AuthUser, id: number, motif: string) {
    return this.transition(user, id, 'REJETE', { motifRejet: motif });
  }

  async rouvrir(user: AuthUser, id: number) {
    return this.transition(user, id, 'A_QUALIFIER', { motifRejet: null });
  }

  async stats(user: AuthUser) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [parStatut, conversations, feedbacks, erreurs] = await Promise.all([
      this.prisma.chatSession.groupBy({
        by: ['statut'],
        where: { companyId: user.companyId, createdAt: { gte: since }, messages: { some: { role: 'user' } } },
        _count: { _all: true },
      }),
      this.prisma.chatSession.count({ where: { companyId: user.companyId, createdAt: { gte: since }, messages: { some: { role: 'user' } } } }),
      this.prisma.assistantFeedback.groupBy({ by: ['rating'], where: { companyId: user.companyId, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.assistantErreur.groupBy({ by: ['type'], where: { companyId: user.companyId, createdAt: { gte: since } }, _count: { _all: true } }),
    ]);
    return {
      periodeJours: 30,
      conversations,
      parStatut: Object.fromEntries(parStatut.map((r) => [r.statut, r._count._all])),
      feedbacks: Object.fromEntries(feedbacks.map((r) => [r.rating, r._count._all])),
      erreurs: Object.fromEntries(erreurs.map((r) => [r.type, r._count._all])),
    };
  }

  erreurs(user: AuthUser, page = 1) {
    return this.prisma.assistantErreur.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
      select: { id: true, type: true, detail: true, sessionId: true, createdAt: true },
    });
  }

  private async transition(user: AuthUser, id: number, to: ProspectStatut, data: Prisma.ChatSessionUpdateManyMutationInput) {
    const p = await this.findOne(user, id);
    ProspectMachine.assert(p.statut, to);
    const { count } = await this.prisma.chatSession.updateMany({
      where: { id, statut: p.statut },
      data: { ...data, statut: to, traiteParId: user.id, traiteLe: new Date() },
    });
    if (!count) throw new BusinessException('PROSPECT_DEJA_TRAITE', 'Ce prospect vient d’être modifié. Rechargez.');
    return this.findOne(user, id);
  }
}
