import { Plus, Trash2 } from "lucide-react";

const typeLabel = {
  materiau: "Matériau",
  main_oeuvre: "Main-d'œuvre",
};

export default function ComponentEditor({
  components,
  options,
  serviceQuantity,
  onChange,
}) {
  const updateQuantity = (index, value) => {
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    onChange(
      components.map((component, componentIndex) =>
        componentIndex === index
          ? toComponent(component, quantity, serviceQuantity)
          : component,
      ),
    );
  };
  const remove = (index) =>
    onChange(
      components.filter((_, componentIndex) => componentIndex !== index),
    );
  const add = (event) => {
    const id = Number(event.target.value);
    const option = options.find((item) => item.catalogue_item_id === id);
    if (!option || components.some((item) => item.catalogue_item_id === id))
      return;
    onChange([
      ...components,
      toComponent(
        {
          ...option,
          type: option.item_type,
          quantite_par_unite: 1,
        },
        1,
        serviceQuantity,
      ),
    ]);
    event.target.value = "";
  };

  return (
    <div className="component-editor">
      {components.length === 0 ? (
        <p className="component-empty">Aucun composant renseigné.</p>
      ) : (
        <div className="component-list">
          {components.map((component, index) => (
            <div
              className="component-row"
              key={component.catalogue_item_id ?? component.sku_catalogue}
            >
              <span className="component-type">
                {typeLabel[component.type] ?? component.type}
              </span>
              <span className="component-name">
                {component.label} <small>{component.sku_catalogue}</small>
              </span>
              <label>
                Par unité
                <input
                  type="number"
                  min="0.0001"
                  step="0.01"
                  value={component.quantite_par_unite}
                  onChange={(event) =>
                    updateQuantity(index, event.target.value)
                  }
                />
              </label>
              <span>{Number(component.cout_total ?? 0).toFixed(2)} EUR</span>
              <button
                className="delete-line"
                type="button"
                onClick={() => remove(index)}
                aria-label={`Supprimer ${component.label}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="component-add">
        <Plus size={15} /> Ajouter un matériau ou de la main-d'œuvre
        <select defaultValue="" onChange={add}>
          <option value="">Choisir...</option>
          {options
            .filter(
              (option) =>
                !components.some(
                  (component) =>
                    component.catalogue_item_id === option.catalogue_item_id,
                ),
            )
            .map((option) => (
              <option
                key={option.catalogue_item_id}
                value={option.catalogue_item_id}
              >
                {typeLabel[option.item_type]} - {option.label} ({option.unite})
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}

function toComponent(component, quantityPerUnit, serviceQuantity) {
  const unitCost = Number(component.cout_unitaire ?? 0);
  const totalQuantity = quantityPerUnit * Number(serviceQuantity ?? 0);
  return {
    ...component,
    quantite_par_unite: quantityPerUnit,
    cout_unitaire: unitCost,
    cout_par_unite_prestation: quantityPerUnit * unitCost,
    quantite_totale: totalQuantity,
    cout_total: totalQuantity * unitCost,
  };
}
