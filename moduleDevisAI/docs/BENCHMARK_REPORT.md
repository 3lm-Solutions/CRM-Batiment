# AI Model Evaluation & Benchmark Report

An empirical evaluation was conducted to systematically compare AI models across two core multimodal workflows in the construction domain:
1. **Speech-to-Text Transcription of Field Audio with Specialized Construction Jargon.**
2. **Computer Vision Analysis of Job Site Photographs (Surface Area Estimation & Material Recognition).**

All benchmark drivers, test datasets, and raw evaluation logs are maintained in `benchmark/`.

## 1. Speech-to-Text (STT) Audio Benchmark

### 1.1. Dataset & Methodology
- **Dataset:** 10 real-world French construction audio recordings (`data/audio/AC_01.ogg` through `AC_10.ogg`) captured under authentic field conditions (ambient machinery, room acoustic reverberation, tool noise).
- **Evaluated Models:**
  - `whisper-large-v3` (OpenAI / Groq)
  - `whisper-large-v3-turbo` (Groq)
- **Key Metrics:**
  - **Word Error Rate (WER):** Levenshtein word distance relative to ground-truth human transcription.
  - **BTP Terminology Precision:** Exact extraction rate across 36 strict technical construction terms (*linteau, écran de sous-toiture, fêtage, rive, échafaudage, isolation EPS, ragréage, pompe à chaleur, tube PER*, etc.).
  - **Latency (p50, p95, Mean):** Total network inference turn-around time.
  - **Cost:** Billed audio duration at provider rates.

### 1.2. Comparative Results

| Metric | Whisper Large v3 | Whisper Large v3 Turbo | Turbo vs. v3 Improvement |
|---|---|---|---|
| **Attempted Cases** | 10 / 10 (100%) | 10 / 10 (100%) | Parity |
| **Mean WER (Word Error Rate)** | 0.678 | **0.544** | **- 19.8% error reduction** 🏆 |
| **BTP Technical Term Accuracy** | 38.89% (14/36) | **58.33% (21/36)** | **+ 49.9% relative gain** 🏆 |
| **p50 Latency (Median)** | 1.63 s | **1.30 s** | **- 20.2% faster** ⚡ |
| **p95 Latency** | 3.82 s | **2.71 s** | **- 29.1% more stable** ⚡ |
| **Mean Latency** | 1.90 s | **1.51 s** | **- 20.5%** |
| **Total Benchmark Cost (USD)** | $0.01397 | **$0.00503** | **- 64.0% cost reduction** 💰 |

### 1.3. Analysis & Production Recommendation
- **Decisive Advantage for Whisper Large v3 Turbo:** The Turbo variant not only executes 20% faster and reduces API cost by 64%, but also demonstrates a ~50% higher accuracy on domain-specific trade terminology when guided by our construction prompt.
- **Production Choice:** The `GroqAdapter` running `whisper-large-v3-turbo` is configured as the default speech transcription provider.

## 2. Computer Vision Benchmark

### 2.1. Dataset & Methodology
- **Dataset:** 15 varied construction job site photographs (`data/image/IC_01.jpg` through `IC_15.jpg`) encompassing bare bathrooms, kitchens undergoing renovation, structural framing, bare subfloors, and drywall installations.
- **Evaluated Models:**
  - `gemini-3.5-flash`
  - `gemini-3.6-flash`
  - `gemini-3.7-flash`
  - `gemini-3.8-flash`
- **Key Metrics:**
  - **Structured JSON Validity Rate:** Percentage of responses successfully parsing into strict Pydantic schemas without runtime exceptions.
  - **Surface Estimation Accuracy (%):** Relative error compared against ground-truth laser measurements.
  - **Materials Match Score:** Average number of materials identified matching verified site inventories.
  - **Median Latency (p50) & Average Cost per Case.**

### 2.2. Comparative Results

| Model | JSON Validity | Surface Accuracy (%) | Materials Match Score | p50 Latency | Avg Cost / Case |
|---|---|---|---|---|---|
| **Gemini 3.5 Flash** | 100% | 25.68% | 0.96 | **14.9 s** | $0.01016 |
| **Gemini 3.6 Flash** | 100% | 21.76% | 3.13 | 22.9 s | **$0.00468** |
| **Gemini 3.7 Flash** | 100% | **31.49%** 🏆 | **3.46** 🏆 | 40.3 s | $0.00528 |
| **Gemini 3.8 Flash** | 100% | 27.45% | 2.34 | 36.3 s | $0.00496 |

### 2.3. Critical Findings & Engineering Resolutions

#### The "Thinking Mode" Latency & Corruption Phenomenon
During initial evaluations on Gemini 3.7 and 3.8 Flash, requests frequently failed with HTTP 422 errors (*"The vision model returned invalid structured JSON"*) and exhibited severe latency spikes exceeding 90 seconds.  
**Root Cause:** Recent Gemini Flash releases introduced an internal reasoning monologue (*thinking process*). By default, the SDK returned internal thought tokens in `parts[0]` instead of the required JSON payload. Furthermore, a default `max_output_tokens` ceiling of 1024 truncated the structured output mid-flight.  
**Implemented Solutions:**
1. **Suppression of Thinking Budget:** Explicit configuration of `GOOGLE_THINKING_BUDGET=0` in the generation config (`thinking_config={"thinking_budget": 0}`).
2. **Thought Filtering in Adapter:** The `google_adapter.py` filters out any content blocks where `part.thought == True`.
3. **Token Limit Increase:** Output ceiling raised to 4096 tokens (`TOOLREGISTRY_MAX_OUTPUT_TOKENS=4096`).
4. **Resilient 7-Stage Fallback Parser:** Implemented in `api/routes.py` to gracefully recover unclosed brackets, markdown wrappers, and trailing commas.

Following these engineering updates, structured JSON compliance reached **100%** across all models with significantly stabilized latency.

#### Production Recommendation
- For vision workloads, **Gemini 3.8 Flash** and **Gemini 3.7 Flash** provide the ideal balance between nuanced material identification (e.g., distinguishing porcelain stoneware from ceramic wall tiles) and cost efficiency (~$0.005 per photo analysis).
- The Tool Registry in the UI enables estimators to switch models dynamically depending on task complexity.
