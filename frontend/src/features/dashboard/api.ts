import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Dashboard {
  periodeJours: number;
  prospects: { demandesActives: number; nouveauxClients: number };
  devis: { envoyes: number; acceptes: number; refuses: number; tauxConversion: number | null };
  chiffreAffaires: { signeMoisHT: number; devisSignesMois: number };
  margeMoyennePourcent: number | null;
  facturesImpayees: { nombre: number; montantTTC: number; enRetard: { nombre: number; montantTTC: number } };
  chantiersEnRetard: {
    nombre: number;
    liste: { id: number; reference: string; dateFin: string; statut: string; client: { nom: string }; joursRetard: number }[];
  };
  commandesEnAttente: number;
  sav: { ouverts: number; urgents: number };
  stockAlertes: number;
  /** Reminder emails sent to clients over the last 7 days (C3 of 21/10) */
  relancesSemaine: number;
  /** Étape 6 (26/10): client comments / alerts still open (optional: older API) */
  retoursClient?: {
    alertesOuvertes: number;
    commentairesOuverts: number;
    alertes: { id: number; message: string; createdAt: string; chantier: { id: number; reference: string }; client: { nom: string; prenom: string | null } }[];
  };
  /** Job sites in progress (with sous-traitants) without a photo for 2 days */
  chantiersSansPhoto?: { nombre: number; liste: { id: number; reference: string; client: { nom: string; prenom: string | null }; dernierePhoto: string | null }[] };
  /** Planned margin per job site (signed quotes), worst first — C9 of 20/10 */
  margesChantiers: {
    seuil: number;
    nombre: number;
    sousSeuil: number;
    margeMoyennePonderee: number | null;
    liste: {
      id: number;
      reference: string;
      statut: string;
      client: { nom: string; prenom: string | null };
      totalHT: number;
      profit: number;
      margePourcent: number | null;
      alerte: boolean;
    }[];
  };
  /** Last 12 weeks, oldest first; `semaine` is the Monday (ISO date) */
  serieDevis: { semaine: string; envoyes: number; acceptes: number; refuses: number }[];
}

export const useDashboard = (jours: number) =>
  useQuery({
    queryKey: ['dashboard', jours],
    placeholderData: keepPreviousData,
    // Figures move with every quote/invoice: refreshed every 5 minutes while the page is open
    refetchInterval: 5 * 60_000,
    queryFn: async () => (await api.get<Dashboard>('/dashboard', { params: { jours } })).data,
  });
