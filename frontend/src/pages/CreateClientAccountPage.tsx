// CreateClientAccountPage.tsx - Version corrigée
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Home,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';

type ClientAccountForm = {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresseClient: string;
};

const emptyForm: ClientAccountForm = {
  nom: '',
  prenom: '',
  telephone: '',
  email: '',
  adresseClient: '',
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function CreateClientAccountPage() {
  const [form, setForm] = useState<ClientAccountForm>(emptyForm);
  const [successMessage, setSuccessMessage] = useState('');

  const createClientAccount = useMutation({
    mutationFn: async (payload: ClientAccountForm) => {
      const normalized = {
        nom: payload.nom.trim(),
        prenom: payload.prenom.trim(),
        telephone: payload.telephone.trim(),
        email: payload.email.trim().toLowerCase(),
        adresseClient: payload.adresseClient.trim(),
      };

      const response = await api.post(
        '/clients/public-account',
        normalized,
      );

      return response.data;
    },

    onSuccess: (response) => {
      setForm(emptyForm);

      setSuccessMessage(
        response?.message ||
          'Client créé avec le rôle CLIENT. Il peut se connecter avec son email et son numéro de téléphone comme mot de passe.',
      );
    },
  });

  const updateField = (
    field: keyof ClientAccountForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setSuccessMessage('');
    createClientAccount.reset();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSuccessMessage('');
    createClientAccount.mutate(form);
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">

        {/* Partie gauche */}
        <aside className="bg-[#0F4780] p-8 text-white lg:p-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/12 text-white ring-1 ring-white/20">
            <Building2 size={24} />
          </div>

          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">
              Espace client
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight">
              Création d&apos;un compte client
            </h1>

            <p className="mt-4 max-w-md text-sm leading-6 text-blue-50">
              Renseignez les informations du client pour générer
              sa fiche et son accès personnel en une seule action.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            <div className="flex gap-3 rounded-lg bg-white/10 p-4 ring-1 ring-white/15">
              <ShieldCheck
                className="mt-0.5 shrink-0 text-blue-100"
                size={19}
              />

              <div>
                <p className="text-sm font-semibold">
                  Rôle CLIENT attribué
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-100">
                  Le client se connecte avec son email et utilise
                  son numéro de téléphone comme mot de passe.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg bg-white/10 p-4 ring-1 ring-white/15">
              <Mail
                className="mt-0.5 shrink-0 text-blue-100"
                size={19}
              />

              <div>
                <p className="text-sm font-semibold">
                  Identifiants client
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-100">
                  L&apos;email saisi devient l&apos;identifiant de
                  connexion du client.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Formulaire */}
        <section className="p-6 sm:p-8 lg:p-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#185FA5]">
                <UserPlus size={22} />
              </div>

              <h2 className="text-2xl font-bold text-slate-950">
                Coordonnées client
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Les champs marqués d&apos;un astérisque sont
                obligatoires.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Home size={16} />
                Accueil
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <LogIn size={16} />
                Connexion
              </Link>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Nom */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Nom *
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <UserPlus className="h-5 w-5 text-gray-400" />
                </div>

                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) =>
                    updateField('nom', e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dupont"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
            </div>

            {/* Prénom */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Prénom *
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <UserPlus className="h-5 w-5 text-gray-400" />
                </div>

                <input
                  type="text"
                  value={form.prenom}
                  onChange={(e) =>
                    updateField('prenom', e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jean"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Téléphone *
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>

                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) =>
                    updateField('telephone', e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+216 00 000 000"
                  minLength={6}
                  maxLength={20}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Email *
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>

                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    updateField('email', e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="client@email.com"
                  maxLength={120}
                  required
                />
              </div>
            </div>

            {/* Adresse */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Adresse client *
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>

                <input
                  type="text"
                  value={form.adresseClient}
                  onChange={(e) =>
                    updateField(
                      'adresseClient',
                      e.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Rue de la Paix"
                  maxLength={180}
                  required
                />
              </div>
            </div>

            {/* Erreur */}
            {createClientAccount.error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 animate-shake">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />

                <span>
                  {getApiErrorMessage(
                    createClientAccount.error,
                    'Impossible de créer le client.',
                  )}
                </span>
              </div>
            )}

            {/* Succès */}
            {successMessage && (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 animate-slideDown">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />

                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={createClientAccount.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium text-white shadow-md transition-all duration-200 hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createClientAccount.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  Créer le compte client
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </section>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }

          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-4px);
          }

          20%, 40%, 60%, 80% {
            transform: translateX(4px);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}