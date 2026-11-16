import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  ClipboardCheck,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  UserCircle2,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import InternalNotificationsBell from '@/components/InternalNotificationsBell';
import { cn } from '@/lib/utils';

const navItems = [
  {
    to: '/chef-chantier',
    label: 'Tableau de bord',
    icon: <LayoutDashboard size={18} />,
  },
  {
    to: '/chef-chantier/chantiers',
    label: 'Chantiers',
    icon: <HardHat size={18} />,
  },
  {
    to: '/chef-chantier/taches-chantier',
    label: 'Taches chantier',
    icon: <CheckSquare size={18} />,
  },
  {
    to: '/chef-chantier/receptions',
    label: 'Receptions',
    icon: <ClipboardCheck size={18} />,
  },
  {
    to: '/chef-chantier/parametres',
    label: 'Mon Profil',
    icon: <UserCircle2 size={18} />,
  },
];

export default function ChefChantierLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user
    ? `${user.prenom?.charAt(0) ?? ''}${user.nom?.charAt(0) ?? ''}` || 'C'
    : 'C';

  const currentItem = navItems.find((item) =>
    item.to === '/chef-chantier'
      ? location.pathname === '/chef-chantier'
      : location.pathname.startsWith(item.to),
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-amber-50/40">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed z-50 flex h-full w-[280px] flex-col text-amber-100 transition-transform duration-300 lg:translate-x-0',
          'bg-[linear-gradient(180deg,#7c2d12_0%,#9a3412_55%,#b45309_100%)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-b border-white/15 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg">
              <HardHat size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/90">
                Espace terrain
              </p>
              <h1 className="text-lg font-bold text-white">Chef de chantier</h1>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto rounded-lg p-1 text-amber-100/70 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white/18 text-white shadow-sm'
                    : 'text-amber-100/80 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/15 px-4 py-4">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {user?.prenom} {user?.nom}
                </p>
                <p className="truncate text-xs text-amber-100/80">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-red-500/25"
                title="Se deconnecter"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-[280px]">
        <header className="sticky top-0 z-30 border-b border-amber-200/70 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen((value) => !value)}
                className="rounded-xl p-2 text-slate-600 hover:bg-amber-100 lg:hidden"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Interface dediee
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {currentItem?.label ?? 'Espace chef de chantier'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 sm:flex">
                <Search size={15} className="text-amber-700" />
                <span className="text-sm text-amber-800">Navigation chantier</span>
              </div>
              <InternalNotificationsBell />
            </div>
          </div>
        </header>

        <div className="px-4 py-5 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
