import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Moon,
  PlayCircle,
  Shield,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Gestion des clients',
    description: 'Centralisez les contacts, demandes et informations utiles au suivi commercial.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: FileText,
    title: 'Devis & facturation',
    description: 'Préparez les devis, suivez leur validation et gérez les factures associées.',
    color: 'from-indigo-500 to-violet-500',
  },
  {
    icon: HardHat,
    title: 'Suivi des chantiers',
    description: 'Suivez l’avancement, les tâches, les documents et les intervenants.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Bot,
    title: 'Assistant IA',
    description: 'Aidez les équipes à qualifier les besoins et à exploiter les informations métier.',
    color: 'from-purple-500 to-fuchsia-500',
  },
  {
    icon: BarChart3,
    title: 'Pilotage',
    description: 'Visualisez les indicateurs utiles au suivi commercial et opérationnel.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Shield,
    title: 'SAV & audit',
    description: 'Suivez les réclamations et gardez une trace des actions sensibles.',
    color: 'from-slate-500 to-slate-700',
  },
];

export default function HomeLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const heroRef = useRef<HTMLElement | null>(null);
  const featuresRef = useRef<HTMLElement | null>(null);
  const contactRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('baticrm-theme');
    setDark(saved === 'dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('baticrm-theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  const d = dark;

  return (
    <div className={d ? 'dark' : ''}>
      <div
        className={`relative min-h-screen overflow-hidden font-sans transition-colors duration-300 ${
          d
            ? 'bg-[#0f1117] text-slate-100'
            : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-900'
        }`}
      >
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className={`absolute -right-40 -top-40 h-96 w-96 rounded-full blur-3xl ${
              d ? 'bg-blue-900/30' : 'bg-blue-400/20'
            }`}
          />
          <div
            className={`absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl ${
              d ? 'bg-indigo-900/30' : 'bg-indigo-400/20'
            }`}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
          <header
            className={`sticky top-4 z-50 rounded-2xl border transition-all duration-300 ${
              scrolled ? 'shadow-xl' : 'shadow-sm'
            } ${
              d
                ? 'border-white/10 bg-[#1a1d2e]/90 backdrop-blur-xl'
                : 'border-white/50 bg-white/85 backdrop-blur-xl'
            }`}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => scrollTo(heroRef)}
                className="group flex items-center gap-2.5"
              >
                <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2 text-white shadow-lg shadow-blue-500/30 transition group-hover:scale-105">
                  <Building2 size={18} />
                </div>
                <span
                  className={`text-xl font-extrabold tracking-tight ${
                    d ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Bati<span className="text-blue-600">CRM</span>
                </span>
              </button>

              <nav className="hidden items-center gap-1 md:flex">
                <button
                  type="button"
                  onClick={() => scrollTo(heroRef)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    d
                      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  Accueil
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(featuresRef)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    d
                      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  Fonctionnalités
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(contactRef)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    d
                      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  À propos
                </button>

                <Link
                  to="/demo"
                  className="ml-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.03]"
                >
                  <PlayCircle size={16} />
                  Demander une démo
                </Link>
              </nav>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDark((current) => !current)}
                  className={`rounded-xl p-2.5 transition hover:scale-105 ${
                    d
                      ? 'bg-white/10 text-yellow-300 hover:bg-white/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  aria-label={d ? 'Activer le mode clair' : 'Activer le mode sombre'}
                >
                  {d ? <Sun size={17} /> : <Moon size={17} />}
                </button>

                <Link
                  to="/login"
                  className={`hidden rounded-xl border px-4 py-2 text-sm font-semibold transition sm:inline-flex ${
                    d
                      ? 'border-white/20 text-slate-200 hover:bg-white/10'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Connexion
                </Link>

                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  className={`rounded-lg p-2 md:hidden ${
                    d
                      ? 'text-slate-300 hover:bg-white/10'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  aria-label="Ouvrir le menu"
                >
                  <Menu size={22} />
                </button>
              </div>
            </div>

            {menuOpen && (
              <div
                className={`flex flex-col gap-2 border-t px-5 pb-5 pt-3 md:hidden ${
                  d ? 'border-white/10' : 'border-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => scrollTo(heroRef)}
                  className={`rounded-xl px-4 py-3 text-left text-sm font-medium ${
                    d
                      ? 'text-slate-300 hover:bg-white/10'
                      : 'text-slate-600 hover:bg-blue-50'
                  }`}
                >
                  Accueil
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(featuresRef)}
                  className={`rounded-xl px-4 py-3 text-left text-sm font-medium ${
                    d
                      ? 'text-slate-300 hover:bg-white/10'
                      : 'text-slate-600 hover:bg-blue-50'
                  }`}
                >
                  Fonctionnalités
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(contactRef)}
                  className={`rounded-xl px-4 py-3 text-left text-sm font-medium ${
                    d
                      ? 'text-slate-300 hover:bg-white/10'
                      : 'text-slate-600 hover:bg-blue-50'
                  }`}
                >
                  À propos
                </button>
                <Link
                  to="/demo"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  <PlayCircle size={18} />
                  Demander une démo
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold ${
                    d
                      ? 'border-white/20 text-slate-200'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  Connexion
                </Link>
              </div>
            )}
          </header>

          <section
            ref={heroRef}
            className="grid scroll-mt-24 items-center gap-12 py-16 lg:grid-cols-[1fr_0.95fr]"
          >
            <div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  d
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    : 'border-blue-200 bg-white/80 text-blue-700'
                }`}
              >
                <Sparkles size={14} />
                CRM dédié aux métiers du bâtiment
              </span>

              <h1
                className={`mt-6 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl ${
                  d ? 'text-white' : 'text-slate-900'
                }`}
              >
                Pilotez vos projets
                <br />
                <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                  depuis une seule plateforme
                </span>
              </h1>

              <p
                className={`mt-6 max-w-2xl text-base leading-8 sm:text-lg ${
                  d ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Centralisez clients, devis, chantiers, factures, SAV et suivi administratif
                dans une interface pensée pour les équipes bureau et terrain.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:scale-[1.03]"
                >
                  Demander une démo
                  <ArrowRight size={16} />
                </Link>

                <Link
                  to="/login"
                  className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition ${
                    d
                      ? 'border-white/20 text-slate-200 hover:bg-white/10'
                      : 'border-slate-300 text-slate-700 hover:bg-white'
                  }`}
                >
                  Se connecter
                </Link>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  'Suivi commercial',
                  'Pilotage chantier',
                  'SAV & audit',
                ].map((item) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      d
                        ? 'border-white/10 bg-white/5 text-slate-300'
                        : 'border-slate-200 bg-white/80 text-slate-700'
                    }`}
                  >
                    <CheckCircle2 size={15} className="text-blue-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`rounded-3xl border p-4 shadow-2xl ${
                d
                  ? 'border-white/10 bg-[#1a1d2e]/90'
                  : 'border-white/60 bg-white/90'
              }`}
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50 dark:border-white/10 dark:bg-[#131722]">
                <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                  <div>
                    <p className={`text-sm font-bold ${d ? 'text-white' : 'text-slate-900'}`}>
                      Tableau de bord
                    </p>
                    <p className={`text-xs ${d ? 'text-slate-500' : 'text-slate-400'}`}>
                      Aperçu de l’activité
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    BatiCRM
                  </div>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {[
                    ['Clients', 'Suivi commercial', Users],
                    ['Chantiers', 'Planning & avancement', HardHat],
                    ['Devis', 'Création & validation', FileText],
                    ['SAV', 'Tickets & interventions', Shield],
                  ].map(([label, helper, Icon]) => {
                    const CardIcon = Icon as typeof Users;
                    return (
                      <div
                        key={label as string}
                        className={`rounded-xl border p-4 ${
                          d
                            ? 'border-white/10 bg-white/5'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                            <CardIcon size={18} />
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${d ? 'text-white' : 'text-slate-900'}`}>
                              {label as string}
                            </p>
                            <p className={`text-xs ${d ? 'text-slate-500' : 'text-slate-500'}`}>
                              {helper as string}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 pb-4">
                  <div
                    className={`rounded-xl border p-4 ${
                      d
                        ? 'border-white/10 bg-white/5'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BarChart3 size={17} className="text-blue-500" />
                      <p className={`text-sm font-semibold ${d ? 'text-white' : 'text-slate-900'}`}>
                        Suivi des indicateurs
                      </p>
                    </div>
                    <div className="mt-4 flex h-24 items-end gap-2">
                      {[32, 48, 40, 64, 55, 76, 68, 88].map((height, index) => (
                        <div
                          key={`${height}-${index}`}
                          className="flex-1 rounded-t-md bg-gradient-to-t from-blue-600 to-indigo-400"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section ref={featuresRef} className="scroll-mt-24 py-8">
            <div className="text-center">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  d
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                    : 'border-purple-200 bg-white/80 text-purple-700'
                }`}
              >
                <Layers size={14} />
                Fonctionnalités
              </span>
              <h2
                className={`mt-4 text-3xl font-extrabold sm:text-4xl ${
                  d ? 'text-white' : 'text-slate-900'
                }`}
              >
                Les outils essentiels réunis au même endroit
              </h2>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className={`group rounded-2xl border p-6 transition hover:-translate-y-1 hover:shadow-xl ${
                      d
                        ? 'border-white/10 bg-white/5'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div
                      className={`inline-flex rounded-xl bg-gradient-to-br ${feature.color} p-3 text-white shadow-lg transition group-hover:scale-105`}
                    >
                      <Icon size={21} />
                    </div>
                    <h3
                      className={`mt-4 text-base font-bold ${
                        d ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className={`mt-2 text-sm leading-6 ${
                        d ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section
            ref={contactRef}
            className="scroll-mt-24 py-12"
          >
            <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-2xl shadow-blue-500/20 sm:p-12">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    <MessageSquare size={14} />
                    Démonstration
                  </div>
                  <h2 className="mt-4 text-3xl font-extrabold">
                    Découvrez BatiCRM avec votre propre besoin
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">
                    Remplissez la demande de démonstration. L’équipe pourra ensuite vous
                    recontacter et planifier un échange adapté à votre contexte.
                  </p>
                </div>

                <Link
                  to="/demo"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-blue-700 shadow-lg transition hover:scale-[1.03]"
                >
                  Demander une démo
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
