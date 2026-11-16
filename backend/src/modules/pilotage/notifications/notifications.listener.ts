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
}
