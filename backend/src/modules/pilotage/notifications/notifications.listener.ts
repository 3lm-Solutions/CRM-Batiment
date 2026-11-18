import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantEvents, type ProspectEvent } from '../../ia/assistant/assistant.events';
import { type DevisEvent, DevisEvents } from '../../commercial/devis/devis.events';
import {
  type AssuranceStatutEvent,
  SousTraitantEvents,
} from '../../execution/sous-traitants/sous-traitants.events';
import { DemoEvents, type DemoRequestEvent } from '../demo-requests/demo.events';
import {
  type CommandePortailEvent,
  PortailEvents,
  type RapportEvent,
  type TacheAvanceeEvent,
} from '../../portails/portails.events';
import { type SavEvent, SavEvents } from '../sav/sav.events';
import {
  type ProspectTerrainCreeEvent,
  ProspectTerrainEvents,
} from '../../mobile/prospects-terrain/prospects-terrain.events';
import {
  type TacheAffecteeEvent,
  type TacheCommenteeEvent,
  TacheEvents,
} from '../../execution/chantiers/taches.events';
import {
  type ReceptionEvent,
  ReceptionEvents,
} from '../../finance/commandes-fournisseur/receptions.events';
import { type DepenseEvent, DepenseEvents } from '../../finance/depenses/depenses.events';
import {
  INSTALLATION_EVENEMENT,
  type InstallationEvent,
} from '../../execution/installations/installations.events';
import { NotificationsService } from './notifications.service';

const ASYNC = { async: true } as const;

/** Who is told what. Every rule of "who gets notified" lives in this one file. */
@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(DevisEvents.ACCEPTE, ASYNC)
  async devisAccepte(e: DevisEvent) {
    await this.notifications.notifyRoles(
      e.companyId,
      [Role.ADMIN],
      {
        type: 'DEVIS_ACCEPTE',
        niveau: 'SUCCES',
        titre: `Devis ${e.reference} accepté`,
        message: 'Le client a accepté le devis. Les commandes fournisseur ont été préparées.',
        lien: `/devis/${e.devisId}`,
      },
      [await this.createur(e.devisId)],
    );
  }

  @OnEvent(DevisEvents.REFUSE, ASYNC)
  async devisRefuse(e: DevisEvent) {
    await this.notifications.notifyUsers(e.companyId, [await this.createur(e.devisId)], {
      type: 'DEVIS_REFUSE',
      niveau: 'ALERTE',
      titre: `Devis ${e.reference} refusé`,
      message: 'Le client a refusé le devis. Vous pouvez le réviser.',
      lien: `/devis/${e.devisId}`,
    });
  }

  @OnEvent(DevisEvents.SIGNE, ASYNC)
  async devisSigne(e: DevisEvent) {
    await this.notifications.notifyRoles(
      e.companyId,
      [Role.ADMIN, Role.ASSISTANTE],
      {
        type: 'DEVIS_SIGNE',
        niveau: 'SUCCES',
        titre: `Devis ${e.reference} signé`,
        message: 'Chantier créé et facture d’acompte prête à émettre.',
        lien: `/devis/${e.devisId}`,
      },
      [await this.createur(e.devisId)],
    );
  }

  /** 05/11 (re-applied 16/11): a scan of the paper signature must be checked by an ADMIN. */
  @OnEvent(DevisEvents.SIGNE_PAPIER, ASYNC)
  async devisSignePapier(e: DevisEvent) {
    await this.notifications.notifyRoles(e.companyId, [Role.ADMIN], {
      type: 'DEVIS_SIGNE_PAPIER',
      niveau: 'INFO',
      titre: `Devis ${e.reference} signé sur papier`,
      message: 'Vérifiez le scan de la signature puis validez-le ou rejetez-le.',
      lien: `/devis/${e.devisId}`,
    });
  }

  @OnEvent(DevisEvents.SIGNATURE_PAPIER_REJETEE, ASYNC)
  async signaturePapierRejetee(e: DevisEvent) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: e.devisId },
      select: { createurId: true, signaturePapierParId: true, signaturePapierRejet: true },
    });
    await this.notifications.notifyUsers(
      e.companyId,
      [devis?.signaturePapierParId, devis?.createurId],
      {
        type: 'DEVIS_SIGNATURE_PAPIER_REJETEE',
        niveau: 'ALERTE',
        titre: `Signature papier du devis ${e.reference} refusée`,
        message: devis?.signaturePapierRejet ?? 'Déposez un nouveau scan du devis signé.',
        lien: `/devis/${e.devisId}`,
      },
    );
  }

  /** Spec: alert when a quote leaves with a margin below the company threshold. */
  @OnEvent(DevisEvents.ENVOYE, ASYNC)
  async devisEnvoye(e: DevisEvent) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: e.devisId },
      select: {
        margePourcent: true,
        totalHT: true,
        company: { select: { seuilAlerteMargePourcent: true } },
      },
    });
    if (
      !devis ||
      devis.totalHT.lte(0) ||
      devis.margePourcent.gte(devis.company.seuilAlerteMargePourcent)
    )
      return;
    await this.notifications.notifyRoles(e.companyId, [Role.ADMIN], {
      type: 'MARGE_FAIBLE',
      niveau: 'ALERTE',
      titre: `Marge faible sur ${e.reference}`,
      message: `Devis envoyé avec ${devis.margePourcent.toString()} % de marge (seuil ${devis.company.seuilAlerteMargePourcent.toString()} %).`,
      lien: `/devis/${e.devisId}`,
    });
  }

  @OnEvent(SousTraitantEvents.ASSURANCE_STATUT, ASYNC)
  async assurance(e: AssuranceStatutEvent) {
    const expired = e.statut === 'EXPIREE';
    await this.notifications.notifyRoles(e.companyId, [Role.ADMIN], {
      type: 'ASSURANCE_' + e.statut,
      niveau: 'ALERTE',
      titre: `${expired ? 'Assurance expirée' : 'Assurance à renouveler'} — ${e.sousTraitantNom}`,
      message: `${e.typeAssurance} ${expired ? 'expirée le' : 'expire le'} ${e.dateExpiration.toLocaleDateString('fr-FR')}.`,
      lien: `/sous-traitants/${e.sousTraitantId}`,
    });
  }

  @OnEvent(SavEvents.CREE, ASYNC)
  async savCree(e: SavEvent) {
    await this.notifications.notifyRoles(
      e.companyId,
      [Role.ADMIN],
      {
        type: 'SAV_CREE',
        niveau: e.priorite === 'URGENTE' ? 'ALERTE' : 'INFO',
        titre: `Ticket SAV ${e.reference}`,
        message: e.titre,
        lien: `/sav/${e.ticketId}`,
      },
      [e.assignedToId],
    );
  }

  @OnEvent(SavEvents.ASSIGNE, ASYNC)
  async savAssigne(e: SavEvent) {
    await this.notifications.notifyUsers(e.companyId, [e.assignedToId], {
      type: 'SAV_ASSIGNE',
      titre: `Ticket SAV ${e.reference} vous est assigné`,
      message: e.titre,
      lien: `/sav/${e.ticketId}`,
    });
  }

  @OnEvent(DemoEvents.NOUVELLE, ASYNC)
  async demo(e: DemoRequestEvent) {
    await this.notifications.notifyRoles(e.companyId, [Role.ADMIN, Role.TECHNICO], {
      type: 'DEMANDE_DEMO',
      titre: 'Nouvelle demande de démo',
      message: `${e.nom}${e.entreprise ? ` (${e.entreprise})` : ''} souhaite une démonstration.`,
      lien: `/demandes-demo/${e.demoRequestId}`,
    });
  }

  // ── assistant IA (Step 14) ──────────────────────────────────────────────

  @OnEvent(AssistantEvents.PROSPECT_A_QUALIFIER, ASYNC)
  async prospect(e: ProspectEvent) {
    await this.notifications.notifyRoles(
      e.companyId,
      [Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE],
      {
        type: e.source === 'EMAIL' ? 'PROSPECT_EMAIL' : 'PROSPECT_CHATBOT',
        titre: `Nouveau prospect ${e.source === 'EMAIL' ? 'par email' : 'chatbot'}${e.nom ? ` : ${e.nom}` : ''}`,
        message: `${e.typeProjet ?? 'Projet à préciser'}${e.doublon ? ' — a déjà écrit récemment (doublon possible)' : ''}. À qualifier.`,
        lien: `/assistant/prospects/${e.sessionId}`,
      },
    );
  }

  @OnEvent(AssistantEvents.CONTACT_HUMAIN, ASYNC)
  async contactHumain(e: ProspectEvent) {
    await this.notifications.notifyRoles(e.companyId, [Role.ADMIN, Role.ASSISTANTE], {
      type: 'CHATBOT_CONTACT_HUMAIN',
      niveau: 'ALERTE',
      titre: 'Un visiteur demande un conseiller',
      message: `${e.nom ?? 'Visiteur'} souhaite parler à quelqu’un (chatbot).`,
      lien: `/assistant/prospects/${e.sessionId}`,
    });
  }

  // ── portails (Step 11) ──────────────────────────────────────────────────

  @OnEvent(PortailEvents.RAPPORT_SOUMIS, ASYNC)
  async rapportSoumis(e: RapportEvent) {
    await this.notifications.notifyRoles(
      e.companyId,
      [Role.ADMIN, Role.ASSISTANTE],
      {
        type: 'RAPPORT_SOUMIS',
        titre: `Rapport de ${e.auteurNom}`,
        message: `Nouveau rapport sur le chantier ${e.chantierReference}, à valider.`,
        lien: `/chantiers/${e.chantierId}`,
      },
      [e.chefChantierId],
    );
  }

  @OnEvent(PortailEvents.RAPPORT_REVU, ASYNC)
  async rapportRevu(e: RapportEvent) {
    const ok = e.statut === 'VALIDE';
    await this.notifications.notifyUsers(e.companyId, [e.auteurId], {
      type: ok ? 'RAPPORT_VALIDE' : 'RAPPORT_REJETE',
      niveau: ok ? 'SUCCES' : 'ALERTE',
      titre: ok ? 'Rapport validé' : 'Rapport à reprendre',
      message: `Chantier ${e.chantierReference}${ok ? '' : ' : voir le commentaire du bureau.'}`,
      lien: '/portail/rapports',
    });
  }

  @OnEvent(PortailEvents.TACHE_AVANCEE, ASYNC)
  async tacheAvancee(e: TacheAvanceeEvent) {
    await this.notifications.notifyUsers(e.companyId, [e.chefChantierId], {
      type: 'TACHE_AVANCEE',
      niveau: e.avancement === 100 ? 'SUCCES' : 'INFO',
      titre: `${e.chantierReference} — ${e.tacheLibelle}`,
      message: `${e.auteurNom} indique ${e.avancement} % d’avancement.`,
      lien: `/chantiers/${e.chantierId}`,
    });
  }

  // ── tâches (16/11, mobile lot B1) ───────────────────────────────────────

  @OnEvent(TacheEvents.AFFECTEE, ASYNC)
  async tacheAffectee(e: TacheAffecteeEvent) {
    await this.notifierParRole(e.companyId, e.userIds, e.chantierId, {
      type: 'TACHE_AFFECTEE',
      titre: `Nouvelle tâche — ${e.chantierReference}`,
      message: `Vous êtes affecté à « ${e.tacheLibelle} ».`,
    });
  }

  @OnEvent(TacheEvents.COMMENTEE, ASYNC)
  async tacheCommentee(e: TacheCommenteeEvent) {
    await this.notifierParRole(e.companyId, e.destinataires, e.chantierId, {
      type: 'TACHE_COMMENTEE',
      titre: `${e.chantierReference} — ${e.tacheLibelle}`,
      message: `${e.auteurNom || 'Un intervenant'} : ${e.extrait}`,
    });
  }

  // ── prospect terrain (16/11, mobile lot 1) ──────────────────────────────

  @OnEvent(ProspectTerrainEvents.CREE, ASYNC)
  async prospectTerrain(e: ProspectTerrainCreeEvent) {
    const destinataires = await this.prisma.user.findMany({
      where: {
        companyId: e.companyId,
        actif: true,
        role: { in: [Role.TECHNICO, Role.ADMIN] },
        id: { not: e.auteurId },
      },
      select: { id: true },
    });
    await this.notifications.notifyUsers(
      e.companyId,
      destinataires.map((u) => u.id),
      {
        type: 'PROSPECT_TERRAIN',
        niveau: 'INFO',
        titre: `Prospect terrain : ${e.clientNom}`,
        message: `${e.auteurNom} a rencontré un prospect (${e.reference}). À rappeler.`,
        lien: '/demandes',
      },
    );
  }

  /** The link differs: a sous-traitant opens his portal, the others the job site. */
  private async notifierParRole(
    companyId: number,
    userIds: number[],
    chantierId: number,
    input: { type: string; titre: string; message: string },
  ) {
    if (!userIds.length) return;
    const sousTraitants = new Set<number>(
      (
        await this.prisma.user.findMany({
          where: { id: { in: userIds }, role: Role.SOUS_TRAITANT },
          select: { id: true },
        })
      ).map((u) => u.id),
    );
    const autres = userIds.filter((id) => !sousTraitants.has(id));
    if (sousTraitants.size) {
      await this.notifications.notifyUsers(companyId, [...sousTraitants], {
        ...input,
        lien: `/portail/chantiers/${chantierId}`,
      });
    }
    if (autres.length) {
      await this.notifications.notifyUsers(companyId, autres, {
        ...input,
        lien: `/chantiers/${chantierId}`,
      });
    }
  }

  @OnEvent(PortailEvents.COMMANDE_ACCUSEE, ASYNC)
  async commandeAccusee(e: CommandePortailEvent) {
    await this.commandeFournisseur(
      e,
      'COMMANDE_ACCUSEE',
      `${e.fournisseurNom} a pris en compte la commande`,
    );
  }

  @OnEvent(PortailEvents.COMMANDE_EXPEDIEE, ASYNC)
  async commandeExpediee(e: CommandePortailEvent) {
    await this.commandeFournisseur(
      e,
      'COMMANDE_EXPEDIEE',
      `${e.fournisseurNom} a expédié la commande`,
    );
  }

  private async commandeFournisseur(e: CommandePortailEvent, type: string, message: string) {
    const date = e.dateLivraisonPrevue
      ? ` — livraison prévue le ${e.dateLivraisonPrevue.toLocaleDateString('fr-FR')}`
      : '';
    await this.notifications.notifyRoles(e.companyId, [Role.ADMIN, Role.ASSISTANTE], {
      type,
      titre: `Commande ${e.reference}`,
      message: message + date,
      lien: `/commandes/${e.commandeId}`,
    });
  }

  private async createur(devisId: number): Promise<number | null> {
    return (
      (await this.prisma.devis.findUnique({ where: { id: devisId }, select: { createurId: true } }))
        ?.createurId ?? null
    );
  }

  // ── livraisons vérifiées avec le bon de livraison (lot A, 18/11) ────────

  @OnEvent(ReceptionEvents.ECARTS, ASYNC)
  async receptionEcarts(e: ReceptionEvent) {
    await this.notifications.notifyRoles(e.companyId, [Role.ADMIN, Role.ASSISTANTE], {
      type: 'LIVRAISON_ECARTS',
      niveau: 'ALERTE',
      titre: `Livraison avec écarts : ${e.reference}`,
      message: `${e.nbEcarts ?? 1} écart(s) noté(s) avec le bon de livraison. À vérifier.`,
      // the web page of the order shows its deliveries
      lien: `/commandes/${e.commandeId}`,
    });
  }

  @OnEvent(ReceptionEvents.CONTROLEE, ASYNC)
  async receptionControlee(e: ReceptionEvent) {
    if (!e.auteurId || e.auteurId === e.userId) return;
    await this.notifications.notifyUsers(e.companyId, [e.auteurId], {
      type: 'LIVRAISON_CONTROLEE',
      niveau: e.decision === 'REFUSEE' ? 'ALERTE' : 'INFO',
      titre: `Livraison ${e.reference} ${e.decision === 'REFUSEE' ? 'refusée' : 'acceptée'} par le bureau`,
      message: e.decision === 'REFUSEE' ? `Motif : ${e.motif}` : 'Les écarts sont pris en compte.',
      lien: `/commandes/${e.commandeId}`,
    });
  }

  // ── factures fournisseur envoyées du terrain (lot A, 18/11) ─────────────

  @OnEvent(DepenseEvents.CREEE, ASYNC)
  async depenseCreee(e: DepenseEvent) {
    await this.notifications.notifyRoles(e.companyId, [Role.ADMIN, Role.ASSISTANTE], {
      type: 'DEPENSE_A_VALIDER',
      titre: `Facture fournisseur à valider : ${e.fournisseurNom}`,
      message: `Facture n° ${e.numeroFacture} (${e.reference}) envoyée depuis le terrain.`,
      // no web page for the dépenses yet: no link
    });
  }

  @OnEvent(DepenseEvents.DECIDEE, ASYNC)
  async depenseDecidee(e: DepenseEvent) {
    if (!e.createurId || e.createurId === e.userId) return;
    await this.notifications.notifyUsers(e.companyId, [e.createurId], {
      type: 'DEPENSE_DECIDEE',
      niveau: e.decision === 'REFUSEE' ? 'ALERTE' : 'INFO',
      titre: `Facture ${e.fournisseurNom} n° ${e.numeroFacture} ${e.decision === 'REFUSEE' ? 'refusée' : 'validée'}`,
      message: e.decision === 'REFUSEE' ? `Motif : ${e.motif}` : 'Le bureau a validé la dépense.',
    });
  }

  // ── installations déléguées (lot B, 18/11) ──────────────────────────────

  /** One rule for every action: the office (ADMIN, ASSISTANTE) and / or the installer. */
  @OnEvent(INSTALLATION_EVENEMENT, ASYNC)
  async installation(e: InstallationEvent) {
    const notif = {
      type: `INSTALLATION_${e.type}`,
      niveau: e.alerte ? ('ALERTE' as const) : ('INFO' as const),
      titre: `Installation ${e.reference}`,
      message: e.message,
      // no web page for the installations: the mobile opens them from the type
    };
    if (e.pour === 'BUREAU' || e.pour === 'LES_DEUX') {
      const bureau = await this.prisma.user.findMany({
        where: {
          companyId: e.companyId,
          actif: true,
          role: { in: [Role.ADMIN, Role.ASSISTANTE] },
          ...(e.userId && { id: { not: e.userId } }),
        },
        select: { id: true },
      });
      await this.notifications.notifyUsers(
        e.companyId,
        bureau.map((u) => u.id),
        notif,
      );
    }
    if (
      (e.pour === 'INSTALLATEUR' || e.pour === 'LES_DEUX') &&
      e.installateurUserId &&
      e.installateurUserId !== e.userId
    ) {
      await this.notifications.notifyUsers(e.companyId, [e.installateurUserId], notif);
    }
  }
}
