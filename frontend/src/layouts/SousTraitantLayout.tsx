import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Menu,
  UserCircle,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  {
    to: '/sous-traitant',
    label: 'Tableau de bord',
    icon: <ClipboardList size={18} />,
  },
  {
    to: '/sous-traitant/chantiers',
    label: 'Mes chantiers',
    icon: <Building2 size={18} />,
  },
  {
    to: '/sous-traitant/taches',
    label: 'Mes tâches',
    icon: <CheckCircle2 size={18} />,
  },
];

export default function SousTraitantLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user
    ? `${user.prenom?.charAt(0) ?? ''}${user.nom?.charAt(0) ?? ''}` || 'ST'
    : 'ST';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-stone-100/70">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed z-50 flex h-full w-[280px] flex-col bg-[linear-gradient(180deg,#065f46_0%,#047857_48%,#059669_100%)] text-slate-50 transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-emerald-700 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 font-semibold text-emerald-950">
              <Wrench size={20} />
            </div>
            <span className="font-semibold">Sous-traitant</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-100'
                    : 'text-emerald-50 hover:bg-emerald-500/10',
                )
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/sous-traitant/profil"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
              isActive ? 'bg-emerald-500/20 text-emerald-100' : 'text-emerald-50 hover:bg-emerald-500/10',
            )}
          >
            <UserCircle size={18} />
            <span>Mon profil</span>
          </NavLink>
        </nav>

        <div className="border-t border-emerald-700 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-emerald-50 transition-colors hover:bg-emerald-500/10"
          >
            <LogOut size={18} />
            <span>Deconnexion</span>
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:ml-[280px]">
        <header className="sticky top-0 z-40 border-b border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 lg:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden"
            >
              <Menu size={24} />
            </button>

            <div className="flex flex-1 items-center justify-end gap-4">
              <button
                className="rounded-lg p-2 hover:bg-stone-100"
              >
                <Bell size={20} />
              </button>

              <div className="flex items-center gap-3 border-l border-stone-200 pl-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {user?.prenom} {user?.nom}
                  </p>
                  <p className="text-xs text-slate-500">Sous-traitant</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 font-semibold text-white">
                  {initials}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
