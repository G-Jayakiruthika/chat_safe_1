> **© 2026 Jayakiruthika G. All Rights Reserved.** This project is proprietary software created for evaluation purposes only. Commercial distribution, reproduction, or use without explicit written consent is strictly prohibited.

# Chat_Safe × Urimai — Edge AI Cyber Guardian & Civic Grievance Bridge

> **Hack2Skill PromptWars Final Submission** · **Zero-Backend Edge-Compute PWA** + Optional Cloud Run Reference Server · **23 Indian Languages** (English + all 22 Eighth Schedule languages) · **Zero Runtime npm Dependencies** (`66` tracked files · `98.9 KB` compiled edge engine `public/core.js`).

**Chat_Safe × Urimai** is an edge-first AI safety and civic-justice platform engineered for Bharat. With one spoken utterance or a feature-phone **Speed-Dial `9`** handoff, it protects elders and families from real-time cyber fraud (**Kavach**) while converting everyday village infrastructure breakdowns into bilingual English + regional legal petitions, geo-tagged A4 PDFs, and remote CM Helpline filings (**Urimai**).

---

## 1. Evaluate the Live Demo in Under 30 Seconds

Judges require **zero configuration and zero API keys** to evaluate every end-to-end capability:

1. **Open the App (`public/app.html` or deployed URL)**:
   - Accept the **Zero-Data-Retention & Edge Privacy Governance** modal (`Accept & Secure Workspace`).
   - Confirm the chat panel boots directly into **`Demo Mode Active: Live AI Simulator`**—no API key prompt blocks evaluation.
2. **Click `▶ Start Auto-Demo`** *(glowing CTA in the chat interface header)*:
   - **Seconds 0–6 (Kavach Cyber Fraud Defense)**: Automatically simulates Speed-Dial `9` and types `"My CBI officer is calling me for digital arrest"`, displays the **Gemini 2.5 Structured JSON Response**, animates the **Live Agent Bus** (`Vani IVR` → `Gemini Router` → `Kavach` → `Netra PII` → `Pay-Guard`), morphs the UI into the **Red Scam Card** (`HIGH RISK SCAM ALERT`) with a copyable **1930 Cybercrime Complaint** and Family SOS alert.
   - **Seconds 6–15 (Urimai Civic Petition & PDF)**: Automatically switches to the voice prompt `"Panchayat water pipe broke"`, lights up `Vani IVR` → `Gemini Router` → `Urimai` → `Setu O2O`, acquires GPS/ward coordinates, and morphs into the **Blue Civic Card** with an **Exportable Bilingual A4 PDF Preview** (`📄 Export Bilingual PDF`) and 1-click **Family Hub** / **CM Helpline** routing.
3. **Optional Live Gemini 2.5 Flash Upgrade (BYOK)**:
   - Click **`API Key`** (or the `Demo Mode Active: Live AI Simulator` pill) anytime to paste a `GEMINI_API_KEY` into transient `sessionStorage` and run live REST inference against Gemini 2.5 Flash.

---

## 2. System Architecture (ASCII Topology)

```text
+------------------------------------------------------------------------------+
|  CITIZEN ENTRY SURFACES (23 Indian Languages · RTL/LTR · WCAG 2.1 AA)        |
|  [Button Phone Speed-Dial '9' IVR]   [Web Speech Mic]   [Text / URL Paste]   |
+--------------------------------------+---------------------------------------+
                                       |
                                       v
+------------------------------------------------------------------------------+
|  STATIC EDGE PWA SHELL (public/app.html · public/app.js · public/sw.js)      |
|  * GDPR/ISO Consent Gate & Focus-Trapped Dialogs (trapModalFocus)            |
|  * One-Click Auto-Pilot Guided Demo (runAutoDemo)                            |
|  * Zero-Config Boot -> "Demo Mode Active: Live AI Simulator"                 |
+--------------------------------------+---------------------------------------+
                                       |
                                       v
+------------------------------------------------------------------------------+
|  CLIENT-SIDE INTENT ORCHESTRATOR (analyzeIntent + public/api.js)             |
|                                                                              |
|  1. Connectivity Guard (!navigator.onLine) -----------------------+          |
|  2. Cloud Run Probe (POST api/analyze) ----[if server+key]----+   |          |
|  3. Edge BYOK REST (Gemini 2.5 Flash) -----[if session key]-+ |   |          |
|  4. Zero-Config Fallback (runMockFallbackEngine + core.js)<-+-+---+          |
+-------+------------------------------+------------------------------+--------+
        |                              |                              |
        v                              v                              v
+---------------+             +-----------------+            +-----------------+
| Google Safe   |             | Google Maps     |            | 8-Agent Bus     |
| Browsing v4   |             | Geocoding API   |            | Vani·Gemini·    |
| (URL Threat   |             | (Ward / GPS     |            | Kavach·Urimai·  |
|  Override=100)|             |  Fallback)      |            | Netra·Setu·Pay  |
+-------+-------+             +--------+--------+            +--------+--------+
        |                              |                              |
        +------------------------------+------------------------------+
                                       |
                +----------------------+----------------------+
                |                                             |
                v                                             v
+-------------------------------+           +----------------------------------+
| KAVACH SCAM SHIELD (Red UI)   |           | URIMAI CIVIC ENGINE (Blue UI)    |
| * Tiered Scoring:             |           | * Bilingual English + Regional   |
|   0-25 SAFE / 26-65 MODERATE  |           |   Legal Petition Drafts          |
|   66-100 CRITICAL SCAM        |           | * Exportable A4 PDF Preview      |
| * 1930 Cybercrime Draft       |           |   (Photo + 5-Resident Signatures)|
| * Family SOS + Kamala Paati   |           | * State CM Portal & Proxy Link   |
+-------------------------------+           +----------------------------------+
```

### Hybrid Edge-Compute + Cloud Run Portability
- **Static PWA Shell (`public/`)**: Offline-capable via `public/sw.js` (`chatsafe-v4.8`) and Android OS `share_target` (`public/manifest.webmanifest`).
- **Deterministic Edge Engine (`public/core.js`)**: Compiled from 10 pure-JS modules in `src/` via `tools/build-core.js` (`window.ChatSafeCore`), powering instant offline intent classification, weighted threat scoring, Netra PII redaction, and bilingual Urimai petition assembly.
- **Optional Zero-Dependency Node.js Server (`server.js` / `src/app.js`)**: Provides `/api/analyze`, `/api/urimai`, `/api/radar`, `/api/safebrowsing`, Argon2id + AES-256-GCM account persistence (`src/db.js`), and strict HTTP security headers for Cloud Run deployments.

---

## 3. Live Performance Benchmarks (< 500 ms Edge SLA)

Measured directly against the compiled domain engine (`src/engine.js` → `public/core.js`) on Node.js `v26.13.1` with zero external network hops in Zero-Config Simulator Mode:

| Operation / Benchmark Scenario | Observed Latency | Edge SLA Target | Observed Output / Notes |
| :--- | :---: | :---: | :--- |
| **Cold Scam Classification** (`"My CBI officer is calling me for digital arrest"`) | **5.35 ms** | `< 500 ms` | `intent: "SCAM"`, `score: 72` (boosted to `81` critical tier in UI), 3 red-flag vectors |
| **Cold Civic Classification** (`"Panchayat water pipe broke"`) | **16.73 ms** | `< 500 ms` | `intent: "CIVIC"`, `score: 0`, routed to Urimai petition pipeline |
| **Bilingual Urimai Kit Assembly** (`engine.urimai` + 5-signature metadata + proxy URL) | **0.98 ms** | `< 500 ms` | Generated `kitId: "URM-MB7EXT"`, English + regional letters, CM portal payload |
| **Sustained Throughput** (`100` sequential `engine.analyze` invocations) | **0.038 ms / req** | `< 500 ms` | LRU cache (`src/lru.js`, 200 entries) + pure-JS token rules |
| **Total Automated Suite** (`npm run coverage`, 13 tests) | **1.28 s total** | `< 5 s` | `13/13` passing (`0` failures, `77.20%` overall line coverage) |

> **Why it stays sub-500 ms everywhere**: When `navigator.onLine === false` or no BYOK key is configured, `analyzeIntent()` bypasses remote network round-trips entirely and executes locally in `~5–17 ms` cold (`< 0.05 ms` warm). When a BYOK Gemini 2.5 Flash key is supplied, requests are bounded by a `12,000 ms` `AbortController` timeout with automatic failover to the local engine.

---

## 4. Hack2Skill Rubric Compliance Table

| Rubric Dimension | Engineering Implementation & Verification Evidence | Primary Artifacts |
| :--- | :--- | :--- |
| **AI Prompting & Orchestration** | Structured Gemini 2.5 Flash `responseSchema` (`SAFE` `0–25`, `MODERATE` `26–65`, `CRITICAL` `66–100`, `CIVIC`), XML `<suspect>` / `<grievance>` prompt-injection sandboxing, Safe Browsing URL override (`score = 100`), and animated 8-agent bus. | `public/app.js` (`processWithGemini`, `ROUTER_SYSTEM_PROMPT`), `src/gemini.js`, `public/agentAvatars.js` |
| **Code Quality & Standards** | Zero runtime npm dependencies, modular `src/` → `public/core.js` build pipeline, `'use strict'`, HTML escaping (`escapeHtml`), and **100% JSDoc `@param` / `@returns` coverage** across all functions in `public/app.js` (`Missing JSDoc: []`). | `public/app.js`, `src/engine.js`, `tools/build-core.js`, `package.json` |
| **Security & Privacy** | Volatile `sessionStorage` BYOK credential isolation (zero secrets in repo), strict HTTP & `<meta>` CSP, Argon2id password hashing + `crypto.timingSafeEqual`, AES-256-GCM PII encryption, `SameSite=Strict` double-submit CSRF tokens, per-IP rate limiting, and dotfile blocking (`403`). | `src/app.js`, `src/db.js`, `public/app.html`, `test/security.test.js` |
| **Efficiency & Resilience** | `98.9 KB` compiled edge engine (`public/core.js`), 200-entry LRU cache (`src/lru.js`), `sw.js` offline shell (`chatsafe-v4.8`), sub-20 ms local cold inference, and structured `try...catch` error boundaries on every `fetch`, Web Speech, and Geolocation call. | `public/core.js`, `public/sw.js`, `src/lru.js`, `public/app.js` |
| **Accessibility (a11y) & Responsive UX** | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` across all modals, `trapModalFocus()` (`Tab`/`Shift+Tab` trapping, `Escape` dismissal, focus restoration), 4-step font scaling (`1x`–`1.5x`), High Contrast, RTL/LTR sync across 23 Indian languages, and overflow-free responsive headers (`320px`–`1440px+`). | `public/app.js`, `public/app.html`, `public/index.html`, `public/styles.css`, `public/landing.css`, `public/theme.js` |
| **Edge-Case & Automated Testing** | Tested against offline mode, denied mic/GPS hardware permissions, expired 15-min reset tokens, SQL injection payloads, honeypots, and 40-request concurrency spikes. **`13/13` tests passing** at **`77.20%` overall line coverage** (`100%` on `extract.js`, `languages.js`, `radarData.js`; `98.55%` on `urimai.js`; `98.43%` on `rules.js`). | `test/engine.test.js`, `test/languages.test.js`, `test/security.test.js`, `test/urimai.test.js` |

---

## 5. Security, Privacy & Prompt-Injection Hardening

### Transient `sessionStorage` BYOK Model
- **Zero Embedded Secrets**: `.gitignore` excludes `.env`, `.env.*`, `*.pem`, `*.key`, `*.sqlite*`, and `node_modules/`.
- **Volatile Client Keys**: `showByokModal()` stores optional user keys (`GEMINI_API_KEY`, `GOOGLE_MAPS_KEY`, `SAFE_BROWSING_KEY`) strictly in browser `sessionStorage`, clearing automatically when the tab closes or when **Clear Key** / **Right to Erasure** is invoked.

### Strict Content Security Policy (CSP) & HTTP Hardening
- `public/app.html` enforces `<meta http-equiv="Content-Security-Policy">` restricting connections solely to `'self'`, `https://generativelanguage.googleapis.com`, `https://maps.googleapis.com`, and `https://safebrowsing.googleapis.com`.
- `src/app.js` applies `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Strict-Transport-Security`, `16 KB` JSON body limits, and `503 Retry-After: 2` concurrency shedding (`MAX_CONCURRENT_REQUESTS = 200`).

---

## 6. Local Execution & Verification Guide

### Prerequisites
- **Node.js `>= 20`** (tested on Node `v22` in CI/Dockerfile and Node `v26.13.1` locally).

### Option A: Zero-Backend Static PWA (GitHub Pages Parity)
```bash
node tools/build-core.js public
npx serve public -l 8080
# Open http://localhost:8080/app.html and click "▶ Start Auto-Demo"
```

### Option B: Full Node.js Server (Cloud Run Parity)
```bash
cp .env.example .env   # Optional: add GEMINI_API_KEY
npm run build
npm start
# Open http://localhost:8080/app.html
```

### Automated Test & Coverage Verification
```bash
node --check public/app.js
npm test
npm run coverage
```
Expected result: **`13/13` passing tests** (`0` failures, `0` skipped).
