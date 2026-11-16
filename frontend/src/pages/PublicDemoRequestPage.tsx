import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, Mail, Moon, Phone, Send, Sparkles, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface DemoFormState {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  entreprise: string;
  message: string;
}

const initialForm: DemoFormState = {
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  entreprise: '',
  message: '',
};

const fieldClass =
  'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/30 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500';

export default function PublicDemoRequestPage() {
  const [form, setForm] = useState<DemoFormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('baticrm-theme');
    if (saved === 'dark') setDark(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('baticrm-theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const updateField = (field: keyof DemoFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post('/demo-requests/public', {
        nom: form.nom,
        prenom: form.prenom || undefined,
        email: form.email,
        telephone: form.telephone || undefined,
        entreprise: form.entreprise || undefined,
        message: form.message || undefined,
      });

      setSuccess(true);
      setForm(initialForm);
    } catch {
      setError("Impossible d'envoyer la demande pour le moment. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={dark ? 'dark' : ''}>
      <div
        className={`relative min-h-screen overflow-hidden font-sans transition-colors duration-300 ${
          dark
            ? 'bg-[#0f1117] text-slate-100'
            : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-900'
        }`}
      >
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className={`absolute -right-40 -top-40 h-96 w-96 rounded-full blur-3xl ${
              dark ? 'bg-blue-900/30' : 'bg-blue-400/20'
            }`}
          />
          <div
            className={`absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl ${
              dark ? 'bg-indigo-900/30' : 'bg-indigo-400/20'
            }`}
          />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          <header
            className={`rounded-2xl border px-5 py-4 shadow-sm backdrop-blur-xl ${
              dark
                ? 'border-white/10 bg-[#1a1d2e]/90'
                : 'border-white/50 bg-white/85'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2 text-white shadow-lg shadow-blue-500/30 transition group-hover:scale-105">
                  <Building2 size={18} />
                </div>
                <span
                  className={`text-xl font-extrabold tracking-tight ${
                    dark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Bati<span className="text-blue-600">CRM</span>
                </span>
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDark((current) => !current)}
                  className={`rounded-xl p-2.5 transition hover:scale-105 ${
                    dark
                      ? 'bg-white/10 text-yellow-300 hover:bg-white/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'}
                >
                  {dark ? <Sun size={17} /> : <Moon size={17} />}
                </button>

                <Link
                  to="/login"
                  className={`hidden rounded-xl border px-4 py-2 text-sm font-semibold transition hover:scale-105 sm:inline-flex ${
                    dark
                      ? 'border-white/20 text-slate-200 hover:bg-white/10'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Connexion
                </Link>
              </div>
            </div>
          </header>

          <main className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_0.95fr]">
            <section>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  dark
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    : 'border-blue-200 bg-white/80 text-blue-700'
                }`}
              >
                <Sparkles size={14} />
                Démonstration BatiCRM
              </span>

              <h1
                className={`mt-6 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl ${
                  dark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Découvrez une gestion
                <br />
                <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                  plus simple du BTP
                </span>
              </h1>

              <p
                className={`mt-6 max-w-2xl text-base leading-8 sm:text-lg ${
                  dark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Planifiez une démonstration personnalisée pour découvrir le suivi commercial,
                les devis, les chantiers, la facturation et le SAV dans une seule plateforme.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Suivi commercial centralisé',
                  'Devis, factures et chantiers',
                  'Notifications internes',
                  'Module SAV intégré',
                ].map((item) => (
                  <div
                    key={item}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
                      dark
                        ? 'border-white/10 bg-white/5 text-slate-300'
                        : 'border-slate-200 bg-white/80 text-slate-700'
                    }`}
                  >
                    <CheckCircle2 size={17} className="shrink-0 text-blue-500" />
                    {item}
                  </div>
                ))}
              </div>

              <div
                className={`mt-8 flex flex-wrap gap-3 text-sm ${
                  dark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 ${
                    dark ? 'bg-white/5' : 'bg-white/80'
                  }`}
                >
                  <Mail size={16} />
                  Réponse commerciale
                </span>
                <span
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 ${
                    dark ? 'bg-white/5' : 'bg-white/80'
                  }`}
                >
                  <Phone size={16} />
                  Démo personnalisée
                </span>
              </div>
            </section>

            <section
              className={`rounded-3xl border p-6 shadow-xl backdrop-blur-sm sm:p-8 ${
                dark
                  ? 'border-white/10 bg-[#1a1d2e]/90'
                  : 'border-white/60 bg-white/90'
              }`}
            >
              {success ? (
                <div
                  className={`rounded-2xl border p-7 text-center ${
                    dark
                      ? 'border-emerald-500/20 bg-emerald-500/10'
                      : 'border-emerald-200 bg-emerald-50'
                  }`}
                >
                  <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                      dark
                        ? 'bg-white/10 text-emerald-400'
                        : 'bg-white text-emerald-600 shadow-sm'
                    }`}
                  >
                    <CheckCircle2 size={28} />
                  </div>

                  <h2
                    className={`mt-4 text-xl font-bold ${
                      dark ? 'text-white' : 'text-slate-950'
                    }`}
                  >
                    Demande envoyée
                  </h2>

                  <p
                    className={`mt-2 text-sm leading-6 ${
                      dark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Votre demande de démo a été envoyée avec succès. Notre équipe vous
                    contactera prochainement.
                  </p>

                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.02]"
                  >
                    Envoyer une autre demande
                    <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h2
                      className={`text-2xl font-bold ${
                        dark ? 'text-white' : 'text-slate-950'
                      }`}
                    >
                      Planifier une démo
                    </h2>
                    <p
                      className={`mt-1 text-sm ${
                        dark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      Les champs nom et email sont obligatoires.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      className={fieldClass}
                      required
                      placeholder="Nom *"
                      value={form.nom}
                      onChange={(event) => updateField('nom', event.target.value)}
                    />
                    <input
                      className={fieldClass}
                      placeholder="Prénom"
                      value={form.prenom}
                      onChange={(event) => updateField('prenom', event.target.value)}
                    />
                  </div>

                  <input
                    className={fieldClass}
                    required
                    type="email"
                    placeholder="Email professionnel *"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      className={fieldClass}
                      placeholder="Téléphone"
                      value={form.telephone}
                      onChange={(event) => updateField('telephone', event.target.value)}
                    />
                    <input
                      className={fieldClass}
                      placeholder="Entreprise"
                      value={form.entreprise}
                      onChange={(event) => updateField('entreprise', event.target.value)}
                    />
                  </div>

                  <textarea
                    className={cn(fieldClass, 'min-h-[140px] resize-none')}
                    placeholder="Décrivez votre besoin ou le contexte de la démo"
                    value={form.message}
                    onChange={(event) => updateField('message', event.target.value)}
                  />

                  {error ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                    Envoyer la demande
                  </button>

                  <Link
                    to="/"
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition ${
                      dark
                        ? 'border-white/15 text-slate-300 hover:bg-white/10'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowLeft size={16} />
                    Retour à l’accueil
                  </Link>
                </form>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
