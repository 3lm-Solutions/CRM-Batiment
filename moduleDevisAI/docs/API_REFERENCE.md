# REST API Specification - AI Quotation Module

This document provides the complete API specification for the FastAPI backend powering the **AI Quotation Module** (`moduleDevisAI`).

- **Base URL (Local Development):** `http://localhost:8000`
- **Content Types:** `application/json`, `multipart/form-data` (audio uploads), `application/pdf`
- **Interactive Documentation:** Available at `/docs` (Swagger UI) and `/redoc` (ReDoc)

## 1. Endpoints Summary

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/v1/devis/photo-analyze` | Analyzes site photos via vision AI (room type, surface area, confidence, materials) |
| `POST` | `/api/v1/devis/vocal-transcribe` | Transcribes audio memos into clean text optimized for French construction terms |
| `POST` | `/api/v1/devis/match-catalogue` | Executes hybrid RAG and matches user requirements to catalogue items |
| `POST` | `/api/v1/devis/pdf` | Produces an official vector PDF quotation and persists an immutable snapshot |
| `GET` | `/api/v1/catalogue/prestations` | Lists active high-level services for a given company |
| `GET` | `/api/v1/catalogue/components` | Lists elementary components (materials, labor) for a given company |

## 2. Construction Site Photo Analysis

### `POST /api/v1/devis/photo-analyze`

Analyzes a Base64-encoded construction photograph. Extracts the room/zone classification, metric surface area estimation, confidence rating, detected physical reference markers, and identified materials.

#### Request Body (`application/json`)
```json
{
  "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...",
  "provider": "google",
  "model": "gemini-3.8-flash"
}
```

#### Field Specifications (`PhotoAnalyzeRequest`)
- `image_base64` *(string, required)*: Base64 data URI or raw Base64 string (accepted formats: JPEG, PNG; maximum payload: 10MB).
- `provider` *(string, optional, default: `"google"`)*: AI vision provider.
- `model` *(string, optional, default: `"gemini-3.8-flash"`)*: Specific vision model identifier.

#### Successful Response (`200 OK`)
```json
{
  "type_piece": "Salle de bain",
  "surface_m2": 7.5,
  "confidence_surface": 0.85,
  "materiaux": ["carrelage grès cérame", "faïence murale", "peinture hydrofuge"],
  "reference_visible": true,
  "notes_observations": "Traces of dampness on north wall; fungicide primer recommended before tiling.",
  "incertitudes": ["Exact screed depth under shower tray uncertain"],
  "description_synthetique": "Full renovation of a 7.5 m² bathroom with porcelain floor tiles, wall tiling, and moisture-resistant paint.",
  "provider": "google",
  "model": "gemini-3.8-flash"
}
```

#### Error Responses
- `400 Bad Request`: Corrupted image data, invalid base64 encoding, or unsupported MIME type.
- `413 Request Entity Too Large`: Image file exceeds the 10MB size limit.
- `422 Unprocessable Entity`: Vision model response could not be parsed into valid structured schema.

## 3. Voice Memo Transcription

### `POST /api/v1/devis/vocal-transcribe`

Transcribes field audio recordings into clean text, enriched with French construction terminology via system prompt priming.

#### Query & Form-Data Parameters
- `file` *(UploadFile, optional if `audio_base64` provided)*: Binary audio file (WAV, MP3, WebM, OGG).
- `audio_base64` *(string, optional if `file` provided)*: Base64-encoded audio payload.
- `provider` *(string, query param, default: `"groq"`)*: STT provider (`"groq"`, `"openai"`).
- `model` *(string, query param, default: `"whisper-large-v3-turbo"`)*: Target Whisper model.

#### Successful Response (`200 OK`)
```json
{
  "transcription_texte": "Rénovation complète d'un salon de 25 m2. Prévoir ragréage autolissant, pose d'un carrelage 60x60 gris et peinture blanche deux couches sur murs et plafonds.",
  "duration_seconds": 12.4,
  "provider": "groq",
  "model": "whisper-large-v3-turbo"
}
```

## 4. Grounded Catalogue Matching

### `POST /api/v1/devis/match-catalogue`

Executes the Reciprocal Rank Fusion (RRF) search across the company catalogue, selects relevant services via isolated LLM reasoning, and deterministically computes line item costs and gross margins.

#### Request Body (`application/json`)
```json
{
  "company_id": 1,
  "description_libre": "Pose d'un carrelage au sol 60x60 dans une cuisine de 14 m² avec préparation du sol.",
  "modalite_source": "image",
  "provider": "google",
  "model": "gemini-3.8-flash",
  "image_analysis": {
    "type_piece": "Cuisine",
    "surface_m2": 14.0,
    "confidence_surface": 0.85,
    "materiaux": ["carrelage", "plâtre"],
    "reference_visible": true
  }
}
```

#### Successful Response (`200 OK`)
```json
{
  "request_description": "Pose d'un carrelage au sol 60x60 dans une cuisine de 14 m² avec préparation du sol.",
  "lines": [
    {
      "catalogue_item_id": 32,
      "sku_catalogue": "PREP-RAGREAGE",
      "label_prestation": "Préparation sol et ragréage",
      "quantite_estimee": 14.0,
      "unite": "M2",
      "prix_unitaire": 24.00,
      "sous_total": 336.00,
      "cout_unitaire": 13.32,
      "cout_total": 186.48,
      "marge_euros": 149.52,
      "marge_pourcent": 44.50,
      "alertes": ["Alerte marge élevée (> 40 %), à vérifier."],
      "composants": [
        {
          "component_id": 7,
          "sku": "MAT-RAGREAGE",
          "label": "Ragréage autolissant sol",
          "type": "materiau",
          "unite": "KG",
          "quantite_par_unite": 10.0,
          "quantite_totale": 140.0,
          "cout_unitaire": 0.78,
          "cout_total": 109.20
        },
        {
          "component_id": 25,
          "sku": "MO-CAR-SOL",
          "label": "Main oeuvre pose carrelage sol",
          "type": "main_oeuvre",
          "unite": "HEURE",
          "quantite_par_unite": 0.16,
          "quantite_totale": 2.24,
          "cout_unitaire": 34.00,
          "cout_total": 76.16
        }
      ]
    },
    {
      "catalogue_item_id": 33,
      "sku_catalogue": "PREST-CAR-SOL",
      "label_prestation": "Pose carrelage sol intérieur",
      "quantite_estimee": 14.0,
      "unite": "M2",
      "prix_unitaire": 82.00,
      "sous_total": 1148.00,
      "cout_unitaire": 63.20,
      "cout_total": 884.80,
      "marge_euros": 263.20,
      "marge_pourcent": 22.93,
      "alertes": [],
      "composants": [ ... ]
    }
  ],
  "total_ht": 1484.00,
  "cout_total": 1071.28,
  "marge_total_euros": 412.72,
  "marge_pourcent": 27.81,
  "alertes": ["Alerte marge élevée (> 40 %), à vérifier."],
  "assumptions": ["14.0 m² surface inferred from scope."],
  "model_trace": {
    "provider": "google",
    "model": "gemini-3.8-flash"
  }
}
```

## 5. PDF Generation & Snapshot Storage

### `POST /api/v1/devis/pdf`

Validates quotation lines, writes an immutable audit record to `quotation_snapshots`, and generates a downloadable vector PDF.

#### Request Body (`application/json`)
```json
{
  "company_id": 1,
  "reference": "DEV-IA-1730501234567",
  "date": "02/11/2026",
  "vat_rate": 20.0,
  "request_description": "Kitchen renovation 14 m²",
  "company": {
    "name": "Entreprise Demo BTP",
    "address": "12 Rue de la Construction, 75001 Paris",
    "phone": "01 23 45 67 89",
    "email": "contact@demo-btp.fr",
    "siret": "123 456 789 00012"
  },
  "customer": {
    "first_name": "Jean",
    "last_name": "Dupont",
    "address": "45 Avenue du Chantier, 75002 Paris",
    "phone": "06 12 34 56 78",
    "email": "jean.dupont@email.fr"
  },
  "notes": "Quotation generated via AI Assistant - pending commercial validation.",
  "lines": [
    {
      "label": "Pose carrelage sol intérieur",
      "quantity": 14.0,
      "unit": "M2",
      "unit_price": 82.00,
      "total_ht": 1148.00,
      "components": []
    }
  ],
  "total_ht": 1148.00,
  "total_vat": 229.60,
  "total_ttc": 1377.60
}
```

#### Response Headers
- `Content-Type`: `application/pdf`
- `Content-Disposition`: `attachment; filename="devis-DEV-IA-1730501234567.pdf"`
- `X-Quotation-Snapshot-Id`: `24` *(Primary key of the saved database snapshot)*

## 6. Catalogue Read APIs

### `GET /api/v1/catalogue/prestations?company_id={company_id}`
Returns all active top-level services configured for the company.

### `GET /api/v1/catalogue/components?company_id={company_id}`
Returns all active elementary sub-components (materials and labor units) available for composing custom services.
