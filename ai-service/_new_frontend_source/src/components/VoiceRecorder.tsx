import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, ArrowRight, Loader2, Sparkles, Volume2, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { SAMPLE_VOICES, SampleVoice } from '../data/samples';

interface VoiceRecorderProps {
  onValidateTranscript: (text: string) => void;
  isLoading: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onValidateTranscript,
  isLoading,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 20, 35, 10, 40, 25, 15, 30]);

  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const startRecording = async () => {
    setAudioBlobUrl(null);
    setEditableTranscript('');
    setConfidenceScore(null);
    setRecordDuration(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const updateWaveform = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const levels = Array.from(dataArray.slice(0, 8)).map((v) => Math.max(12, (v / 255) * 60));
          setAudioLevels(levels);
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        updateWaveform();
      } catch (audioErr) {
        console.warn('Web Audio visualizer fallback:', audioErr);
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlobUrl(url);
        runAutomaticTranscription(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn('Microphone inaccessible, mode simulation guidée:', err);
      setIsRecording(true);
      const interval = setInterval(() => {
        setAudioLevels([
          Math.random() * 40 + 10,
          Math.random() * 50 + 15,
          Math.random() * 45 + 10,
          Math.random() * 55 + 20,
          Math.random() * 35 + 10,
          Math.random() * 48 + 15,
          Math.random() * 30 + 10,
          Math.random() * 42 + 10,
        ]);
      }, 100);

      (window as any).__simInterval = interval;
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);

    if ((window as any).__simInterval) {
      clearInterval((window as any).__simInterval);
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setTranscriptionError('Aucun enregistrement audio disponible. Autorisez le microphone puis réessayez.');
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  const runAutomaticTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    try {
      const form = new FormData();
      form.append('file', audioBlob, 'audio.webm');
      const response = await fetch('/api/vocal/transcrire', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Transcription impossible.');
      setEditableTranscript(data.transcription_texte || '');
      setConfidenceScore(data.confidence_score ?? null);
    } catch (error) {
      setTranscriptionError(error instanceof Error ? error.message : 'Transcription impossible.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSelectSample = (sample: SampleVoice) => {
    stopRecording();
    setRecordDuration(22);
    setAudioBlobUrl(null);
    setEditableTranscript(sample.transcript);
    setConfidenceScore(sample.confidence);
  };

  const togglePlayback = () => {
    if (!audioElementRef.current && audioBlobUrl) {
      audioElementRef.current = new Audio(audioBlobUrl);
      audioElementRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (audioElementRef.current) {
      if (isPlayingAudio) {
        audioElementRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioElementRef.current.play();
        setIsPlayingAudio(true);
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const renderConfidenceBadge = (confidence: number) => {
    const percent = Math.round(confidence * 100);
    if (confidence < 0.7) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 border border-rose-300 px-2.5 py-1 text-xs font-bold text-rose-800">
          <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
          <span>Indice de confiance : {percent}% (Faible — Relecture requise)</span>
        </span>
      );
    }
    if (confidence <= 0.85) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1 text-xs font-bold text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <span>Indice de confiance : {percent}% (Moyen)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 border border-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        <span>Indice de confiance : {percent}% (Optimal)</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Panneau dictée vocale de chantier en blanc architectural */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all shadow-xs ${
              isRecording
                ? 'bg-rose-100 text-rose-600 ring-4 ring-rose-200 animate-pulse'
                : 'bg-stone-100 text-stone-700 border border-stone-200'
            }`}>
              <Mic className="h-6 w-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-black text-stone-900 tracking-wider">
                  {formatTimer(recordDuration)}
                </span>
                <span className="text-xs text-stone-400 font-mono">/ 01:00</span>
                {isRecording && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 ml-2">
                    <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                    Enregistrement micro...
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Arrêt auto à 60s · Visualisation audio instantanée
              </p>
            </div>
          </div>

          {/* Barres de niveau audio style console d'ingénieur */}
          <div className="flex items-end gap-1.5 h-10 px-3.5 py-1 bg-stone-50 rounded-xl border border-stone-200 shadow-inner">
            {audioLevels.map((lvl, idx) => (
              <span
                key={idx}
                style={{ height: isRecording ? `${lvl}%` : '25%' }}
                className={`w-1.5 rounded-full transition-all duration-75 ${
                  isRecording ? 'bg-amber-600' : 'bg-stone-300'
                }`}
              />
            ))}
          </div>

          {/* Boutons d'action Enregistrer / Stop / Réécouter */}
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                <Mic className="h-4 w-4" />
                <span>Enregistrer</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 transition-colors shadow-sm"
              >
                <Square className="h-4 w-4 text-rose-400 fill-rose-400" />
                <span>Terminer</span>
              </button>
            )}

            {audioBlobUrl && !isRecording && (
              <button
                type="button"
                onClick={togglePlayback}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-200 transition-colors"
              >
                {isPlayingAudio ? (
                  <>
                    <Pause className="h-3.5 w-3.5 text-amber-700" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 text-amber-700" />
                    <span>Réécouter</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Échantillons vocaux pré-enregistrés */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold text-stone-500">Dictées témoins de chantier :</span>
          {SAMPLE_VOICES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleSelectSample(sample)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 border border-stone-200 text-[11px] font-medium transition-colors"
            >
              <Volume2 className="h-3 w-3 text-amber-700" />
              <span>{sample.titre}</span>
              <span className="text-stone-400 font-mono">({sample.duree})</span>
            </button>
          ))}
        </div>
      </div>

      {/* État de transcription en cours */}
      {isTranscribing && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs font-semibold text-stone-800">
          <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
          <span>Transcription du mémo vocal par le moteur IA...</span>
        </div>
      )}

      {transcriptionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{transcriptionError}</div>
      )}

      {/* Zone éditable de transcription avec badge de confiance CDC */}
      {editableTranscript && !isTranscribing && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-900">
                Transcription éditable du conducteur de travaux
              </span>
              <span className="text-[11px] text-stone-500">
                (Ajustez avant génération)
              </span>
            </div>

            {confidenceScore !== null && renderConfidenceBadge(confidenceScore)}
          </div>

          <textarea
            rows={4}
            value={editableTranscript}
            onChange={(e) => setEditableTranscript(e.target.value)}
            className="w-full rounded-xl border border-stone-300 bg-stone-50 p-3.5 text-sm text-stone-900 focus:bg-white focus:border-amber-600 focus:outline-none transition-colors shadow-inner"
            placeholder="Le texte transcrit s'affiche ici et peut être modifié..."
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-stone-500 font-mono">
              {editableTranscript.length} caractères transcrits
            </span>

            <button
              type="button"
              onClick={() => onValidateTranscript(editableTranscript)}
              disabled={isLoading || !editableTranscript.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Traitement RAG...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Valider → Générer le devis</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

