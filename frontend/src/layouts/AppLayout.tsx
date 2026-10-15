import { Building2, ChevronDown, ChevronRight, LogOut, Menu, Moon, Sun, UserCircle2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatches } from 'react-router-dom';
import { ROLE_LABELS, type Role } from '@/shared';
import { navigationFor } from '@/app/navigation';
import { useAuth } from '@/features/auth/auth-context';
import { enPhrase, useDemoInfo } from '@/features/demo/sandbox';
import { useCompany } from '@/features/devis/api';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { useDarkMode } from '@/lib/theme';

const STAFF_ROLES: Role[] = ['ADMIN', 'TECHNICO', 'ASSISTANTE', 'CHEF_CHANTIER'];

/** Small label above the logo and the page title (old app: "Espace admin", "Administration"…). */
const ESPACE: Record<Role, { sidebar: string; header: string }> = {
  ADMIN: { sidebar: 'Espace admin', header: 'Administration' },
  TECHNICO: { sidebar: 'Espace technico', header: 'Technico-commercial' },
  ASSISTANTE: { sidebar: 'Espace assistante', header: 'Assistante' },
  CHEF_CHANTIER: { sidebar: 'Espace chef de chantier', header: 'Chef de chantier' },
  SOUS_TRAITANT: { sidebar: 'Espace sous-traitant', header: 'Sous-traitant' },
  FOURNISSEUR: { sidebar: 'Espace fournisseur', header: 'Fournisseur' },
};

/** Shell of every signed-in page, in the old BÂTIFLOW design: blue gradient sidebar + white top bar. */
export function AppLayout() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const location = useLocation();
  const matches = useMatches();
  const company = useCompany(!!user && STAFF_ROLES.includes(user.role));
  const title = [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean) ?? 'Tableau de bord';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.title = `${title} · ${BRAND.name}`;
  }, [title]);

  if (!user) return null;
  const sections = navigationFor(user.role);
  const initials = `${user.prenom[0] ?? ''}${user.nom[0] ?? ''}`.toUpperCase() || 'A';
  const displayName = `${user.prenom} ${user.nom}`.trim();

  return (
    <div className="flex min-h-screen text-slate-900 dark:text-slate-100">
      {mobileOpen && (
        <button type="button" className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />
      )}

      <aside
        className={cn(
          'sidebar-gradient no-print fixed inset-y-0 left-0 z-50 flex w-[292px] flex-col text-white shadow-2xl shadow-slate-900/20 transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-label="Navigation principale"
      >
        {/* Logo */}
        <div className="border-b border-white/15 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/20">
              <Building2 className="size-[23px]" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">{ESPACE[user.role].sidebar}</p>
              <p className="truncate text-lg font-bold">{BRAND.name}</p>
            </div>
            <button type="button" onClick={() => setMobileOpen(false)} className="ml-auto rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fermer le menu">
              <X className="size-[18px]" />
            </button>
          </div>
          {company.data?.nom && <p className="mt-3 truncate rounded-xl bg-white/10 px-3 py-1.5 text-xs text-cyan-50/90">{company.data.nom}</p>}
        </div>

        {/* Navigation: groups, icon squares, label + description, chevron on the active item */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section, i) => (
            <div key={section.section}>
              <p className={cn('px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/55', i > 0 && 'pt-4')}>{section.section}</p>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all',
                      isActive ? 'bg-white/20 text-white shadow-lg shadow-slate-900/10 ring-1 ring-white/15' : 'text-white/80 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl transition', isActive ? 'bg-white/20 text-cyan-50' : 'bg-white/10 text-cyan-100/70')}>
                        <item.icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{item.label}</span>
                        <span className={cn('block truncate text-[11px]', isActive ? 'text-cyan-50/90' : 'text-cyan-100/55')}>{item.description}</span>
                      </span>
                      {isActive && <ChevronRight className="size-4 text-cyan-100/80" aria-hidden />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Profile at the bottom of the sidebar */}
        <div className="border-t border-white/15 px-4 py-4">
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-sm font-bold text-brand-700">{initials}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-xs text-cyan-100/70">{ROLE_LABELS[user.role]}</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/75 transition hover:bg-red-500/25 hover:text-red-100"
                title="Se déconnecter"
                aria-label="Se déconnecter"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen min-w-0 flex-1 lg:ml-[292px]">
        <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur transition-colors dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Ouvrir le menu"
              >
                {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-blue-400">{ESPACE[user.role].header}</p>
                <p className="truncate text-base font-bold text-slate-900 sm:text-lg dark:text-slate-100">{title}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setDark((d) => !d)}
                className="flex size-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title={dark ? 'Mode clair' : 'Mode sombre'}
                aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'}
              >
                {dark ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
              </button>
              <NotificationsBell />
              <div className="hidden h-8 w-px bg-slate-200 sm:block dark:bg-slate-700" aria-hidden />
              <AccountMenu displayName={displayName} initials={initials} roleLabel={ROLE_LABELS[user.role]} onSignOut={signOut} />
            </div>
          </div>
        </header>
        <DemoBanner />
        <div className="mx-auto min-w-0 max-w-[1440px] px-3 py-4 sm:px-4 sm:py-5 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/** Old "AccountUserMenu": avatar + name + role, dropdown with profile and sign-out. */
function AccountMenu({ displayName, initials, roleLabel, onSignOut }: { displayName: string; initials: string; roleLabel: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu de ${displayName}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-700 text-xs font-semibold text-white">{initials}</span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[150px] truncate text-[13px] font-semibold leading-none text-slate-950 dark:text-slate-100">{displayName}</span>
          <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{roleLabel}</span>
        </span>
        <ChevronDown className={cn('hidden size-[15px] text-slate-400 transition sm:block', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-[110] mt-2 w-64 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-700 text-sm font-semibold text-white">{initials}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{displayName}</p>
                <p className="mt-0.5 text-xs text-slate-500">{roleLabel}</p>
              </div>
            </div>
          </div>
          <div className="p-2">
            <Link
              to="/profil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <UserCircle2 className="size-[17px]" aria-hidden /> Mon profil
            </Link>
            <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <LogOut className="size-[17px]" aria-hidden /> Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Online demo (Step 15): reminds visitors that the data is fictitious and reset every night. */
function DemoBanner() {
  const demo = useDemoInfo();
  if (!demo.data?.actif) return null;
  return (
    <p className="no-print border-b border-purple-200 bg-purple-50 px-4 py-2 text-center text-xs text-purple-900 lg:px-8 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200">
      <strong>Démo en ligne</strong> — données fictives, partagées entre visiteurs et remises à zéro {enPhrase(demo.data.reinitialisation)}. Aucun email n’est envoyé.
    </p>
  );
}
