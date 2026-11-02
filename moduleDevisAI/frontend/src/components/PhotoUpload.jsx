import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ImagePlus,
  Layers,
  LoaderCircle,
  Plus,
  Ruler,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

export function getMaterialColorClass(material) {
  const m = (material || "").toLowerCase();
  if (
    m.includes("carrel") ||
    m.includes("faïence") ||
    m.includes("faience") ||
    m.includes("grès") ||
    m.includes("gres")
  ) {
    return "color-tile";
  }
  if (
    m.includes("bois") ||
    m.includes("parquet") ||
    m.includes("chêne") ||
    m.includes("chene") ||
    m.includes("pin") ||
    m.includes("stratifi") ||
    m.includes("lamin")
  ) {
    return "color-wood";
  }
  if (m.includes("peint") || m.includes("enduit") || m.includes("lasure")) {
    return "color-paint";
  }
  if (
    m.includes("plâtre") ||
    m.includes("platre") ||
    m.includes("placo") ||
    m.includes("ba13") ||
    m.includes("doublage")
  ) {
    return "color-plaster";
  }
  if (
    m.includes("béton") ||
    m.includes("beton") ||
    m.includes("ciment") ||
    m.includes("chape") ||
    m.includes("pierre") ||
    m.includes("brique")
  ) {
    return "color-concrete";
  }
  if (
    m.includes("métal") ||
    m.includes("metal") ||
    m.includes("inox") ||
    m.includes("alu") ||
    m.includes("acier") ||
    m.includes("cuivre")
  ) {
    return "color-metal";
  }
  if (m.includes("verre") || m.includes("vitr") || m.includes("miroir")) {
    return "color-glass";
  }
  if (
    m.includes("pvc") ||
    m.includes("plast") ||
    m.includes("vinyle") ||
    m.includes("résine") ||
    m.includes("resine")
  ) {
    return "color-pvc";
  }
  if (
    m.includes("sanit") ||
    m.includes("céram") ||
    m.includes("ceram") ||
    m.includes("porcel")
  ) {
    return "color-sanitary";
  }
  return "color-default";
}

export default function PhotoUpload({
  provider,
  model,
  onConfirmed,
  onSourceChange,
  loadingMatch = false,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [payload, setPayload] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newMaterial, setNewMaterial] = useState("");
  const [showAddMaterial, setShowAddMaterial] = useState(false);

  const resetAll = () => {
    setPreviewUrl("");
    setFileInfo(null);
    setPayload(null);
    setAnalysis(null);
    setSelectedMaterials([]);
    setError("");
    setNewMaterial("");
    setShowAddMaterial(false);
    if (inputRef.current) inputRef.current.value = "";
    onSourceChange?.();
  };

  const validateAndProcessFile = (file) => {
    setError("");
    if (!file) return;

    // 1. Validation de l'extension / type MIME
    const fileName = file.name || "";
    const extension = "." + fileName.split(".").pop().toLowerCase();
    const isMimeAccepted = ACCEPTED_TYPES.includes(file.type);
    const isExtensionAccepted = ACCEPTED_EXTENSIONS.includes(extension);

    if (!isMimeAccepted && !isExtensionAccepted) {
      setError(
        "Format non pris en charge : seules les images JPEG (.jpg, .jpeg) et PNG (.png) sont acceptées.",
      );
      return;
    }

    // 2. Validation de la taille maximale (10 Mo)
    if (file.size > MAX_BYTES) {
      const currentMb = (file.size / (1024 * 1024)).toFixed(2);
      setError(
        `L'image dépasse la taille maximale autorisée de 10 Mo (taille actuelle : ${currentMb} Mo).`,
      );
      return;
    }

    setAnalysis(null);
    setSelectedMaterials([]);
    onSourceChange?.();

    const normalizedMime =
      isMimeAccepted && file.type
        ? file.type
        : extension === ".png"
          ? "image/png"
          : "image/jpeg";

    setFileInfo({
      name: file.name,
      size: file.size,
      sizeFormatted: (file.size / (1024 * 1024)).toFixed(2) + " Mo",
      type: normalizedMime,
    });

    const reader = new FileReader();
    reader.onerror = () => {
      setError("Impossible de lire le fichier sélectionné.");
    };
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPreviewUrl(dataUrl);
      const base64Content = dataUrl.includes(",")
        ? dataUrl.split(",")[1]
        : dataUrl;
      setPayload({
        media_type: normalizedMime,
        data_base64: base64Content,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndProcessFile(droppedFile);
    }
  };

  const analyze = async () => {
    if (!payload) return;
    setLoading(true);
    setError("");
    try {
      const endpoint =
        import.meta.env.VITE_PHOTO_ANALYZE_URL || "/api/v1/devis/photo-analyze";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: payload,
          provider: provider || undefined,
          model: model || undefined,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result) {
        throw new Error(
          result?.detail ||
            "L'analyse de la photo a échoué. Veuillez réessayer.",
        );
      }

      // Normalisation des champs pour compatibilité complète
      const normalizedAnalysis = {
        type_piece:
          result.type_pièce ?? result.type_piece ?? "Zone non identifiée",
        surface_m2:
          result.surface_m2 !== null && result.surface_m2 !== undefined
            ? Number(result.surface_m2)
            : null,
        confidence_surface: Number(result.confidence_surface ?? 0),
        reference_visible: Boolean(
          result.reference_visible ?? result.reference_dimensionnelle_visible,
        ),
        materiaux: Array.isArray(result.matériaux ?? result.materiaux)
          ? result.matériaux ?? result.materiaux
          : [],
        description: result.description ?? "",
        observations: Array.isArray(result.observations)
          ? result.observations
          : [],
        incertitudes: Array.isArray(result.incertitudes)
          ? result.incertitudes
          : [],
        model_trace: result.model_trace,
      };

      setAnalysis(normalizedAnalysis);
      setSelectedMaterials(normalizedAnalysis.materiaux);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Impossible de joindre le service d'analyse photo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateAnalysis = (field, value) => {
    setAnalysis((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleMaterial = (material) => {
    setSelectedMaterials((current) =>
      current.includes(material)
        ? current.filter((item) => item !== material)
        : [...current, material],
    );
  };

  const handleAddCustomMaterial = (e) => {
    e.preventDefault();
    const trimmed = newMaterial.trim();
    if (!trimmed) return;
    if (!selectedMaterials.includes(trimmed)) {
      setSelectedMaterials((current) => [...current, trimmed]);
    }
    if (analysis && !analysis.materiaux.includes(trimmed)) {
      setAnalysis((current) => ({
        ...current,
        materiaux: [...current.materiaux, trimmed],
      }));
    }
    setNewMaterial("");
    setShowAddMaterial(false);
  };

  const confirm = () => {
    if (!analysis || !payload) return;
    const finalAnalysis = {
      ...analysis,
      materiaux: selectedMaterials,
    };
    const compiledDescription = buildConfirmedDescription(finalAnalysis);
    onConfirmed?.(
      {
        image: payload,
        analysis: finalAnalysis,
        description: compiledDescription,
        previewUrl,
      },
      true, // autoSubmit = true pour ouvrir immédiatement l'édition de devis
    );
  };

  return (
    <section className="photo-upload" aria-label="Analyse photo de chantier">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png"
        onChange={(event) =>
          validateAndProcessFile(event.target.files?.[0])
        }
      />

      {/* Zone Drag & Drop */}
      <div
        className={`photo-dropzone ${isDragging ? "drag-active" : ""}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {previewUrl ? (
          <div className="preview-container">
            <img
              src={previewUrl}
              alt="Aperçu du chantier"
              className="photo-preview"
            />
            {fileInfo && (
              <div className="photo-file-info">
                <span>{fileInfo.name}</span>
                <span className="file-badge">{fileInfo.sizeFormatted}</span>
                <span className="file-badge">
                  {fileInfo.type.includes("png") ? "PNG" : "JPEG"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="dropzone-prompt">
            <ImagePlus size={36} className="dropzone-icon" />
            <strong>Glissez-déposez une photo de chantier ici</strong>
            <span>ou cliquez pour parcourir vos fichiers</span>
            <span className="dropzone-hint">
              Formats acceptés : JPEG ou PNG — Taille max : 10 Mo
            </span>
          </div>
        )}
      </div>

      {/* Barre d'action sous la dropzone */}
      {previewUrl && (
        <div className="photo-actions">
          <button
            className="outline"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            <Upload size={16} /> Remplacer l'image
          </button>
          <button
            className="outline danger"
            type="button"
            onClick={resetAll}
            disabled={loading}
            title="Supprimer la photo"
          >
            <Trash2 size={16} /> Supprimer
          </button>
          <button
            className="transcribe"
            type="button"
            onClick={analyze}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            {loading ? "Analyse IA en cours…" : "Analyser la photo"}
          </button>
        </div>
      )}

      {/* Message d'erreur de validation client ou API */}
      {error && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Zone secondaire : Résultats de l'analyse */}
      {analysis && (
        <section
          className="photo-results"
          aria-label="Résultats de l'analyse visuelle"
        >
          <div className="photo-result-head">
            <div>
              <p className="section-label">ZONE SECONDAIRE D'ANALYSE</p>
              <h2>Résultats de l'analyse visuelle IA</h2>
            </div>
            <div className="analysis-badges">
              <span className="type-badge" title="Type de pièce identifié">
                <Layers size={13} /> {analysis.type_piece}
              </span>
              <span
                className={
                  analysis.reference_visible
                    ? "reference-badge visible"
                    : "reference-badge"
                }
                title="Détection d'un repère métrique dans l'image"
              >
                {analysis.reference_visible ? (
                  <Check size={14} />
                ) : (
                  <X size={14} />
                )}
                {analysis.reference_visible
                  ? "Repère dimensionnel visible"
                  : "Aucun repère dimensionnel visible"}
              </span>
            </div>
          </div>

          {/* Indicateur de confiance & estimation de surface */}
          {analysis.confidence_surface < 0.7 ? (
            <div className="confidence-banner warning">
              <AlertTriangle size={20} className="warning-icon" />
              <div>
                <strong>
                  Indice de confiance faible (
                  {Math.round(analysis.confidence_surface * 100)}% &lt; 70%) :
                </strong>{" "}
                La surface a été estimée sans repère dimensionnel fiable garanti.
                Veuillez vérifier et ajuster la valeur ci-dessous.
              </div>
            </div>
          ) : (
            <div className="confidence-banner success">
              <CheckCircle2 size={20} className="success-icon" />
              <div>
                <strong>
                  Indice de confiance élevé (
                  {Math.round(analysis.confidence_surface * 100)}%) :
                </strong>{" "}
                Estimation géométrique automatique basée sur les repères
                dimensionnels observés.
              </div>
            </div>
          )}

          {/* Champs éditables par l'utilisateur */}
          <div className="fields">
            <label>
              Type de pièce / zone
              <input
                type="text"
                value={analysis.type_piece}
                onChange={(event) =>
                  updateAnalysis("type_piece", event.target.value)
                }
                placeholder="Ex. Salle de bain, Cuisine, Salon…"
              />
            </label>

            <label>
              Surface estimée (m²)
              <div
                className={`surface-field ${analysis.confidence_surface < 0.7 ? "has-warning" : ""}`}
              >
                <Ruler size={16} />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={analysis.surface_m2 ?? ""}
                  onChange={(event) =>
                    updateAnalysis(
                      "surface_m2",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                  placeholder="Surface en m²"
                />
                <span className="unit-tag">m²</span>
                {analysis.confidence_surface < 0.7 && (
                  <span
                    className="surface-warning-badge"
                    title="Confiance < 70% : à vérifier"
                  >
                    <AlertTriangle size={14} /> À vérifier
                  </span>
                )}
              </div>
            </label>
          </div>

          <label className="description">
            Description des travaux et observations de la scène
            <textarea
              rows={3}
              value={analysis.description}
              onChange={(event) =>
                updateAnalysis("description", event.target.value)
              }
              placeholder="Description détaillée de la scène constatée..."
            />
          </label>

          {/* Liste des matériaux avec badges de couleur */}
          <div className="materials-section">
            <div className="materials-head">
              <p className="material-label">
                Matériaux détectés — cliquez pour sélectionner ou désélectionner
              </p>
              <button
                type="button"
                className="add-material-btn"
                onClick={() => setShowAddMaterial(!showAddMaterial)}
              >
                <Plus size={14} /> Ajouter un matériau
              </button>
            </div>

            {showAddMaterial && (
              <form
                className="material-add-form"
                onSubmit={handleAddCustomMaterial}
              >
                <input
                  type="text"
                  placeholder="Ex. Carrelage grès cérame, Placo hydrofuge..."
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="outline">
                  Ajouter
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={() => setShowAddMaterial(false)}
                >
                  Annuler
                </button>
              </form>
            )}

            <div className="material-badges">
              {(analysis.materiaux ?? []).length > 0 ? (
                analysis.materiaux.map((material) => {
                  const isSelected = selectedMaterials.includes(material);
                  const colorClass = getMaterialColorClass(material);
                  return (
                    <button
                      type="button"
                      key={material}
                      className={`material-badge ${colorClass} ${isSelected ? "selected" : "deselected"}`}
                      onClick={() => toggleMaterial(material)}
                      aria-pressed={isSelected}
                      title={
                        isSelected
                          ? "Cliquer pour retirer du devis"
                          : "Cliquer pour inclure dans le devis"
                      }
                    >
                      <span className="material-dot" />
                      {material}
                      {isSelected ? (
                        <Check size={13} className="badge-icon" />
                      ) : (
                        <X size={13} className="badge-icon" />
                      )}
                    </button>
                  );
                })
              ) : (
                <span className="no-materials">
                  Aucun matériau identifié automatiquement. Vous pouvez en
                  ajouter manuellement ci-dessus.
                </span>
              )}
            </div>
          </div>

          {/* Observations et incertitudes si présentes */}
          {analysis.observations?.length > 0 && (
            <div className="photo-observations">
              <strong>Observations d'état :</strong>
              <ul>
                {analysis.observations.map((obs, idx) => (
                  <li key={idx}>{obs}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.incertitudes?.length > 0 && (
            <p className="photo-uncertainties">
              <strong>Incertitudes détectées :</strong>{" "}
              {analysis.incertitudes.join(" • ")}
            </p>
          )}

          {/* Bouton de validation pour aller vers l'édition du devis */}
          <button
            className="validate"
            type="button"
            onClick={confirm}
            disabled={loadingMatch}
          >
            {loadingMatch ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Check size={17} />
            )}
            {loadingMatch
              ? "Génération du devis en cours…"
              : "Valider → Edit Devis"}
          </button>
        </section>
      )}
    </section>
  );
}

function buildConfirmedDescription(analysis) {
  const parts = [];
  if (analysis.description?.trim()) {
    parts.push(analysis.description.trim());
  }
  if (analysis.type_piece?.trim()) {
    parts.push(`Zone concernée : ${analysis.type_piece.trim()}.`);
  }
  if (
    analysis.surface_m2 !== null &&
    analysis.surface_m2 !== undefined &&
    analysis.surface_m2 !== ""
  ) {
    const conf = Math.round((analysis.confidence_surface ?? 0) * 100);
    parts.push(`Surface estimée : ${analysis.surface_m2} m² (confiance : ${conf}%).`);
  } else {
    parts.push("Surface à confirmer sur place.");
  }
  if (analysis.materiaux?.length) {
    parts.push(`Matériaux retenus : ${analysis.materiaux.join(", ")}.`);
  }
  parts.push(
    analysis.reference_visible
      ? "Repère dimensionnel exploitable visible sur le cliché."
      : "Aucun repère dimensionnel visible (mesures à calibrer).",
  );
  if (analysis.observations?.length) {
    parts.push(`Observations d'état : ${analysis.observations.join("; ")}.`);
  }
  return parts.join(" ");
}
