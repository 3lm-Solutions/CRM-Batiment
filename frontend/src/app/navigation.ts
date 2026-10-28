import {
  UserSearch,
  BookOpen,
  Bot,
  CalendarDays,
  CalendarRange,
  Clock,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  FolderOpen,
  Handshake,
  HardHat,
  Home,
  LayoutDashboard,
  MonitorPlay,
  NotebookPen,
  Receipt,
  Settings,
  ShieldCheck,
  Truck,
  UserCog,
  UserCircle2,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/shared';

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: Role[];
  /** Exact match only (for a parent route like /portail) */
  end?: boolean;
}

const BUREAU: Role[] = ['ADMIN', 'TECHNICO', 'ASSISTANTE'];
const STAFF: Role[] = [...BUREAU, 'CHEF_CHANTIER'];

const ALL: Role[] = [...STAFF, 'SOUS_TRAITANT', 'FOURNISSEUR'];

/** Sidebar, per role — grouped like the old app (Pilotage, Commercial, Référentiel…). Same entries as router.tsx. */
export const NAVIGATION: { section: string; items: NavItem[] }[] = [
  {
    section: 'Pilotage',
    items: [
      { to: '/tableau-de-bord', label: 'Tableau de bord', description: 'Vue générale', icon: LayoutDashboard, roles: ['ADMIN'] },
      { to: '/chantiers', label: 'Chantiers', description: 'Suivi des chantiers', icon: HardHat, roles: STAFF },
      { to: '/planning', label: 'Planning', description: 'Calendrier des équipes', icon: CalendarRange, roles: STAFF },
      { to: '/pointages', label: 'Pointages', description: 'Heures des sous-traitants', icon: Clock, roles: STAFF },
      { to: '/commandes', label: 'Commandes fournisseur', description: 'Commandes et réceptions', icon: Truck, roles: STAFF },
      { to: '/sav', label: 'SAV', description: 'Tickets et interventions', icon: Wrench, roles: STAFF },
    ],
  },
  {
    section: 'Commercial',
    items: [
      { to: '/prospects', label: 'Prospects', description: 'Contacts sans devis signé', icon: UserSearch, roles: STAFF },
      { to: '/clients', label: 'Clients', description: 'Ont signé un devis', icon: Users, roles: STAFF },
      { to: '/demandes', label: 'Demandes', description: 'Demandes de devis', icon: ClipboardList, roles: BUREAU },
      { to: '/assistant', label: 'Assistant IA', description: 'Prospects chatbot et emails', icon: Bot, roles: BUREAU },
      { to: '/devis', label: 'Devis', description: 'Création et suivi', icon: FileText, roles: STAFF },
      { to: '/factures', label: 'Factures', description: 'Facturation et paiements', icon: Receipt, roles: STAFF },
      { to: '/demandes-demo', label: 'Demandes de démo', description: 'Demandes reçues', icon: MonitorPlay, roles: ['ADMIN', 'TECHNICO'] },
    ],
  },
  {
    section: 'Référentiel',
    items: [
      { to: '/catalogue', label: 'Prestations & matériaux', description: 'Catalogue et main d’œuvre', icon: BookOpen, roles: STAFF },
      { to: '/stock', label: 'Stock', description: 'État du stock', icon: Boxes, roles: STAFF },
      { to: '/fournisseurs', label: 'Fournisseurs', description: 'Contacts et délais', icon: Factory, roles: BUREAU },
      { to: '/sous-traitants', label: 'Sous-traitants', description: 'Gestion des sous-traitants', icon: Handshake, roles: ['ADMIN', 'ASSISTANTE', 'CHEF_CHANTIER'] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/utilisateurs', label: 'Utilisateurs', description: 'Comptes et rôles', icon: UserCog, roles: ['ADMIN'] },
      { to: '/audit', label: 'Audit', description: 'Journal des activités', icon: ShieldCheck, roles: ['ADMIN'] },
      { to: '/parametres', label: 'Paramètres', description: 'Entreprise et chiffrage', icon: Settings, roles: ['ADMIN'] },
    ],
  },
  // External accounts (Step 11)
  {
    section: 'Mon espace',
    items: [
      { to: '/portail', label: 'Accueil', description: 'Vue d’ensemble', icon: Home, roles: ['SOUS_TRAITANT', 'FOURNISSEUR'], end: true },
      { to: '/portail/chantiers', label: 'Mes chantiers', description: 'Tâches et documents', icon: HardHat, roles: ['SOUS_TRAITANT'] },
      { to: '/portail/rapports', label: 'Mes rapports', description: 'Comptes rendus et photos', icon: NotebookPen, roles: ['SOUS_TRAITANT'] },
      { to: '/portail/dossier', label: 'Mon dossier', description: 'Assurances et contrats', icon: FolderOpen, roles: ['SOUS_TRAITANT'] },
      { to: '/portail/heures', label: 'Mes heures', description: 'Pointage par jour et chantier', icon: Clock, roles: ['SOUS_TRAITANT'] },
      { to: '/portail/disponibilites', label: 'Mes disponibilités', description: 'Périodes libres ou occupées', icon: CalendarDays, roles: ['SOUS_TRAITANT'] },
      { to: '/portail/commandes', label: 'Mes commandes', description: 'À confirmer et expédier', icon: Truck, roles: ['FOURNISSEUR'] },
    ],
  },
  {
    section: 'Compte',
    items: [{ to: '/profil', label: 'Mon profil', description: 'Mon profil utilisateur', icon: UserCircle2, roles: ALL }],
  },
];

export const navigationFor = (role: Role) =>
  NAVIGATION.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) })).filter((s) => s.items.length);

/** Where each role lands after login. */
export const HOME_BY_ROLE: Record<Role, string> = {
  ADMIN: '/tableau-de-bord',
  TECHNICO: '/devis',
  ASSISTANTE: '/demandes',
  CHEF_CHANTIER: '/chantiers',
  SOUS_TRAITANT: '/portail',
  FOURNISSEUR: '/portail',
};
