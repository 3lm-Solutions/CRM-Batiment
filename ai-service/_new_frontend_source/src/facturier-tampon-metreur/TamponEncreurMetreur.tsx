import React, { useState } from 'react';
import { ShieldCheck, Award, Stamp } from 'lucide-react';

interface TamponEncreurMetreurProps {
  numeroDevis: string;
  isConforme?: boolean;
  onStampClick?: () => void;
  dateTampon?: string;
}

export const TamponEncreurMetreur: React.FC<TamponEncreurMetreurProps> = ({
  numeroDevis,
  isConforme = true,
  onStampClick,
  dateTampon = new Date().toLocaleDateString('fr-FR'),
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [stampCount, setStampCount] = useState(1);

  const handleClick = () => {
    setIsPressed(true);
    setStampCount((prev) => prev + 1);
    setTimeout(() => setIsPressed(false), 220);
    if (onStampClick) onStampClick();
  };

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-all hover:shadow-sm">
      <div className="flex items-center gap-4">
        {/* Le Tampon Encreur Circulaire Interactif */}
        <button
          type="button"
          onClick={handleClick}
          title="Cliquez pour apposer le cachet officiel de conformité métreur"
          className={`relative flex h-20 w-20 shrink-0 cursor-pointer select-none items-center justify-center rounded-full border-2 border-dashed transition-all duration-200 group ${
            isConforme
              ? 'border-amber-700/80 bg-amber-50/60 text-amber-900 hover:border-amber-800 hover:bg-amber-100/70'
              : 'border-rose-600/80 bg-rose-50/60 text-rose-900 hover:border-rose-700'
          } ${isPressed ? 'scale-90 rotate-[-18deg]' : 'rotate-[-9deg] hover:rotate-[-4deg]'}`}
        >
          {/* Anneau intérieur de sceau */}
          <div className="absolute inset-1 rounded-full border border-dotted border-amber-800/40 pointer-events-none" />

          <div className="text-center font-mono leading-tight">
            <span className="text-[7.5px] font-bold tracking-widest uppercase block text-amber-800">
              DTU · NF P03-001
            </span>
            <span className="text-[12px] font-black tracking-tight uppercase block text-stone-900 mt-0.5">
              RGE QUALI
            </span>
            <span className="text-[8px] font-bold tracking-wider uppercase block text-amber-700">
              {isConforme ? 'CONFORME' : 'RÉVISION'}
            </span>
            <span className="text-[6.5px] text-stone-500 font-mono block mt-0.5">
              {dateTampon}
            </span>
          </div>

          {/* Micro-badge interactif au survol */}
          <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-amber-700 text-white rounded-full p-0.5 shadow-xs">
            <Stamp className="h-2.5 w-2.5" />
          </div>
        </button>

        {/* Explications & Validité Légale */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-stone-900 text-sm tracking-tight">
              Cachet d'Atelier & Contrôle Métreur
            </h4>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="h-3 w-3" />
              <span>Visé #{stampCount}</span>
            </span>
          </div>

          <p className="text-stone-600 text-[11px] leading-relaxed">
            Validation technique d'ouvrage conforme aux règles de l'art du bâtiment (NF P03-001, DTU 52.2 & 59.1) avec vérification instantanée de la marge brute.
          </p>

          <div className="flex items-center gap-3 pt-1 text-[10px] text-stone-500 font-mono">
            <span>Réf : {numeroDevis}</span>
            <span>·</span>
            <span>Garantie AXA Décennale DX-883921</span>
          </div>
        </div>
      </div>
    </div>
  );
};
