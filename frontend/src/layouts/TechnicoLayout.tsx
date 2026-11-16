import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  FileSpreadsheet,
  BookOpen,
  LogOut,
  ChevronRight,
  Briefcase,
  Search,
  Menu,
  Moon,
  X,
  Sun,
  CheckSquare,
  Signature,
  Receipt,
  Bot,
  PackageCheck,
  LifeBuoy,
  CalendarDays,
  PackageSearch,
} from 'lucide-react';
import InternalNotificationsBell from '@/components/InternalNotificationsBell';
import AccountUserMenu from '@/components/AccountUserMenu';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';

interface TechNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  group?: string;
}

const techNavItems: TechNavItem[] = [
  { to: '/technico', label: 'Tableau de bord', icon: <LayoutDashboard size={20} />, description: 'Vue d\'ensemble' },
  { to: '/technico/clients', label: 'Mes Clients', icon: <Users size={20} />, description: 'Gérer vos clients', group: 'Commercial' },
  { to: '/technico/demandes', label: 'Demandes Devis', icon: <FileText size={20} />, description: 'Demandes reçues', group: 'Commercial' },
  { to: '/technico/devis', label: 'Mes Devis', icon: <FileSpreadsheet size={20} />, description: 'Créer & suivre', group: 'Commercial' },
  { to: '/technico/factures', label: 'Mes factures', icon: <Receipt size={20} />, description: 'Facturer & envoyer', group: 'Commercial' },
  { to: '/technico/commandes-fournisseur', label: 'Commandes fournisseur', icon: <PackageCheck size={20} />, description: 'Achats & réceptions', group: 'Commercial' },
  { to: '/technico/sav', label: 'SAV', icon: <LifeBuoy size={20} />, description: 'Tickets et interventions', group: 'Commercial' },
  { to: '/technico/demo-requests', label: 'Demandes de démo', icon: <CalendarDays size={20} />, description: 'Demandes reçues', group: 'Commercial' },
  { to: '/technico/checklist', label: 'Checklist Devis', icon: <CheckSquare size={20} />, description: 'Générer un devis', group: 'Commercial' },
  { to: '/technico/assistant-ia', label: 'Assistant IA', icon: <Bot size={20} />, description: 'Gérer prospects chatbot', group: 'Commercial' },
  { to: '/technico/prestations', label: 'Prestations', icon: <BookOpen size={20} />, description: 'Catalogue', group: 'Référentiel' },
  { to: '/technico/materiaux', label: 'Matériaux', icon: <PackageSearch size={20} />, description: 'Catalogue matériaux', group: 'Référentiel' },
  { to: '/technico/catalogue', label: 'Catalogue Expert', icon: <Search size={20} />, description: 'Explorer le catalogue', group: 'Référentiel' },
  { to: '/technico/profil', label: 'Mon Profil', icon: <Signature size={20} />, description: 'Ma signature', group: 'Compte' },
];

export default function TechnicoLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user
    ? (user.prenom?.charAt(0) ?? '') + (user.nom?.charAt(0) ?? '')
    : 'TC';

  // Get current page title
  const currentItem = techNavItems.find((item) =>
    item.to === '/technico'
      ? location.pathname === '/technico'
      : location.pathname.startsWith(item.to),
  );
  const pageTitle = currentItem?.label ?? 'Technico-Commercial';

  return (
    <div className="app-shell flex min-h-screen transition-colors duration-300">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR - Technico palette gradient */}
      <aside
        className={cn(
          'fixed h-full z-40 w-72 flex flex-col transition-transform duration-300 lg:translate-x-0',
          'technico-gradient',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
              <Briefcase className="text-[#4F8CFF] w-6 h-6" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-lg leading-tight tracking-tight drop-shadow-md">
                Espace Technico
              </h2>
              <p className="text-blue-100 text-xs font-semibold drop-shadow">Commercial</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden ml-auto text-white/60 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* User card */}
        <div className="mx-4 mb-4 p-3 bg-white/8 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate drop-shadow">
                {user?.prenom} {user?.nom}
              </p>
              <p className="text-xs text-blue-100/80 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {techNavItems.map((item, index) => {
            const prevItems = techNavItems.slice(0, index);
            const prevGroup = [...prevItems].reverse().find((i) => i.group)?.group;
            const showGroup = item.group && item.group !== prevGroup;
            const isActive =
              item.to === '/technico'
                ? location.pathname === '/technico'
                : location.pathname.startsWith(item.to);

            return (
              <div key={item.to}>
                {showGroup && (
                  <p className="px-3 pt-5 pb-2 text-[11px] font-bold text-emerald-400/50 uppercase tracking-widest">
                    {item.group}
                  </p>
                )}
                <NavLink
                  to={item.to}
                  end={item.to === '/technico'}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                    isActive
                      ? 'bg-white/20 text-white shadow-lg shadow-black/10 font-bold drop-shadow'
                      : 'text-white/80 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                      isActive
                        ? 'bg-blue-400/20 text-blue-100'
                        : 'bg-white/10 text-white/50 group-hover:text-white/80',
                    )}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold block drop-shadow">{item.label}</span>
                    <span
                      className={cn(
                        'text-[11px]',
                        isActive ? 'text-blue-100/90 font-bold' : 'text-white/50',
                      )}
                    >
                      {item.description}
                    </span>
                  </div>
                  {isActive && (
                    <ChevronRight size={16} className="text-emerald-300/60" />
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-white/70 hover:bg-red-500/20 hover:text-red-200 transition-all font-semibold"
          >
            <LogOut size={18} />
            <span className="text-sm font-semibold">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-72 min-h-screen">
        {/* Top bar */}
        <header className="app-main-header backdrop-blur-md px-3 sm:px-4 lg:px-8 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-20 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">{pageTitle}</h1>
              <p className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">
                {new Date().toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
              aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <InternalNotificationsBell />
            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700 hidden sm:block" />
            <AccountUserMenu
              displayName={`${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim() || 'Technico'}
              initials={initials || 'TC'}
              roleLabel="Technico-commercial"
              settingsPath="/technico/profil"
            />
          </div>
        </header>


        {/* Page content */}
        <div className="app-content p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
