import { Trash2 } from "lucide-react";
import ComponentEditor from "./ComponentEditor";

export default function QuoteLine({
  line,
  componentOptions,
  onQuantityChange,
  onComponentsChange,
  onDelete,
}) {
  const selectionConfidence =
    typeof line.selection_confidence === "number"
      ? Math.round(line.selection_confidence)
      : null;
  const serviceAlerts = [
    ...(line.alertes ?? []).filter(
      (alert) => !alert.startsWith("Alerte marge"),
    ),
    ...(line.marge_pourcent !== null && line.marge_pourcent < 15
      ? ["Alerte marge basse (< 15 %)."]
      : []),
    ...(line.marge_pourcent !== null && line.marge_pourcent > 40
      ? ["Alerte marge élevée (> 40 %), à vérifier."]
      : []),
  ];
  return (
    <article className="quote-line">
      <div className="line-title">
        <h3>{line.label_prestation}</h3>
        <span>{line.sku_catalogue}</span>
      </div>
      <div className="line-details">
        <label>
          Quantité
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={line.quantite_estimee}
            onChange={(event) => onQuantityChange(event.target.value)}
          />
        </label>
        <span>{line.unite}</span>
        <span>{Number(line.prix_unitaire).toFixed(2)} € / unité</span>
        {selectionConfidence !== null && (
          <span
            className="selection-confidence"
            title="Estimation du modele : adequation de cette prestation a la demande client."
          >
            Confiance modele {selectionConfidence}%
          </span>
        )}
        <span>Coût : {Number(line.cout_total ?? 0).toFixed(2)} EUR</span>
        <span>Marge : {Number(line.marge_euros ?? 0).toFixed(2)} EUR</span>
        <strong>{Number(line.sous_total).toFixed(2)} €</strong>
        <button
          className="delete-line"
          onClick={onDelete}
          aria-label={`Supprimer ${line.label_prestation}`}
        >
          <Trash2 size={17} />
        </button>
      </div>
      {serviceAlerts.length > 0 && (
        <div className="service-alerts">
          {serviceAlerts.map((alert) => (
            <span key={alert}>{alert}</span>
          ))}
        </div>
      )}
      <details>
        <summary>Composants et couts</summary>
        <ComponentEditor
          components={line.composants ?? []}
          options={componentOptions}
          serviceQuantity={line.quantite_estimee}
          onChange={onComponentsChange}
        />
      </details>
    </article>
  );
}
