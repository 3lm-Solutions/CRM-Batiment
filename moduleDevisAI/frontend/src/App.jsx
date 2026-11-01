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
import PhotoUpload from "./components/PhotoUpload";

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
  const [photoResult, setPhotoResult] = useState(null);
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
    setPhotoResult(null);
    setMatchError("");
  };

  const setProvider = (id) => {
    const next = providers.find((item) => item.id === id) || providers[0];
    setProviderId(next.id);
    setModel((mode === "audio" ? next.audio : next.text)[0] || "");
    setTranscription(null);
    setPhotoResult(null);
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
      : mode === "audio"
        ? Boolean(transcription?.transcription_texte?.trim())
        : Boolean(photoResult?.description?.trim());

  const matchCatalogue = async (overridePhotoResult = null) => {
    const activePhoto = overridePhotoResult || photoResult;
    const companyId = Number(import.meta.env.VITE_COMPANY_ID);
    if (!Number.isInteger(companyId) || companyId < 1) {
      setMatchError("Configurez VITE_COMPANY_ID avant de lancer le matching.");
      return;
    }
    setMatching(true);
    setMatchError("");
    try {
      const activeDescription =
        mode === "image" && activePhoto?.description
          ? activePhoto.description
          : description.trim();

      const response = await fetch(
        import.meta.env.VITE_MATCH_URL || "/api/v1/devis/match-catalogue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: companyId,
            description_libre: activeDescription,
            modalite_source: mode === "image" ? "image" : "texte",
            provider: mode === "text" ? providerId : quoteProviderId,
            model: mode === "text" ? model : quoteModel,
            ...(mode === "image" && activePhoto
              ? {
                  image: activePhoto.image,
                  image_analysis: activePhoto.analysis,
                }
              : {}),
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
            Choisissez le moteur adapté, saisissez ou importez le besoin (texte,
            audio ou photo de chantier), puis vérifiez les informations avant le
            chiffrage automatique.
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
                  : mode === "image"
                    ? "Fournisseur d'analyse vision"
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
                {mode === "audio"
                  ? "Modèle de transcription"
                  : mode === "image"
                    ? "Modèle vision"
                    : "Modèle"}
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

            {(mode === "audio" || mode === "image") && (
              <div className="quote-engine">
                <p className="section-label">GÉNÉRATION DU DEVIS</p>
                <div className="fields">
                  <label>
                    Fournisseur devis
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
                    Modèle devis
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
                <Image size={16} /> Image
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
              <PhotoUpload
                provider={providerId}
                model={model}
                loadingMatch={matching}
                onSourceChange={() => {
                  setPhotoResult(null);
                  setDescription("");
                  setMatchError("");
                }}
                onConfirmed={(result, autoSubmit) => {
                  setPhotoResult(result);
                  setDescription(result.description);
                  setMatchError("");
                  if (autoSubmit) {
                    matchCatalogue(result);
                  }
                }}
              />
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
              <dt>
                {mode === "audio"
                  ? "Transcription"
                  : mode === "image"
                    ? "Vision"
                    : "Fournisseur"}
              </dt>
              <dd>{provider.label}</dd>
              <dt>
                {mode === "audio"
                  ? "Modèle audio"
                  : mode === "image"
                    ? "Modèle vision"
                    : "Modèle"}
              </dt>
              <dd>{model || "—"}</dd>

              {(mode === "audio" || mode === "image") && (
                <>
                  <dt>Génération devis</dt>
                  <dd>{quoteProvider.label}</dd>
                  <dt>Modèle devis</dt>
                  <dd>{quoteModel}</dd>
                </>
              )}

              <dt>Modalité source</dt>
              <dd>
                {mode === "text"
                  ? "Texte libre"
                  : mode === "audio"
                    ? "Enregistrement vocal"
                    : "Photo de chantier"}
              </dd>

              {mode === "image" && photoResult && (
                <>
                  <dt>Pièce / zone</dt>
                  <dd>{photoResult.analysis?.type_piece || "—"}</dd>
                  <dt>Surface estimée</dt>
                  <dd>
                    {photoResult.analysis?.surface_m2 !== null &&
                    photoResult.analysis?.surface_m2 !== undefined
                      ? `${photoResult.analysis?.surface_m2} m²`
                      : "À calibrer"}
                  </dd>
                  <dt>Repère dimensionnel</dt>
                  <dd>
                    {photoResult.analysis?.reference_visible ? "Oui" : "Non"}
                  </dd>
                </>
              )}
            </dl>
          </section>

          <button
            className="validate"
            disabled={!ready || matching}
            onClick={() => matchCatalogue()}
          >
            {matching ? "Génération en cours…" : "Générer le devis"}{" "}
            <ArrowRight size={17} />
          </button>

          {matchError && <p className="error">{matchError}</p>}

          <p className="hint">
            <Bot size={18} />
            <b>Conseil</b>
            <br />
            {mode === "image"
              ? "Une photo nette avec un repère métrique visible (porte, prise, équipement) améliore l'estimation de surface."
              : "Une demande précise améliore le rapprochement avec le catalogue."}
          </p>
        </aside>
      </div>
    </div>
  );
}
