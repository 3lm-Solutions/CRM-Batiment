import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice dictation with the browser's own speech recognition (Étape 7 of 27/10): free, nothing on
 * the server. Chrome, Edge and Safari support it; Firefox does not (`supporte` = false → the
 * button is hidden). The page must be served over HTTPS (or localhost) and the user allows the mic.
 */

// Minimal typing of the Web Speech API (not in TypeScript's DOM lib)
interface ResultatReconnaissance {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface EvenementReconnaissance {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [i: number]: ResultatReconnaissance };
}
interface Reconnaissance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EvenementReconnaissance) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type ConstructeurReconnaissance = new () => Reconnaissance;

const constructeur = (): ConstructeurReconnaissance | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: ConstructeurReconnaissance; webkitSpeechRecognition?: ConstructeurReconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Micro refusé : autorisez le micro pour ce site (icône à gauche de l’adresse).',
  'service-not-allowed': 'Dictée non autorisée par le navigateur sur cette page (HTTPS requis).',
  'audio-capture': 'Aucun micro détecté.',
  network: 'La dictée du navigateur a besoin d’Internet.',
  'no-speech': 'Aucune parole entendue. Rapprochez-vous du micro et réessayez.',
};

/**
 * @param onTexte called with each finished sentence (to append to the field)
 */
export function useDictee(onTexte: (texte: string) => void) {
  const [ecoute, setEcoute] = useState(false);
  const [provisoire, setProvisoire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const reco = useRef<Reconnaissance | null>(null);
  const rappel = useRef(onTexte);
  rappel.current = onTexte;
  const supporte = constructeur() !== null;

  const arreter = useCallback(() => {
    reco.current?.stop();
  }, []);

  const demarrer = useCallback(() => {
    const C = constructeur();
    if (!C || reco.current) return;
    const r = new C();
    r.lang = 'fr-FR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let enCours = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript;
        if (res.isFinal) rappel.current(t.trim());
        else enCours += t;
      }
      setProvisoire(enCours);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setErreur(MESSAGES[e.error] ?? `Dictée interrompue (${e.error}).`);
    };
    r.onend = () => {
      reco.current = null;
      setEcoute(false);
      setProvisoire('');
    };
    setErreur(null);
    try {
      r.start();
      reco.current = r;
      setEcoute(true);
    } catch {
      setErreur('Impossible de démarrer la dictée. Réessayez.');
    }
  }, []);

  // Never leave the mic open when the component goes away
  useEffect(() => () => reco.current?.stop(), []);

  return { supporte, ecoute, provisoire, erreur, demarrer, arreter };
}

/** « bonjour » + « salle de bain » → « bonjour salle de bain » (spaces / no duplicate blanks). */
export const ajouterTexte = (actuel: string, ajout: string) => {
  if (!ajout) return actuel;
  const base = actuel.replace(/\s+$/, '');
  return base ? `${base} ${ajout}` : ajout.charAt(0).toUpperCase() + ajout.slice(1);
};
