import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  FileText,
  Image,
  Mic,
  Settings2,
  Sparkles,
} from "lucide-react";
import VoiceRecorder from "./VoiceRecorder";
import QuoteReview from "./components/QuoteReview";

const providers = [
  {
    id: "openai",
    label: "OpenAI",
    text: ["gpt-4o", "gpt-4o-mini"],
    audio: ["whisper-1"],
  },
  {
    id: "groq",
    label: "Groq",
    text: [],
    audio: ["whisper-large-v3-turbo", "whisper-large-v3"],
  },
  {
    id: "google",
    label: "Google",
    text: [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
    ],
    audio: [],
  },
  { id: "anthropic", label: "Anthropic", text: ["claude-sonnet-5"], audio: [] },
];

export default function App() {
  const [mode, setMode] = useState("audio");
  const [providerId, setProviderId] = useState("openai");
  const [model, setModel] = useState("whisper-1");
  const [quoteProviderId, setQuoteProviderId] = useState("google");
  const [quoteModel, setQuoteModel] = useState("gemini-3.8-flash");
  const [description, setDescription] = useState("");
  const [transcription, setTranscription] = useState(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [quote, setQuote] = useState(null);
  const provider =
    providers.find((item) => item.id === providerId) || providers[0];
  const availableProviders = providers.filter(
    (item) => (mode === "audio" ? item.audio : item.text).length > 0,
  );
  const models = useMemo(
    () => (mode === "audio" ? provider.audio : provider.text),
    [mode, provider],
  );
  const quoteProviders = providers.filter((item) => item.text.length > 0);
  const quoteProvider =
    quoteProviders.find((item) => item.id === quoteProviderId) ||
    quoteProviders[0];
  const setInputMode = (next) => {
    const nextProvider = providers.find(
      (item) => (next === "audio" ? item.audio : item.text).length > 0,
    );
    setMode(next);
    setProviderId(nextProvider.id);
    setModel((next === "audio" ? nextProvider.audio : nextProvider.text)[0]);
    setTranscription(null);
    setMatchError("");
  };
  const setProvider = (id) => {
    const next = providers.find((item) => item.id === id) || providers[0];
    setProviderId(next.id);
    setModel((mode === "audio" ? next.audio : next.text)[0] || "");
    setTranscription(null);
    setMatchError("");
  };
  const setQuoteProvider = (id) => {
    const next =
      quoteProviders.find((item) => item.id === id) || quoteProviders[0];
    setQuoteProviderId(next.id);
    setQuoteModel(next.text[0]);
    setMatchError("");
  };
  const ready =
    mode === "text"
      ? Boolean(description.trim())
      : Boolean(transcription?.transcription_texte?.trim());
  const matchCatalogue = async () => {
    const companyId = Number(import.meta.env.VITE_COMPANY_ID);
    if (!Number.isInteger(companyId) || companyId < 1) {
      setMatchError("Configurez VITE_COMPANY_ID avant de lancer le matching.");
      return;
    }
    setMatching(true);
    setMatchError("");
    try {
      const response = await fetch(
        import.meta.env.VITE_MATCH_URL || "/api/v1/devis/match-catalogue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: companyId,
            description_libre: description.trim(),
            modalite_source: "texte",
            provider: mode === "audio" ? quoteProviderId : providerId,
            model: mode === "audio" ? quoteModel : model,
          }),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        throw new Error(result?.detail || "Le matching catalogue a échoué.");
      }
      setQuote(result);
    } catch (requestError) {
      setMatchError(
        requestError.message || "Impossible de joindre le service de matching.",
      );
    } finally {
      setMatching(false);
    }
  };
  if (quote) {
    return <QuoteReview quote={quote} onBack={() => setQuote(null)} />;
  }
  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">
            <Sparkles size={14} /> MODULE DEVIS IA
          </p>
          <h1>Créer un devis à partir d’une demande</h1>
          <p>
            Choisissez le moteur adapté, saisissez ou dictez le besoin, puis
            vérifiez les informations avant le chiffrage.
          </p>
        </div>
        <div className="registry">
          <Settings2 size={17} /> Tool Registry
        </div>
      </header>
      <div className="layout">
        <main className="card">
          <section className="engine">
            <p className="section-label">CONFIGURATION DU MOTEUR</p>
            <div className="fields">
              <label>
                {mode === "audio"
                  ? "Fournisseur de transcription"
                  : "Fournisseur"}
                <select
                  value={providerId}
                  onChange={(event) => setProvider(event.target.value)}
                >
                  {availableProviders.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {mode === "audio" ? "Modèle de transcription" : "Modèle"}
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  disabled={!models.length}
                >
                  {models.length ? (
                    models.map((item) => <option key={item}>{item}</option>)
                  ) : (
                    <option>Aucun modèle compatible</option>
                  )}
                </select>
              </label>
            </div>
            {mode === "audio" && (
              <div className="quote-engine">
                <p className="section-label">GÉNÉRATION DU DEVIS</p>
                <div className="fields">
                  <label>
                    Fournisseur
                    <select
                      value={quoteProviderId}
                      onChange={(event) => setQuoteProvider(event.target.value)}
                    >
                      {quoteProviders.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modèle
                    <select
                      value={quoteModel}
                      onChange={(event) => setQuoteModel(event.target.value)}
                    >
                      {quoteProvider.text.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </section>
          <section className="content">
            <div className="mode-picker">
              <button
                className={mode === "text" ? "selected" : ""}
                onClick={() => setInputMode("text")}
              >
                <FileText size={16} /> Texte
              </button>
              <button
                className={mode === "audio" ? "selected" : ""}
                onClick={() => setInputMode("audio")}
              >
                <Mic size={16} /> Audio
              </button>
              <button
                className={mode === "image" ? "selected" : ""}
                onClick={() => setInputMode("image")}
              >
                <Image size={16} /> Image <small>Bientôt</small>
              </button>
            </div>
            {mode === "text" && (
              <label className="description">
                Décrivez les travaux
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength="4000"
                  placeholder="Ex. Rénovation complète d'une salle de bain de 8 m² : dépose, plomberie, carrelage et pose des équipements."
                />
              </label>
            )}
            {mode === "audio" && (
              <VoiceRecorder
                provider={providerId}
                model={model}
                onSourceChange={() => {
                  setTranscription(null);
                  setDescription("");
                  setMatchError("");
                }}
                onResult={(result) => {
                  setTranscription(result);
                  setDescription(result.transcription_texte);
                }}
              />
            )}
            {mode === "image" && (
              <div className="future">
                <Image size={28} />
                <strong>Analyse d’image bientôt disponible</strong>
                <span>Cette étape est réservée à une prochaine itération.</span>
              </div>
            )}
            {mode === "audio" && transcription && (
              <section className="transcript">
                <div>
                  <h2>Texte retranscrit</h2>
                </div>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <p>
                  Durée analysée : {transcription.duration_seconds ?? "—"} s.
                  Corrigez le texte si nécessaire avant validation.
                </p>
              </section>
            )}
          </section>
        </main>
        <aside>
          <section className="summary">
            <p className="section-label">RÉSUMÉ</p>
            <dl>
              <dt>{mode === "audio" ? "Transcription" : "Fournisseur"}</dt>
              <dd>{provider.label}</dd>
              <dt>{mode === "audio" ? "Modèle audio" : "Modèle"}</dt>
              <dd>{model || "—"}</dd>
              {mode === "audio" && (
                <>
                  <dt>Génération</dt>
                  <dd>{quoteProvider.label}</dd>
                  <dt>Modèle devis</dt>
                  <dd>{quoteModel}</dd>
                </>
              )}
              <dt>Source</dt>
              <dd>
                {mode === "text"
                  ? "Texte"
                  : mode === "audio"
                    ? "Audio"
                    : "Image"}
              </dd>
            </dl>
          </section>
          <button
            className="validate"
            disabled={!ready || mode === "image" || matching}
            onClick={matchCatalogue}
          >
            {matching ? "Génération en cours…" : "Générer le devis"}{" "}
            <ArrowRight size={17} />
          </button>
          {matchError && <p className="error">{matchError}</p>}
          <p className="hint">
            <Bot size={18} />
            <b>Conseil</b>
            <br />
            Une demande précise améliore le rapprochement avec le catalogue.
          </p>
        </aside>
      </div>
    </div>
  );
}
