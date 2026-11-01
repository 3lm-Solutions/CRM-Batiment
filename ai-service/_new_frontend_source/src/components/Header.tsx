import React from 'react';
import { RotateCcw, Eye, Bookmark, Building2 } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  onOpenDrafts: () => void;
  onOpenPreview: () => void;
  draftsCount: number;
  hasActiveQuote: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onOpenDrafts,
  onOpenPreview,
  draftsCount,
  hasActiveQuote,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-stone-200 bg-white/95 px-4 md:px-8 backdrop-blur-md shadow-xs">
      {/* Brand: Atelier Métreur Artisanal */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-3 text-stone-900 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 border border-amber-300 text-amber-700 shadow-xs group-hover:bg-amber-100 transition-colors">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-stone-900">
                ATELIER MÉTREUR
              </span>
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-300">
                PRO 2026
              </span>
            </div>
            <p className="text-[11px] text-stone-500 hidden sm:block">
              Chiffrage d'Architecture, Rénovation & Maîtrise d'Œuvre
            </p>
          </div>
        </a>
      </div>

      {/* Badge central Facturier & Tampon Métreur */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-semibold">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-mono text-[11px] tracking-wide">Facturier & Tampon Métreur</span>
      </div>

      {/* Actions rapides */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenDrafts}
          className="relative inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 hover:border-stone-300 transition-colors shadow-xs"
          title="Consulter les devis et métrés sauvegardés"
        >
          <Bookmark className="h-3.5 w-3.5 text-amber-700" />
          <span className="hidden sm:inline">Carnet Brouillons</span>
          {draftsCount > 0 && (
            <span className="font-mono text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded-full border border-amber-300">
              {draftsCount}
            </span>
          )}
        </button>

        {hasActiveQuote && (
          <>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
              title="Réinitialiser l'ouvrage"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Nouveau</span>
            </button>

            <button
              onClick={onOpenPreview}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 transition-colors shadow-sm"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Format A4 / PDF</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};



