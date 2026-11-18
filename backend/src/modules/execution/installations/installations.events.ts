/**
 * 18/11 (mobile lot B): one event per action on a delegated installation, emitted after the
 * commit. NotificationsListener tells the office and / or the installer; AuditListener keeps the
 * decisions.
 */
export const INSTALLATION_EVENEMENT = 'installation.evenement';

export type InstallationEvenementType =
  | 'CREEE'
  | 'PROPOSEE'
  | 'RELANCEE'
  | 'ACCEPTEE'
  | 'REFUSEE'
  | 'DATE_PROPOSEE'
  | 'DATE_CONFIRMEE'
  | 'DATE_MODIFIEE'
  | 'ETAPE'
  | 'SIGNALEMENT'
  | 'SIGNALEMENT_TRAITE'
  | 'SAV_CREE'
  | 'PV_SIGNE'
  | 'PV_A_VERIFIER'
  | 'PV_REJETE'
  | 'CLOTUREE';

export interface InstallationEvent {
  companyId: number;
  installationId: number;
  reference: string;
  type: InstallationEvenementType;
  /** Same sentence as the chronology line */
  message: string;
  /** Who did it (null: automatic, at the signature of the quote) */
  userId: number | null;
  /** Account of the installer concerned (null when none) */
  installateurUserId: number | null;
  /** Who is told: the office (ADMIN, ASSISTANTE), the installer, both */
  pour: 'BUREAU' | 'INSTALLATEUR' | 'LES_DEUX' | 'PERSONNE';
  alerte?: boolean;
}
