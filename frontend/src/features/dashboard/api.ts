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
