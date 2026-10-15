import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  FileText,
  HardHat,
  Layers,
  Menu,
  MessageSquare,
  MonitorPlay,
  Moon,
  PlayCircle,
  Shield,
  Sparkles,
  Sun,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { useDarkMode } from '@/lib/theme';
import { ChatLauncher, openChat } from '../assistant/ChatLauncher';
import { DEMO_URL, useDemoInfo } from '../demo/sandbox';

const FEATURES: { icon: LucideIcon; title: string; description: string; color: string }[] = [
  { icon: Users, title: 'Gestion des clients', description: 'Centralisez les contacts, demandes et informations utiles au suivi commercial.', color: 'from-blue-500 to-cyan-500' },
  { icon: FileText, title: 'Devis & facturation', description: 'Préparez les devis, faites-les signer en ligne, puis suivez acomptes, situations et factures.', color: 'from-indigo-500 to-violet-500' },
  { icon: HardHat, title: 'Suivi des chantiers', description: 'Suivez l’avancement, les tâches, les documents, les sous-traitants et les commandes.', color: 'from-amber-500 to-orange-500' },
  { icon: Bot, title: 'Assistant IA', description: 'Un chatbot qualifie vos prospects 24 h/24 et l’IA prépare les lignes de vos devis.', color: 'from-purple-500 to-fuchsia-500' },
  { icon: BarChart3, title: 'Pilotage', description: 'Visualisez les indicateurs utiles au suivi commercial et opérationnel.', color: 'from-emerald-500 to-teal-500' },
  { icon: Shield, title: 'SAV & audit', description: 'Suivez les réclamations et gardez une trace des actions sensibles.', color: 'from-slate-500 to-slate-700' },
];

const APERCU: [string, string, LucideIcon][] = [
  ['Clients', 'Suivi commercial', Users],
  ['Chantiers', 'Planning & avancement', HardHat],
  ['Devis', 'Création & signature', FileText],
  ['SAV', 'Tickets & interventions', Shield],
];

const NAV_BTN =
  'rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white';

/** Public home page ("page d'accueil" of the old app), shown at / to visitors who are not signed in. */
export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const [scrolled, setScrolled] = useState(false);
  const demo = useDemoInfo();
  const essai = demo.data?.actif ? '/login' : DEMO_URL ? `${DEMO_URL.replace(/\/$/, '')}/login` : null;

  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = `${BRAND.name} — ${BRAND.tagline}`;
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (ref: RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-900 transition-colors duration-300 dark:from-[#0f1117] dark:via-[#0f1117] dark:to-[#0f1117] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-40 -top-40 size-96 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-900/30" />
        <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-900/30" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* ── Top bar ── */}
        <header
          className={cn(
            'sticky top-4 z-40 rounded-2xl border border-white/50 bg-white/85 backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-[#1a1d2e]/90',
            scrolled ? 'shadow-xl' : 'shadow-sm',
          )}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <button type="button" onClick={() => scrollTo(heroRef)} className="group flex items-center gap-2.5" aria-label={`${BRAND.name} — haut de page`}>
              <span className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2 text-white shadow-lg shadow-blue-500/30 transition group-hover:scale-105">
                <Building2 className="size-[18px]" aria-hidden />
              </span>
              <span className="text-xl font-extrabold tracking-tight">
                {BRAND.prefix}
                <span className="text-blue-600">{BRAND.suffix}</span>
              </span>
            </button>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
              <button type="button" onClick={() => scrollTo(heroRef)} className={NAV_BTN}>Accueil</button>
              <button type="button" onClick={() => scrollTo(featuresRef)} className={NAV_BTN}>Fonctionnalités</button>
              <button type="button" onClick={() => scrollTo(contactRef)} className={NAV_BTN}>À propos</button>
              <Link
                to="/demo"
                className="ml-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.03]"
              >
                <PlayCircle className="size-4" aria-hidden /> Demander une démo
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDark((d) => !d)}
                className="rounded-xl bg-slate-100 p-2.5 text-slate-600 transition hover:scale-105 hover:bg-slate-200 dark:bg-white/10 dark:text-yellow-300 dark:hover:bg-white/20"
                aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'}
              >
                {dark ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
              </button>
              <Link
                to="/login"
                className="hidden rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Connexion
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-white/10"
                aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X className="size-[22px]" /> : <Menu className="size-[22px]" />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 pb-5 pt-3 md:hidden dark:border-white/10">
              <button type="button" onClick={() => scrollTo(heroRef)} className={cn(NAV_BTN, 'py-3 text-left')}>Accueil</button>
              <button type="button" onClick={() => scrollTo(featuresRef)} className={cn(NAV_BTN, 'py-3 text-left')}>Fonctionnalités</button>
              <button type="button" onClick={() => scrollTo(contactRef)} className={cn(NAV_BTN, 'py-3 text-left')}>À propos</button>
              <Link to="/demo" className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white">
                <PlayCircle className="size-[18px]" aria-hidden /> Demander une démo
              </Link>
              <Link to="/login" className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:border-white/20 dark:text-slate-200">
                Connexion
              </Link>
            </div>
          )}
        </header>

        <main>
          {/* ── Hero ── */}
          <section ref={heroRef} className="grid scroll-mt-24 items-center gap-12 py-16 lg:grid-cols-[1fr_0.95fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-1.5 text-sm font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">
                <Sparkles className="size-3.5" aria-hidden /> CRM dédié aux métiers du bâtiment
              </span>
              <h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                Pilotez vos projets
                <br />
                <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">depuis une seule plateforme</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-400">
                Centralisez clients, devis, chantiers, factures, SAV et suivi administratif dans une interface pensée pour les équipes bureau et terrain.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:scale-[1.03]"
                >
                  Demander une démo <ArrowRight className="size-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={openChat}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 dark:border-blue-500/30 dark:bg-white/5 dark:text-blue-300"
                >
                  <Bot className="size-4" aria-hidden /> Estimer mes travaux
                </button>
                {essai && (
                  <a
                    href={essai}
                    className="inline-flex items-center gap-2 rounded-full border border-purple-300 bg-purple-50 px-6 py-3 text-sm font-semibold text-purple-800 transition hover:bg-purple-100 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-200"
                  >
                    <MonitorPlay className="size-4" aria-hidden /> Essayer la démo en ligne
                  </a>
                )}
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Se connecter
                </Link>
              </div>

              <ul className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {['Suivi commercial', 'Pilotage chantier', 'SAV & audit'].map((item) => (
                  <li key={item} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    <CheckCircle2 className="size-[15px] text-blue-500" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Illustration: a mini dashboard (not real figures) */}
            <div className="rounded-3xl border border-white/60 bg-white/90 p-4 shadow-2xl dark:border-white/10 dark:bg-[#1a1d2e]/90" aria-hidden>
              <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50 dark:border-white/10 dark:bg-[#131722]">
                <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                  <div>
                    <p className="text-sm font-bold">Tableau de bord</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Aperçu de l’activité</p>
                  </div>
                  <span className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{BRAND.name}</span>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {APERCU.map(([label, helper, Icon]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"><Icon className="size-[18px]" /></span>
                        <div>
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-xs text-slate-500">{helper}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="size-[17px] text-blue-500" />
                      <p className="text-sm font-semibold">Suivi des indicateurs</p>
                    </div>
                    <div className="mt-4 flex h-24 items-end gap-2">
                      {[32, 48, 40, 64, 55, 76, 68, 88].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-blue-600 to-indigo-400" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Features ── */}
          <section ref={featuresRef} className="scroll-mt-24 py-8" aria-labelledby="fonctionnalites">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white/80 px-4 py-1.5 text-sm font-semibold text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-400">
                <Layers className="size-3.5" aria-hidden /> Fonctionnalités
              </span>
              <h2 id="fonctionnalites" className="mt-4 text-3xl font-extrabold sm:text-4xl">Les outils essentiels réunis au même endroit</h2>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description, color }) => (
                <article
                  key={title}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5"
                >
                  <span className={cn('inline-flex rounded-xl bg-gradient-to-br p-3 text-white shadow-lg transition group-hover:scale-105', color)}>
                    <Icon className="size-[21px]" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
                </article>
              ))}
            </div>
          </section>

          {/* ── Call to action ── */}
          <section ref={contactRef} className="scroll-mt-24 py-12" aria-labelledby="demonstration">
            <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-2xl shadow-blue-500/20 sm:p-12">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    <MessageSquare className="size-3.5" aria-hidden /> Démonstration
                  </span>
                  <h2 id="demonstration" className="mt-4 text-3xl font-extrabold">Découvrez {BRAND.prefix}{BRAND.suffix} avec votre propre besoin</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">
                    Remplissez la demande de démonstration : l’équipe vous recontacte pour planifier un échange adapté à votre activité.
                    Une question tout de suite ? L’assistant en bas à droite vous répond.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-3">
                  <Link
                    to="/demo"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-blue-700 shadow-lg transition hover:scale-[1.03]"
                  >
                    Demander une démo <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    onClick={openChat}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <Bot className="size-4" aria-hidden /> Parler à l’assistant
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-6 text-sm text-slate-500 dark:border-white/10">
          <span>© {new Date().getFullYear()} {BRAND.name} — {BRAND.tagline}</span>
          <span className="flex gap-4">
            <Link to="/demo" className="hover:text-blue-700">Demander une démo</Link>
            <Link to="/login" className="hover:text-blue-700">Connexion</Link>
          </span>
        </footer>
      </div>

      {/* As in the old app: the chatbot is available on the home page */}
      <ChatLauncher />
    </div>
  );
}
