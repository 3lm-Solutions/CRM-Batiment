import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type DevisEvent,
  DevisEvents,
  type DevisPriceChangedEvent,
} from '../../commercial/devis/devis.events';
import { type FactureEvent, FactureEvents } from '../../finance/factures/facture.events';
import {
  CATALOGUE_PRICE_CHANGED,
  type CataloguePriceChangedEvent,
} from '../../referentiel/catalogue/catalogue.events';
import { RELANCE_ENVOYEE, type RelanceEnvoyeeEvent } from '../relances/relances.events';
import {
  type ReceptionEvent,
  ReceptionEvents,
} from '../../finance/commandes-fournisseur/receptions.events';
import { type DepenseEvent, DepenseEvents } from '../../finance/depenses/depenses.events';
import {
  INSTALLATION_EVENEMENT,
  type InstallationEvent,
} from '../../execution/installations/installations.events';
import { AuditService } from './audit.service';

const ASYNC = { async: true } as const;

/**
 * Turns domain events into audit entries. Modules emit events; none of them knows this exists.
 * Covers the spec: price changes (catalogue + quote lines), signatures and quote/invoice life.
 */
@Injectable()
export class AuditListener {
  constructor(private readonly audit: AuditService) {}

  @OnEvent(CATALOGUE_PRICE_CHANGED, ASYNC)
  onCataloguePrice(e: CataloguePriceChangedEvent) {
    return this.audit.record({
      companyId: e.companyId,
      userId: e.userId,
      action: 'PRIX_MODIFIE',
      entite: e.entite,
      entiteId: e.entiteId,
      ancienneValeur: { [e.champ]: e.ancienneValeur, libelle: e.libelle },
      nouvelleValeur: { [e.champ]: e.nouvelleValeur, libelle: e.libelle },
    });
  }

  @OnEvent(DevisEvents.PRIX_MODIFIE, ASYNC)
  onDevisPrice(e: DevisPriceChangedEvent) {
    return this.audit.record({
      companyId: e.companyId,
      userId: e.userId,
      action: 'PRIX_LIGNE_MODIFIE',
      entite: 'Devis',
      entiteId: e.devisId,
      ancienneValeur: { ligneId: e.ligneId, libelle: e.libelle, prixUnitaireVente: e.ancienPrix },
      nouvelleValeur: { ligneId: e.ligneId, libelle: e.libelle, prixUnitaireVente: e.nouveauPrix },
    });
  }

  @OnEvent(DevisEvents.ENVOYE, ASYNC)
  onEnvoye(e: DevisEvent) {
    return this.devis('DEVIS_ENVOYE', e);
  }

  @OnEvent(DevisEvents.ACCEPTE, ASYNC)
  onAccepte(e: DevisEvent) {
    return this.devis('DEVIS_ACCEPTE', e);
  }

  @OnEvent(DevisEvents.REFUSE, ASYNC)
  onRefuse(e: DevisEvent) {
    return this.devis('DEVIS_REFUSE', e);
  }

  @OnEvent(DevisEvents.SIGNE, ASYNC)
  onSigne(e: DevisEvent) {
    return this.devis('DEVIS_SIGNE', e);
  }

  @OnEvent(DevisEvents.ANNULE, ASYNC)
  onAnnule(e: DevisEvent) {
    return this.devis('DEVIS_ANNULE', e);
  }

  // 16/11: paper signature uploaded / rejected (validation is recorded as DEVIS_SIGNE)
  @OnEvent(DevisEvents.SIGNE_PAPIER, ASYNC)
  onSignePapier(e: DevisEvent) {
    return this.devis('DEVIS_SIGNE_PAPIER', e);
  }

  @OnEvent(DevisEvents.SIGNATURE_PAPIER_REJETEE, ASYNC)
  onSignaturePapierRejetee(e: DevisEvent) {
    return this.devis('DEVIS_SIGNATURE_PAPIER_REJETEE', e);
  }

  @OnEvent(FactureEvents.EMISE, ASYNC)
  onFactureEmise(e: FactureEvent) {
    return this.facture('FACTURE_EMISE', e);
  }

  @OnEvent(FactureEvents.PAYEE, ASYNC)
  onFacturePayee(e: FactureEvent) {
    return this.facture('FACTURE_PAYEE', e);
  }

  @OnEvent(FactureEvents.ANNULEE, ASYNC)
  onFactureAnnulee(e: FactureEvent) {
    return this.facture('FACTURE_ANNULEE', e);
  }

  /** C3 of 21/10: every reminder, automatic (userId null) or « Relancer maintenant ». */
  @OnEvent(RELANCE_ENVOYEE, ASYNC)
  onRelance(e: RelanceEnvoyeeEvent) {
    return this.audit.record({
      companyId: e.companyId,
      userId: e.userId,
      action: e.type === 'DEVIS' ? 'RELANCE_DEVIS' : 'RELANCE_FACTURE',
      entite: e.type === 'DEVIS' ? 'Devis' : 'Facture',
      entiteId: e.entiteId,
      nouvelleValeur: {
        reference: e.reference,
        niveau: e.niveau,
        par: e.automatique ? 'automatique' : 'utilisateur',
        destinataire: e.destinataire,
        emailEnvoye: e.emailEnvoye,
      },
    });
  }

  private devis(action: string, e: DevisEvent) {
    return this.audit.record({
      companyId: e.companyId,
      userId: e.userId,
      action,
      entite: 'Devis',
      entiteId: e.devisId,
      // null userId = the client acted through his link
      nouvelleValeur: { reference: e.reference, par: e.userId ? 'utilisateur' : 'client' },
    });
  }

  private facture(action: string, e: FactureEvent) {
    return this.audit.record({
      companyId: e.companyId,
      userId: e.userId,
      action,
      entite: 'Facture',
      entiteId: e.factureId,
      nouvelleValeur: { reference: e.reference, type: e.type, montantTTC: e.montantTTC },
    });
  }

  // ── lot A (18/11): checked deliveries ───────────────────────────────────

  @OnEvent(ReceptionEvents.CONTROLEE, ASYNC)
  onReceptionControlee(e: ReceptionEvent) {
    return this.audit.record({
      companyId: e.companyId,
      userId: e.userId,
      action: e.decision === 'REFUSEE' ? 'LIVRAISON_REFUSEE' : 'LIVRAISON_ACCEPTEE',
      entite: 'Reception',
      entiteId: e.receptionId,
      nouvelleValeur: { commande: e.reference, motif: e.motif ?? null },
    });
  }

  @OnEvent(DepenseEvents.DECIDEE, ASYNC)
  onDepenseDecidee(e: DepenseEvent) {
    return this.audit.record({
      companyId: e.companyId,
      userId: e.userId,
      action: e.decision === 'REFUSEE' ? 'DEPENSE_REFUSEE' : 'DEPENSE_VALIDEE',
      entite: 'Depense',
      entiteId: e.depenseId,
      nouvelleValeur: {
        reference: e.reference,
        fournisseur: e.fournisseurNom,
        numero: e.numeroFacture,
        motif: e.motif ?? null,
      },
    });
  }

  // ── lot B (18/11): decisions on a delegated installation ────────────────

  @OnEvent(INSTALLATION_EVENEMENT, ASYNC)
  onInstallation(e: InstallationEvent) {
    const gardees = [
      'PROPOSEE',
      'ACCEPTEE',
      'REFUSEE',
      'PV_SIGNE',
      'PV_REJETE',
      'CLOTUREE',
      'SAV_CREE',
    ];
    if (!gardees.includes(e.type)) return;
    return this.audit.record({
      companyId: e.companyId,
      userId: e.userId,
      action: `INSTALLATION_${e.type}`,
      entite: 'Installation',
      entiteId: e.installationId,
      nouvelleValeur: { reference: e.reference, message: e.message },
    });
  }
}
