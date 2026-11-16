import { useState, type ReactNode } from 'react';
import AccountUserMenu from '@/components/AccountUserMenu';
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Box,
  Briefcase,
  UserCircle2,
  Building2,
  Calculator,
  CheckSquare,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  HardHat,
  History,
  LayoutDashboard,
  LifeBuoy,
  List,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  Receipt,
  Shield,
  Settings,
  Sun,
  Truck,
  Users,
  Warehouse,
  Wrench,
  X,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import InternalNotificationsBell from '@/components/InternalNotificationsBell';
import { useDarkMode } from '@/hooks/useDarkMode';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

interface NavItem {
  to: string;
  label: string;
  description: string;
  group: string;
  icon: ReactNode;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    to: '/admin',
    label: 'Tableau de bord',
    description: 'Vue générale',
    group: 'Pilotage',
    icon: <LayoutDashboard size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/chantiers',
    label: 'Chantiers',
    description: 'Suivi des chantiers',
    group: 'Pilotage',
    icon: <HardHat size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/taches-chantier',
    label: 'Tâches chantier',
    description: 'Planning et tâches',
    group: 'Pilotage',
    icon: <CheckSquare size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/admin/commandes-fournisseur',
    label: 'Commandes fournisseur',
    description: 'Commandes et réceptions',
    group: 'Pilotage',
    icon: <PackageCheck size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/sav',
    label: 'SAV',
    description: 'Tickets et interventions',
    group: 'Pilotage',
    icon: <LifeBuoy size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },

  {
    to: '/admin/clients',
    label: 'Clients',
    description: 'Fiches clients',
    group: 'Commercial',
    icon: <Users size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/demandes-devis',
    label: 'Demandes',
    description: 'Demandes de devis',
    group: 'Commercial',
    icon: <FileText size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/demo-requests',
    label: 'Demandes de démo',
    description: 'Demandes reçues',
    group: 'Commercial',
    icon: <FileText size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/devis',
    label: 'Devis',
    description: 'Création et suivi',
    group: 'Commercial',
    icon: <FileSpreadsheet size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/factures',
    label: 'Factures',
    description: 'Facturation et paiements',
    group: 'Commercial',
    icon: <Receipt size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },

  {
    to: '/admin/prestations',
    label: 'Prestations',
    description: 'Catalogue prestations',
    group: 'Référentiel',
    icon: <List size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/prestations-compositions',
    label: 'Compositions',
    description: 'Composition prestations',
    group: 'Référentiel',
    icon: <FileSpreadsheet size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/materiaux',
    label: 'Matériaux',
    description: 'Catalogue matériaux',
    group: 'Référentiel',
    icon: <Box size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/stock',
    label: 'Stock',
    description: 'État du stock',
    group: 'Référentiel',
    icon: <Warehouse size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/services-mo',
    label: "Main d'œuvre",
    description: 'Services et coûts',
    group: 'Référentiel',
    icon: <Wrench size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/fournisseurs',
    label: 'Fournisseurs',
    description: 'Contacts et tarifs',
    group: 'Référentiel',
    icon: <Truck size={18} />,
    roles: ['ADMIN', 'ASSISTANTE'],
  },
  {
    to: '/admin/sous-traitants',
    label: 'Sous-traitants',
    description: 'Gestion des sous-traitants',
    group: 'Référentiel',
    icon: <Briefcase size={18} />,
    roles: ['ADMIN'],
  },

  {
    to: '/admin/utilisateurs',
    label: 'Utilisateurs',
    description: 'Comptes et rôles',
    group: 'Administration',
    icon: <Shield size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/admin/types-projet',
    label: 'Types de projet',
    description: 'Référentiel projets',
    group: 'Administration',
    icon: <FolderKanban size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/admin/base-ia',
    label: 'Base IA / RAG',
    description: 'Documents métier',
    group: 'Administration',
    icon: <Database size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/admin/parametres-chiffrage',
    label: 'Paramètres',
    description: 'Règles de chiffrage',
    group: 'Administration',
    icon: <Calculator size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/admin/audit',
    label: 'Audit',
    description: 'Journal des activités',
    group: 'Administration',
    icon: <History size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/admin/parametres',
    label: 'Paramètres',
    description: 'Compte et préférences',
    group: 'Compte',
    icon: <Settings size={18} />,
    roles: ['ASSISTANTE'],
  },
  {
    to: '/admin/profil',
    label: 'Mon Profil',
    description: 'Mon profil utilisateur',
    group: 'Compte',
    icon: <UserCircle2 size={18} />,
    roles: ['ADMIN'],
  },
];

const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrateur',
  TECHNICO: 'Technico-commercial',
  ASSISTANTE: 'Assistante',
  CHEF_CHANTIER: 'Chef de chantier',
  SOUS_TRAITANT: 'Sous-traitant',
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { darkMode, toggleDarkMode } = useDarkMode();

  const [mobileOpen, setMobileOpen] = useState(false);

  const basePath =
    user?.role === 'ASSISTANTE'
      ? '/assistante'
      : '/admin';

  const visibleItems = navItems
    .filter((item) =>
      user ? item.roles.includes(user.role) : false,
    )
    .map((item) => ({
      ...item,
      to: item.to.replace(/^\/admin/, basePath),
    }));

  const currentItem = [...visibleItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find(
      (item) =>
        location.pathname === item.to ||
        location.pathname.startsWith(`${item.to}/`),
    );

  const initials = user
    ? `${user.prenom?.charAt(0) ?? ''}${
        user.nom?.charAt(0) ?? ''
      }`.toUpperCase()
    : 'A';

  const displayName = user
    ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim()
    : 'Administrateur';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">

      {/* Overlay mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[292px] flex-col',
          'bg-[linear-gradient(180deg,#143b68_0%,#185fa5_46%,#2380b8_100%)]',
          'text-white shadow-2xl shadow-slate-900/20',
          'transition-transform duration-300',
          'dark:bg-[linear-gradient(180deg,#020617_0%,#0f2746_48%,#123f63_100%)]',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="border-b border-white/15 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/20">
              <Building2 size={23} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                {user?.role === 'ASSISTANTE'
                  ? 'Espace assistante'
                  : 'Espace admin'}
              </p>

              <h1 className="truncate text-lg font-bold">
                BÂTIFLOW
              </h1>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="ml-auto rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleItems.map((item, index) => {
            const previousItem =
              visibleItems[index - 1];

            const showGroup =
              index === 0 ||
              item.group !== previousItem?.group;

            return (
              <div key={item.to}>
                {showGroup && (
                  <p className="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/55 first:pt-0">
                    {item.group}
                  </p>
                )}

                <NavLink
                  to={item.to}
                  end={item.to === basePath}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'group mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all',
                      isActive
                        ? 'bg-white/18 text-white shadow-lg shadow-slate-900/10 ring-1 ring-white/15'
                        : 'text-white/78 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition',
                          isActive
                            ? 'bg-white/20 text-cyan-50'
                            : 'bg-white/8 text-cyan-100/70',
                        )}
                      >
                        {item.icon}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {item.label}
                        </span>

                        <span
                          className={cn(
                            'block truncate text-[11px]',
                            isActive
                              ? 'text-cyan-50/90'
                              : 'text-cyan-100/55',
                          )}
                        >
                          {item.description}
                        </span>
                      </span>

                      {isActive && (
                        <ChevronRight
                          size={16}
                          className="text-cyan-100/80"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Profil bas sidebar */}
        <div className="border-t border-white/15 px-4 py-4">
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-sm font-bold text-[#185FA5]">
                {initials || 'A'}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {displayName}
                </p>

                <p className="truncate text-xs text-cyan-100/70">
                  {roleLabels[user?.role ?? 'ADMIN']}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/75 transition hover:bg-red-500/25 hover:text-red-100"
                title="Se déconnecter"
                aria-label="Se déconnecter"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="min-h-screen min-w-0 flex-1 lg:ml-[292px]">

        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8">

            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setMobileOpen((value) => !value)
                }
                className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                aria-label="Ouvrir le menu"
              >
                {mobileOpen ? (
                  <X size={20} />
                ) : (
                  <Menu size={20} />
                )}
              </button>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#185FA5] dark:text-blue-400">
                  {user?.role === 'ASSISTANTE'
                    ? 'Assistante'
                    : 'Administration'}
                </p>

                <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  {currentItem?.label ??
                    'Tableau de bord'}
                </h2>
              </div>
            </div>

            {/* Actions header */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title={
                  darkMode
                    ? 'Mode clair'
                    : 'Mode sombre'
                }
                aria-label={
                  darkMode
                    ? 'Activer le mode clair'
                    : 'Activer le mode sombre'
                }
              >
                {darkMode ? (
                  <Sun size={17} />
                ) : (
                  <Moon size={17} />
                )}
              </button>

              <InternalNotificationsBell />

              <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

              <AccountUserMenu
                displayName={displayName}
                initials={initials || 'A'}
                roleLabel={roleLabels[user?.role ?? 'ADMIN']}
                settingsPath={
                  user?.role === 'ADMIN'
                    ? '/admin/parametres-chiffrage'
                    : user?.role === 'ASSISTANTE'
                      ? '/assistante/parametres'
                      : undefined
                }
              />
            </div>
          </div>
        </header>

        {/* Pages */}
        <div className="min-w-0 overflow-x-hidden px-3 py-4 transition-colors sm:px-4 sm:py-5 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}