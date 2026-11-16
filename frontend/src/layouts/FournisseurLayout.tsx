import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ClipboardList,
  LogOut,
  Menu,
  PackageCheck,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  {
    to: '/fournisseur',
    label: 'Mes commandes',
    icon: <ClipboardList size={18} />,
  },
];

export default function FournisseurLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user
    ? `${user.prenom?.charAt(0) ?? ''}${user.nom?.charAt(0) ?? ''}` || 'F'
    : 'F';

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
          'fixed z-50 flex h-full w-[280px] flex-col bg-[linear-gradient(180deg,#173042_0%,#20475f_48%,#2d6072_100%)] text-slate-200 transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-slate-900 shadow-lg shadow-amber-300/30">
              <PackageCheck size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                Portail fournisseur
              </p>
              <h1 className="text-lg font-bold text-white">BATIFLOW Supply</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white/12 text-white shadow-sm'
                    : 'text-slate-200/75 hover:bg-white/8 hover:text-white',
                )
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="rounded-2xl bg-white/8 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-300 font-bold text-slate-900">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {user?.prenom} {user?.nom}
                </p>
                <p className="truncate text-xs text-slate-300">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-slate-100 transition-colors hover:bg-red-500/20 hover:text-red-200"
                title="Se deconnecter"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-[280px]">
        <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen((value) => !value)}
                className="rounded-xl p-2 text-slate-600 hover:bg-stone-200 lg:hidden"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Espace fournisseur
                </p>
                <p className="text-sm text-slate-600">
                  Suivi des disponibilites, livraisons et receptions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 sm:flex">
                <Search size={15} className="text-slate-400" />
                <span className="text-sm text-slate-400">
                  Recherche locale sur vos commandes
                </span>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-stone-200">
                <Bell size={17} />
              </div>

              <div className="hidden items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-stone-200 md:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-700 text-white">
                  <Building2 size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {user?.prenom} {user?.nom}
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Fournisseur connecte
                  </p>
                </div>
              </div>
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
