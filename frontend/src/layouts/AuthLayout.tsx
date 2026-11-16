import { ArrowLeft, Bot, Building2, FileCheck, HardHat } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '@/lib/brand';

const POINTS = [
  { icon: FileCheck, text: 'Devis signés en ligne, acompte et chantier créés automatiquement' },
  { icon: HardHat, text: 'Chantiers, sous-traitants et fournisseurs au même endroit' },
  { icon: Bot, text: 'Assistant IA : prospects qualifiés et devis préparés' },
];

/**
 * Login, password change, reset — old BÂTIFLOW design: blue page, two-part card
 * (branding on the left, form on the right).
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-blue-900 via-blue-700 to-blue-400 px-4 py-8">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl">
        {/* Branding */}
        <div className="hidden flex-col justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 px-10 py-12 text-white md:flex md:w-[45%]">
          <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Building2 className="size-7" aria-hidden />
          </div>
          <p className="text-3xl font-extrabold">{BRAND.name}</p>
          <p className="mb-8 mt-1 text-sm opacity-80">{BRAND.tagline}</p>
          <ul className="space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-blue-50">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon className="size-4" aria-hidden /></span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div className="auth-card flex flex-1 flex-col justify-center bg-gray-50 p-6 text-slate-800 md:p-10">
          <div className="mx-auto w-full max-w-sm">
            <p className="mb-6 text-2xl font-extrabold text-blue-900 md:hidden">{BRAND.name}</p>
            <h1 className="mb-2 text-2xl font-bold text-blue-900">{title}</h1>
            {subtitle && <p className="mb-6 text-blue-500">{subtitle}</p>}
            {children}
            <div className="mt-8 flex items-center justify-between text-xs text-gray-400">
              <Link to="/" className="inline-flex items-center gap-1 hover:text-blue-700"><ArrowLeft className="size-3.5" /> Accueil</Link>
              <span>{BRAND.name} — plateforme sécurisée</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
