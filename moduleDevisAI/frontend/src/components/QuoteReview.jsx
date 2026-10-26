import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import QuoteLine from "./QuoteLine";

const catalogueUrl =
  import.meta.env.VITE_CATALOGUE_PRESTATIONS_URL ||
  "/api/v1/catalogue/prestations";
const componentsUrl =
  import.meta.env.VITE_CATALOGUE_COMPONENTS_URL ||
  "/api/v1/catalogue/components";

export default function QuoteReview({ quote, onBack }) {
  const [lines, setLines] = useState(() =>
    (quote.lines ?? []).map(prepareLine),
  );
  const [serviceId, setServiceId] = useState("");
  const [options, setOptions] = useState([]);
  const [componentOptions, setComponentOptions] = useState([]);
  const [optionsError, setOptionsError] = useState("");

  useEffect(() => {
    const companyId = Number(import.meta.env.VITE_COMPANY_ID);
    if (!Number.isInteger(companyId) || companyId < 1) return;

    Promise.all([
      loadCatalogue(catalogueUrl, companyId),
      loadCatalogue(componentsUrl, companyId),
    ])
      .then(([services, components]) => {
        setOptions(services.items ?? []);
        setComponentOptions(components.items ?? []);
      })
      .catch((error) => setOptionsError(error.message));
  }, []);

  const total = lines.reduce(
    (sum, line) => sum + Number(line.sous_total ?? 0),
    0,
  );
  const totalCost = lines.reduce(
    (sum, line) => sum + Number(line.cout_total ?? 0),
    0,
  );
  const totalMargin = total - totalCost;
  const marginPercent = total > 0 ? (totalMargin / total) * 100 : 0;
  const updateQuantity = (index, value) => {
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? recalculateLine({ ...line, quantite_estimee: quantity })
          : line,
      ),
    );
  };
  const updateComponents = (index, components) => {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? recalculateLine({
              ...line,
              composants: components,
              composition_editee: true,
            })
          : line,
      ),
    );
  };
  const addService = () => {
    const option = options.find(
      (item) => String(item.catalogue_item_id) === serviceId,
    );
    if (
      !option ||
      lines.some((line) => line.catalogue_item_id === option.catalogue_item_id)
    ) {
      return;
    }
    setLines((current) => [
      ...current,
      {
        ...option,
        label_prestation: option.label,
        quantite_estimee: 1,
        sous_total: option.prix_unitaire,
        cout_unitaire: option.cout_unitaire,
        cout_total: option.cout_unitaire,
        marge_euros: option.prix_unitaire - option.cout_unitaire,
        marge_pourcent:
          option.prix_unitaire > 0
            ? ((option.prix_unitaire - option.cout_unitaire) /
                option.prix_unitaire) *
              100
            : null,
        coefficient_prix:
          option.cout_unitaire > 0
            ? option.prix_unitaire / option.cout_unitaire
            : 1,
        composants: [],
      },
    ]);
    setServiceId("");
  };

  return (
    <div className="shell quote-page">
      <header className="hero">
        <div>
          <p className="eyebrow">
            <Sparkles size={14} /> MODULE DEVIS IA
          </p>
          <h1>Révision du devis</h1>
          <p>Vérifiez les prestations et ajustez les quantités avant export.</p>
        </div>
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={17} /> Modifier la demande
        </button>
      </header>
      <main className="quote-card">
        <div className="quote-heading">
          <div>
            <p className="section-label">DEVIS PROPOSÉ</p>
            <h2>
              {lines.length} prestation{lines.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="quote-totals">
            <strong>Total HT : {total.toFixed(2)} EUR</strong>
            <span>Coût : {totalCost.toFixed(2)} EUR</span>
            <span>
              Marge : {totalMargin.toFixed(2)} EUR ({marginPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
        {quote.model_trace?.model && (
          <p className="model-trace">
            Sélection IA : {quote.model_trace.provider} /{" "}
            {quote.model_trace.model}
            {quote.model_trace.model_version
              ? ` (version utilisée : ${quote.model_trace.model_version})`
              : ""}
          </p>
        )}
        {lines.length === 0 ? (
          <p className="empty-quote">
            Aucune prestation sélectionnée. Ajoutez une prestation du catalogue.
          </p>
        ) : (
          <div className="quote-lines">
            {lines.map((line, index) => (
              <QuoteLine
                key={line.catalogue_item_id}
                line={line}
                componentOptions={componentOptions}
                onQuantityChange={(value) => updateQuantity(index, value)}
                onComponentsChange={(components) =>
                  updateComponents(index, components)
                }
                onDelete={() =>
                  setLines((current) =>
                    current.filter((_, lineIndex) => lineIndex !== index),
                  )
                }
              />
            ))}
          </div>
        )}
        <section className="add-service">
          <label>
            Ajouter une prestation du catalogue
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">Choisir une prestation...</option>
              {options
                .filter(
                  (option) =>
                    !lines.some(
                      (line) =>
                        line.catalogue_item_id === option.catalogue_item_id,
                    ),
                )
                .map((option) => (
                  <option
                    value={option.catalogue_item_id}
                    key={option.catalogue_item_id}
                  >
                    {option.label} - {Number(option.prix_unitaire).toFixed(2)}
                    {" EUR / "}
                    {option.unite}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="add-button"
            disabled={!serviceId}
            onClick={addService}
          >
            <Plus size={17} /> Ajouter
          </button>
        </section>
        {optionsError && <p className="error">{optionsError}</p>}
        {(quote.alertes?.length > 0 || quote.assumptions?.length > 0) && (
          <section className="quote-notes" aria-label="Notes du devis">
            {quote.alertes?.map((alert) => (
              <p key={alert}>{alert}</p>
            ))}
            {quote.assumptions?.map((assumption) => (
              <p key={assumption}>{assumption}</p>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function loadCatalogue(url, companyId) {
  return fetch(`${url}?company_id=${companyId}`).then((response) =>
    response.ok
      ? response.json()
      : Promise.reject(new Error("Catalogue indisponible.")),
  );
}

function recalculateLine(line) {
  const quantity = Number(line.quantite_estimee ?? 0);
  const components = (line.composants ?? []).map((component) => {
    const quantityPerUnit = Number(component.quantite_par_unite ?? 0);
    const unitCost = Number(component.cout_unitaire ?? 0);
    return {
      ...component,
      quantite_totale: quantityPerUnit * quantity,
      cout_par_unite_prestation: quantityPerUnit * unitCost,
      cout_total: quantityPerUnit * quantity * unitCost,
    };
  });
  const componentCost = components.reduce(
    (sum, component) => sum + Number(component.cout_par_unite_prestation ?? 0),
    0,
  );
  const unitCost =
    components.length > 0
      ? componentCost
      : line.composition_editee
        ? 0
        : Number(line.cout_unitaire ?? 0);
  const unitPrice = line.composition_editee
    ? unitCost * Number(line.coefficient_prix ?? 1)
    : Number(line.prix_unitaire ?? 0);
  const subtotal = quantity * unitPrice;
  const costTotal = quantity * unitCost;
  const margin = subtotal - costTotal;
  return {
    ...line,
    composants: components,
    cout_unitaire: unitCost,
    prix_unitaire: unitPrice,
    sous_total: subtotal,
    cout_total: costTotal,
    marge_euros: margin,
    marge_pourcent: subtotal > 0 ? (margin / subtotal) * 100 : null,
  };
}

function prepareLine(line) {
  const unitCost = Number(line.cout_unitaire ?? 0);
  return {
    ...line,
    coefficient_prix:
      unitCost > 0 ? Number(line.prix_unitaire ?? 0) / unitCost : 1,
  };
}
