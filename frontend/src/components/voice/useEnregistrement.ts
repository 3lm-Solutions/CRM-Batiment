import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice recording in the browser (29/10 — « devis vocal »). The sound is recorded here and sent
 * to the server, which turns it into text with Whisper: works in Chrome, Edge, Firefox, Safari
 * and on phones (the browser's own dictation needed Google's service: « a besoin d'Internet »).
 * Needs HTTPS (or localhost) and the user's permission for the microphone.
 */

/** A recording longer than this stops on its own (a quote description fits in far less). */
export const DUREE_MAX_S = 180;
/** Shorter than this: nothing useful was said (and Whisper bills 10 s anyway). */
const DUREE_MIN_MS = 800;

/** First format the browser can record: Opus in WebM / Ogg, or MP4 on Safari / iPhone. */
const FORMATS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const formatSupporte = () =>
  typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
    ? FORMATS.find((f) => MediaRecorder.isTypeSupported(f))
    : undefined;

const messageErreurMicro = (e: unknown): string => {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Micro refusé : autorisez le micro pour ce site (icône à gauche de l’adresse), puis réessayez.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Aucun micro détecté sur cet appareil.';
  if (name === 'NotReadableError') return 'Le micro est déjà utilisé par une autre application.';
  return 'Impossible d’ouvrir le micro. Réessayez.';
};

export type EtatEnregistrement = 'pret' | 'enregistre';

/**
 * @param onEnregistrement called with the finished recording (to send to the server)
 */
export function useEnregistrement(onEnregistrement: (audio: Blob) => void) {
  const [etat, setEtat] = useState<EtatEnregistrement>('pret');
  const [secondes, setSecondes] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const debut = useRef(0);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);
  /** false when the component goes away: the recording is dropped, not sent */
  const envoyer = useRef(true);
  const rappel = useRef(onEnregistrement);
  // Always the latest callback, updated after render (refs are not written during render)
  useEffect(() => {
    rappel.current = onEnregistrement;
  }, [onEnregistrement]);

  const supporte =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const securise = typeof window === 'undefined' || window.isSecureContext;

  const liberer = useCallback(() => {
    if (minuteur.current) clearInterval(minuteur.current);
    minuteur.current = null;
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    recorder.current = null;
  }, []);

  const arreter = useCallback(() => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  }, []);

  const demarrer = useCallback(async () => {
    if (recorder.current) return;
    setErreur(null);
    if (!securise) return setErreur('Le micro ne marche que sur une adresse sécurisée (https:// ou localhost).');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      return setErreur(messageErreurMicro(e));
    }
    const mimeType = formatSupporte();
    let r: MediaRecorder;
    try {
      r = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: 32_000 });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      return setErreur('Enregistrement audio impossible dans ce navigateur.');
    }
    flux.current = stream;
    recorder.current = r;
    morceaux.current = [];
    envoyer.current = true;
    r.ondataavailable = (e) => {
      if (e.data.size) morceaux.current.push(e.data);
    };
    r.onstop = () => {
      const duree = Date.now() - debut.current;
      const audio = new Blob(morceaux.current, { type: r.mimeType || mimeType || 'audio/webm' });
      liberer();
      setEtat('pret');
      if (!envoyer.current) return;
      if (duree < DUREE_MIN_MS || !audio.size) return setErreur('Enregistrement trop court : appuyez, parlez, puis appuyez sur « Terminer ».');
      rappel.current(audio);
    };
    debut.current = Date.now();
    setSecondes(0);
    r.start(1000);
    setEtat('enregistre');
    minuteur.current = setInterval(() => {
      const s = Math.floor((Date.now() - debut.current) / 1000);
      setSecondes(s);
      if (s >= DUREE_MAX_S) arreter();
    }, 250);
  }, [arreter, liberer, securise]);

  // Never leave the microphone open when the window closes
  useEffect(
    () => () => {
      envoyer.current = false;
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
      liberer();
    },
    [liberer],
  );

  return { supporte, etat, secondes, erreur, setErreur, demarrer, arreter };
}

/** 75 → « 1:15 » */
export const formatDuree = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** « bonjour » + « salle de bain » → « bonjour salle de bain » (spaces / no duplicate blanks). */
export const ajouterTexte = (actuel: string, ajout: string) => {
  if (!ajout) return actuel;
  const base = actuel.replace(/\s+$/, '');
  return base ? `${base} ${ajout}` : ajout.charAt(0).toUpperCase() + ajout.slice(1);
};
