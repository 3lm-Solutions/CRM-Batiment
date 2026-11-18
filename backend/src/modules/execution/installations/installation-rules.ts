import type {
  CommandeFournisseurStatut,
  InstallationEtape,
} from '../../../generated/prisma/client';

/** The 8 steps of a delegated installation, in order (spec of the mobile app, part 4). */
export const ETAPES: InstallationEtape[] = [
  'DEVIS_SIGNE',
  'INSTALLATEUR_PROPOSE',
  'MISSION_ACCEPTEE',
  'LIVRAISON',
  'POSE',
  'FINITIONS',
  'TERMINEE',
  'CLOTUREE',
];

export const ETAPE_LABEL: Record<InstallationEtape, string> = {
  DEVIS_SIGNE: 'Devis signé',
  INSTALLATEUR_PROPOSE: 'Installateur proposé',
  MISSION_ACCEPTEE: 'Mission acceptée',
  LIVRAISON: 'Livraison',
  POSE: 'Pose',
  FINITIONS: 'Finitions',
  TERMINEE: 'Terminé (PV signé)',
  CLOTUREE: 'Clôturé',
};

/** Steps with photos taken by the installer */
export const ETAPES_PHOTOS: InstallationEtape[] = ['LIVRAISON', 'POSE', 'FINITIONS'];

/** The installer moves LIVRAISON → POSE → FINITIONS himself; the signed PV ends FINITIONS. */
export function etapeSuivante(etape: InstallationEtape): InstallationEtape | null {
  if (etape === 'LIVRAISON') return 'POSE';
  if (etape === 'POSE') return 'FINITIONS';
  return null;
}

export const MISSIONS_FILTRE = {
  PROPOSEES: ['INSTALLATEUR_PROPOSE'],
  EN_COURS: ['MISSION_ACCEPTEE', 'LIVRAISON', 'POSE', 'FINITIONS'],
  TERMINEES: ['TERMINEE', 'CLOTUREE'],
} satisfies Record<string, InstallationEtape[]>;
export type MissionsFiltre = keyof typeof MISSIONS_FILTRE;

const FINIES: InstallationEtape[] = ['TERMINEE', 'CLOTUREE'];
const AVANT_POSE: InstallationEtape[] = [
  'DEVIS_SIGNE',
  'INSTALLATEUR_PROPOSE',
  'MISSION_ACCEPTEE',
  'LIVRAISON',
];
const COMMANDE_ATTENDUE: CommandeFournisseurStatut[] = [
  'CREEE',
  'ENVOYEE',
  'EXPEDIEE',
  'PARTIELLE',
];

/**
 * - enRetard: the confirmed date is past and the work is not finished;
 * - alerteLivraison: before the pose, an order of the job site is still expected and its planned
 *   delivery is unknown or after the installation date (confirmed, else wished).
 */
export function alertesInstallation(
  inst: { etape: InstallationEtape; dateConfirmee: Date | null; dateSouhaitee: Date | null },
  commandes: { statutLivraison: CommandeFournisseurStatut; dateLivraisonPrevue: Date | null }[],
  now: Date = new Date(),
): { enRetard: boolean; alerteLivraison: boolean } {
  const enRetard = !FINIES.includes(inst.etape) && !!inst.dateConfirmee && inst.dateConfirmee < now;
  const datePose = inst.dateConfirmee ?? inst.dateSouhaitee;
  const alerteLivraison =
    AVANT_POSE.includes(inst.etape) &&
    !!datePose &&
    commandes.some(
      (c) =>
        COMMANDE_ATTENDUE.includes(c.statutLivraison) &&
        (!c.dateLivraisonPrevue || c.dateLivraisonPrevue > datePose),
    );
  return { enRetard, alerteLivraison };
}
