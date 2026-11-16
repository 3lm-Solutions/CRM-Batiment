import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Copy,
  FilePlus2,
  Gauge,
  History,
  ListChecks,
  Printer,
  RefreshCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

interface WorkRoute {
  to: string;
  label: string;
  scope: string;
  keywords: string;
  roles?: Role[];
}

interface RecentPage {
  to: string;
  label: string;
  at: number;
}

const RECENT_KEY = 'baticrm_recent_pages';

const routes: WorkRoute[] = [
  { to: '/admin', label: 'Tableau de bord', scope: 'Admin', keywords: 'dashboard statistiques pilotage', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/chantiers', label: 'Chantiers', scope: 'Admin', keywords: 'chantier travaux planning suivi', roles: ['ADMIN', 'ASSISTANTE', 'CHEF_CHANTIER'] },
  { to: '/admin/clients', label: 'Clients', scope: 'Admin', keywords: 'client prospect contact adresse', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/demandes-devis', label: 'Demandes devis', scope: 'Admin', keywords: 'demande devis prospect besoin', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/devis', label: 'Devis', scope: 'Admin', keywords: 'devis offre prix signature', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/factures', label: 'Factures', scope: 'Admin', keywords: 'facture paiement acompte', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/checklist', label: 'Checklist devis', scope: 'Admin', keywords: 'diagnostic checklist generation devis', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/commandes-fournisseur', label: 'Commandes fournisseur', scope: 'Admin', keywords: 'commande fournisseur livraison reception achat', roles: ['ADMIN', 'ASSISTANTE', 'CHEF_CHANTIER'] },
  { to: '/admin/taches-chantier', label: 'Taches chantier', scope: 'Terrain', keywords: 'tache chantier avancement equipe', roles: ['ADMIN', 'CHEF_CHANTIER'] },
  { to: '/admin/prestations', label: 'Prestations', scope: 'Referentiel', keywords: 'catalogue prestation travaux', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/materiaux', label: 'Materiaux', scope: 'Referentiel', keywords: 'materiau prix achat stock fournisseur', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/services-mo', label: 'Services main d oeuvre', scope: 'Referentiel', keywords: 'service main oeuvre cout temps', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/fournisseurs', label: 'Fournisseurs', scope: 'Referentiel', keywords: 'fournisseur contact tarif', roles: ['ADMIN', 'ASSISTANTE'] },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', scope: 'Administration', keywords: 'utilisateur role compte equipe', roles: ['ADMIN'] },
  { to: '/admin/base-ia', label: 'Base IA', scope: 'Administration', keywords: 'rag document ia assistant', roles: ['ADMIN'] },
  { to: '/admin/parametres-chiffrage', label: 'Parametres chiffrage', scope: 'Administration', keywords: 'chiffrage calcul marge tva', roles: ['ADMIN'] },

  { to: '/technico', label: 'Tableau de bord technico', scope: 'Technico', keywords: 'dashboard activite commercial', roles: ['TECHNICO'] },
  { to: '/technico/clients', label: 'Mes clients', scope: 'Technico', keywords: 'client contact prospect', roles: ['TECHNICO'] },
  { to: '/technico/demandes', label: 'Demandes devis', scope: 'Technico', keywords: 'demande devis prospect', roles: ['TECHNICO'] },
  { to: '/technico/devis', label: 'Mes devis', scope: 'Technico', keywords: 'devis offre signature', roles: ['TECHNICO'] },
  { to: '/technico/factures', label: 'Mes factures', scope: 'Technico', keywords: 'facture paiement', roles: ['TECHNICO'] },
  { to: '/technico/checklist', label: 'Checklist devis', scope: 'Technico', keywords: 'diagnostic checklist generer devis', roles: ['TECHNICO'] },
  { to: '/technico/assistant-ia', label: 'Assistant IA', scope: 'Technico', keywords: 'ia assistant prospect chatbot', roles: ['TECHNICO'] },
  { to: '/technico/catalogue', label: 'Catalogue expert', scope: 'Technico', keywords: 'catalogue prestation materiau', roles: ['TECHNICO'] },
  { to: '/technico/profil', label: 'Mon profil', scope: 'Technico', keywords: 'profil signature compte', roles: ['TECHNICO'] },

  { to: '/fournisseur', label: 'Mes commandes', scope: 'Fournisseur', keywords: 'commande fournisseur livraison reception', roles: ['SOUS_TRAITANT'] },
];

const routeAllowed = (role: Role | undefined, route: WorkRoute) =>
  !route.roles || (role ? route.roles.includes(role) : false);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getDashboardPath = (role: Role | undefined) => {
  if (role === 'TECHNICO') return '/technico';
  if (role === 'SOUS_TRAITANT') return '/fournisseur';
  return '/admin';
};

const readRecentPages = (): RecentPage[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentPage[];
  } catch {
    return [];
  }
};

export default function WorkAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const [copied, setCopied] = useState(false);

  const availableRoutes = useMemo(
    () => routes.filter((route) => routeAllowed(user?.role, route)),
    [user?.role],
  );

  const currentRoute = useMemo(() => {
    return [...availableRoutes]
      .sort((a, b) => b.to.length - a.to.length)
      .find((route) =>
        route.to === location.pathname ? true : location.pathname.startsWith(`${route.to}/`),
      );
  }, [availableRoutes, location.pathname]);

  useEffect(() => {
    const nextPage: RecentPage = {
      to: location.pathname,
      label: currentRoute?.label ?? 'Page actuelle',
      at: Date.now(),
    };
    const nextRecent = [
      nextPage,
      ...readRecentPages().filter((page) => page.to !== location.pathname),
    ].slice(0, 6);

    localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent));
    setRecentPages(nextRecent);
  }, [currentRoute?.label, location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setCopied(false);
    }
  }, [open]);

  const filteredRoutes = useMemo(() => {
    const cleanQuery = normalize(query.trim());
    if (!cleanQuery) return availableRoutes.slice(0, 8);

    return availableRoutes
      .filter((route) => normalize(`${route.label} ${route.scope} ${route.keywords}`).includes(cleanQuery))
      .slice(0, 10);
  }, [availableRoutes, query]);

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const copyCurrentLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const quickActions = [
    {
      label: 'Retour tableau de bord',
      helper: 'Revenir a la vue principale',
      icon: <Gauge size={17} />,
      onClick: () => goTo(getDashboardPath(user?.role)),
    },
    {
      label: 'Preparer un devis',
      helper: 'Ouvrir la checklist devis',
      icon: <FilePlus2 size={17} />,
      onClick: () => goTo(user?.role === 'TECHNICO' ? '/technico/checklist' : '/admin/checklist'),
      hidden: user?.role === 'SOUS_TRAITANT' || user?.role === 'CHEF_CHANTIER',
    },
    {
      label: 'Suivre les commandes',
      helper: 'Commandes et receptions',
      icon: <ListChecks size={17} />,
      onClick: () => goTo(user?.role === 'SOUS_TRAITANT' ? '/fournisseur' : '/admin/commandes-fournisseur'),
    },
    {
      label: copied ? 'Lien copie' : 'Copier le lien',
      helper: 'Partager cette page',
      icon: <Copy size={17} />,
      onClick: copyCurrentLink,
    },
    {
      label: 'Imprimer',
      helper: 'Sortie papier/PDF',
      icon: <Printer size={17} />,
      onClick: () => window.print(),
    },
    {
      label: 'Rafraichir',
      helper: 'Recharger la page',
      icon: <RefreshCcw size={17} />,
      onClick: () => window.location.reload(),
    },
  ].filter((action) => !action.hidden);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden min-w-[220px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 md:flex"
        title="Rechercher une page ou une action"
      >
        <span className="flex items-center gap-2">
          <Search size={15} className="text-slate-400" />
          <span>Actions rapides</span>
        </span>
        <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-600 dark:bg-slate-900">
          Ctrl K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 md:hidden"
        aria-label="Actions rapides"
      >
        <Sparkles size={17} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <Search size={18} className="text-[#185FA5] dark:text-blue-300" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une page, une action, un module..."
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid max-h-[70vh] overflow-y-auto lg:grid-cols-[1fr_280px]">
              <div className="border-b border-slate-100 p-3 dark:border-slate-800 lg:border-b-0 lg:border-r">
                <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Pages
                </p>
                <div className="space-y-1">
                  {filteredRoutes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                      Aucun resultat pour cette recherche.
                    </div>
                  ) : (
                    filteredRoutes.map((route) => (
                      <button
                        key={route.to}
                        type="button"
                        onClick={() => goTo(route.to)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800',
                          location.pathname === route.to && 'bg-blue-50 dark:bg-blue-950/30',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {route.label}
                          </span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {route.scope} - {route.to}
                          </span>
                        </span>
                        <ArrowRight size={16} className="shrink-0 text-slate-300" />
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4 p-3">
                <div>
                  <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Actions
                  </p>
                  <div className="grid gap-1">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#185FA5] dark:bg-blue-950/40 dark:text-blue-300">
                          {action.icon}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {action.label}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {action.helper}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="flex items-center gap-2 px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    <History size={13} />
                    Recent
                  </p>
                  <div className="space-y-1">
                    {recentPages.slice(0, 4).map((page) => (
                      <button
                        key={page.to}
                        type="button"
                        onClick={() => goTo(page.to)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <span className="truncate">{page.label}</span>
                        <Clock size={13} className="shrink-0 text-slate-300" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
