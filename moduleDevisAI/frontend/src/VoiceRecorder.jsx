import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  Square,
  Upload,
  Volume2,
} from "lucide-react";

const MAX_SECONDS = 60;
const clock = (value = 0) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

function asWav(chunks, rate) {
  const frames = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const text = (offset, value) =>
    [...value].forEach((item, index) =>
      view.setUint8(offset + index, item.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, 36 + frames * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * 2, true);
  let offset = 44;
  chunks.forEach((chunk) =>
    chunk.forEach((sample) => {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }),
  );
  return new Blob([buffer], { type: "audio/wav" });
}

export default function VoiceRecorder({
  provider,
  model,
  onResult,
  onSourceChange,
}) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef(null);
  const audio = useRef(null);
  const currentUrl = useRef(null);
  const visualizer = useRef(null);
  const animation = useRef(null);
  const stream = useRef(null);
  const recordingContext = useRef(null);
  const recordNodes = useRef([]);
  const chunks = useRef([]);
  const sampleRate = useRef(44100);
  const startedAt = useRef(0);
  const timer = useRef(null);
  const timeout = useRef(null);
  const playbackContext = useRef(null);
  const playbackSource = useRef(null);
  const playbackAnalyser = useRef(null);
  const stopDrawing = useCallback(() => {
    if (animation.current) cancelAnimationFrame(animation.current);
    animation.current = null;
  }, []);
  const drawSilentLine = useCallback(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    const width = element.clientWidth;
    const height = element.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    if (element.width !== width * ratio || element.height !== height * ratio) {
      element.width = width * ratio;
      element.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    context.clearRect(0, 0, width, height);
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.strokeStyle = "#38516f";
    context.lineWidth = 1;
    context.stroke();
  }, []);
  const draw = useCallback(() => {
    const element = canvas.current;
    const analyser = visualizer.current;
    if (!element || !analyser) return;
    const context = element.getContext("2d");
    const width = element.clientWidth;
    const height = element.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    if (element.width !== width * ratio || element.height !== height * ratio) {
      element.width = width * ratio;
      element.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    context.clearRect(0, 0, width, height);
    context.beginPath();
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = ((value / 128) * height) / 2;
      index ? context.lineTo(x, y) : context.moveTo(x, y);
    });
    context.strokeStyle = "#5dd7ff";
    context.lineWidth = 2;
    context.stroke();
    animation.current = requestAnimationFrame(draw);
  }, []);
  const showWaveform = useCallback(
    (analyser) => {
      visualizer.current = analyser;
      stopDrawing();
      draw();
    },
    [draw, stopDrawing],
  );
  const clearRecording = useCallback(() => {
    clearInterval(timer.current);
    clearTimeout(timeout.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    recordNodes.current.forEach((node) => node.disconnect());
    recordingContext.current?.close();
    stream.current = null;
    recordingContext.current = null;
    recordNodes.current = [];
  }, []);
  const setAudio = useCallback(
    (next) => {
      stopPlayback();
      onSourceChange?.();
      setFile(next);
      setPosition(0);
      setDuration(0);
      setError("");
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        const nextUrl = URL.createObjectURL(next);
        currentUrl.current = nextUrl;
        return nextUrl;
      });
    },
    [onSourceChange],
  );
  const stopRecording = useCallback(() => {
    if (!stream.current) return;
    const elapsed = Math.min(
      MAX_SECONDS,
      Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
    );
    const blob = asWav(chunks.current, sampleRate.current);
    clearRecording();
    stopDrawing();
    setRecording(false);
    if (!blob.size) return setError("Aucune donnée audio n’a été capturée.");
    setAudio(
      new File([blob], `demande-${Date.now()}.wav`, { type: "audio/wav" }),
    );
    setDuration(elapsed);
  }, [clearRecording, setAudio, stopDrawing]);
  const startRecording = async () => {
    try {
      onSourceChange?.();
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(media);
      const analyser = context.createAnalyser();
      const processor = context.createScriptProcessor(4096, 1, 1);
      const muted = context.createGain();
      analyser.fftSize = 1024;
      muted.gain.value = 0;
      chunks.current = [];
      sampleRate.current = context.sampleRate;
      processor.onaudioprocess = (event) =>
        chunks.current.push(
          new Float32Array(event.inputBuffer.getChannelData(0)),
        );
      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(muted);
      muted.connect(context.destination);
      stream.current = media;
      recordingContext.current = context;
      recordNodes.current = [source, analyser, processor, muted];
      startedAt.current = Date.now();
      setDuration(0);
      setRecording(true);
      showWaveform(analyser);
      timer.current = setInterval(
        () =>
          setDuration(
            Math.min(
              MAX_SECONDS,
              Math.floor((Date.now() - startedAt.current) / 1000),
            ),
          ),
        200,
      );
      timeout.current = setTimeout(stopRecording, MAX_SECONDS * 1000);
    } catch {
      setError("Le microphone est indisponible ou son accès a été refusé.");
    }
  };
  const playbackMeter = () => {
    if (playbackAnalyser.current) return playbackAnalyser.current;
    const context = new AudioContext();
    const source = context.createMediaElementSource(audio.current);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    analyser.connect(context.destination);
    playbackContext.current = context;
    playbackSource.current = source;
    playbackAnalyser.current = analyser;
    return analyser;
  };
  const togglePlayback = async () => {
    if (!audio.current) return;
    if (audio.current.paused) {
      showWaveform(playbackMeter());
      await playbackContext.current.resume();
      await audio.current.play();
    } else audio.current.pause();
  };
  const stopPlayback = () => {
    if (!audio.current) return;
    audio.current.pause();
    audio.current.currentTime = 0;
    setPosition(0);
    stopDrawing();
    drawSilentLine();
  };
  const transcribe = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("audio", file);
      body.append("provider", provider);
      body.append("model", model);
      body.append("duration_seconds", String(duration));
      const response = await fetch(
        import.meta.env.VITE_TRANSCRIBE_URL || "/api/v1/devis/vocal-transcribe",
        { method: "POST", body },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.transcription_texte)
        throw new Error(result?.detail || "La transcription a échoué.");
      onResult({
        ...result,
        duration_seconds: Number.isFinite(result.duration_seconds)
          ? result.duration_seconds
          : duration,
      });
    } catch (requestError) {
      setError(
        requestError.message ||
          "Impossible de joindre le service de transcription.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    drawSilentLine();
  }, [drawSilentLine]);
  useEffect(
    () => () => {
      clearRecording();
      stopDrawing();
      playbackSource.current?.disconnect();
      playbackAnalyser.current?.disconnect();
      playbackContext.current?.close();
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    },
    [clearRecording, stopDrawing],
  );
  return (
    <div className="recorder">
      <div className="meter-head">
        <span>
          <AudioLines size={16} />{" "}
          {playing ? "Lecture audio" : "Niveau du microphone"}
        </span>
        <b className={recording ? "live" : ""}>
          {recording ? "ENREGISTREMENT" : playing ? "LECTURE" : "PRÊT"}
        </b>
      </div>
      <canvas ref={canvas} aria-label="Visualisation audio" />
      <div className="controls">
        {recording ? (
          <button className="record stop" onClick={stopRecording}>
            <Square size={15} fill="currentColor" /> Arrêter
          </button>
        ) : (
          <button className="record" onClick={startRecording}>
            <Mic size={17} /> Enregistrer
          </button>
        )}
        <strong>
          {clock(recording ? duration : position)}{" "}
          <small>/ {clock(duration || MAX_SECONDS)}</small>
        </strong>
        {url && (
          <>
            <button className="outline" onClick={togglePlayback}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? "Pause" : "Réécouter"}
            </button>
            <button className="outline" onClick={stopPlayback}>
              Stop
            </button>
          </>
        )}
      </div>
      {url && (
        <div className="playback-tools">
          <input
            aria-label="Position de lecture"
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={position}
            onChange={(event) => {
              const next = Number(event.target.value);
              audio.current.currentTime = next;
              setPosition(next);
            }}
          />
          <label>
            <Volume2 size={16} />
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => {
                const next = Number(event.target.value);
                audio.current.volume = next;
                setVolume(next);
              }}
            />
          </label>
        </div>
      )}
      <div className="upload">
        <Upload size={17} />
        <label>
          Importer un fichier audio
          <input
            type="file"
            accept="audio/*"
            onChange={(event) =>
              event.target.files?.[0] && setAudio(event.target.files[0])
            }
          />
        </label>
        {file && <em>{file.name}</em>}
      </div>
      <audio
        ref={audio}
        src={url || undefined}
        preload="metadata"
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration))
            setDuration(event.currentTarget.duration);
          event.currentTarget.volume = volume;
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          stopDrawing();
          drawSilentLine();
        }}
        onEnded={stopPlayback}
      />
      <button
        className="transcribe"
        disabled={!file || recording || loading}
        onClick={transcribe}
      >
        {loading ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <AudioLines size={17} />
        )}
        {loading ? "Transcription en cours…" : "Transcrire l’audio"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
