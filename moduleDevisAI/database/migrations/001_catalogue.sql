CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE catalogue_items (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  sku_catalogue TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('prestation','materiau','main_oeuvre')),
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unite TEXT NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  unit_sale_price NUMERIC(12,2) CHECK (unit_sale_price >= 0),
  source_hash TEXT,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  search_document TSVECTOR GENERATED ALWAYS AS (to_tsvector('french', coalesce(label,'') || ' ' || coalesce(description,'') || ' ' || coalesce(sku_catalogue,''))) STORED,
  embedding VECTOR(768),
  embedding_model TEXT,
  embedding_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, sku_catalogue)
);
CREATE INDEX catalogue_items_tenant_active_idx ON catalogue_items(company_id, actif);
CREATE INDEX catalogue_items_lexical_idx ON catalogue_items USING GIN(search_document);
CREATE INDEX catalogue_items_embedding_idx ON catalogue_items USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

CREATE TABLE catalogue_item_components (
  prestation_id BIGINT NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
  component_id BIGINT NOT NULL REFERENCES catalogue_items(id) ON DELETE RESTRICT,
  quantity_per_unit NUMERIC(12,4) NOT NULL CHECK (quantity_per_unit > 0),
  PRIMARY KEY (prestation_id, component_id),
  CHECK (prestation_id <> component_id)
);
CREATE INDEX catalogue_item_components_component_idx ON catalogue_item_components(component_id);

CREATE TABLE quotation_snapshots (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  request_description TEXT NOT NULL,
  quotation_lines JSONB NOT NULL,
  financial_summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quotation_snapshots_company_created_idx ON quotation_snapshots(company_id, created_at DESC);

CREATE TABLE catalogue_profitability_history (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  catalogue_item_id BIGINT NOT NULL REFERENCES catalogue_items(id) ON DELETE RESTRICT,
  unit_sale_price NUMERIC(12,2) NOT NULL CHECK (unit_sale_price >= 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  margin_percent NUMERIC(8,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX catalogue_profitability_history_item_idx
  ON catalogue_profitability_history(company_id, catalogue_item_id, recorded_at DESC);
