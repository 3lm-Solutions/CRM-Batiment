import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface AccountUserMenuProps {
  displayName: string;
  initials: string;
  roleLabel: string;
  settingsPath?: string;
}

export default function AccountUserMenu({
  displayName,
  initials,
  roleLabel,
  settingsPath,
}: AccountUserMenuProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Ouvrir le menu de ${displayName}`}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs font-semibold text-white">
          {initials}
        </div>

        <div className="hidden min-w-0 text-left sm:block">
          <p className="max-w-[150px] truncate text-[13px] font-semibold leading-none text-slate-950">
            {displayName}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {roleLabel}
          </p>
        </div>

        <ChevronDown
          size={15}
          className={cn(
            'hidden text-slate-400 transition sm:block',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[110] mt-2 w-64 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.16)]"
        >
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-sm font-semibold text-white">
                {initials}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {displayName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="p-2">
            {settingsPath && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    navigate(settingsPath);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings size={17} />
                  Paramètres
                </button>

                <div className="my-2 h-px bg-slate-100" />
              </>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={17} />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}