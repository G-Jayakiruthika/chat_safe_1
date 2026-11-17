# Chat_Safe × Urimai — AI Cyber Guardian & Last-Mile Civic Rights Bridge

> **Built for Hack2Skill** · Supporting **23 Indian Languages** (English + all 22 Eighth Schedule languages) · Zero-dependency Node.js + Gemini 2.5 Flash + Zero-Install GitHub Pages PWA.

## The Problem We Solve
1. **Cyber Fraud Epidemic**: Indians lost **₹19,812 Crore** across **21.7 lakh** cybercrime complaints in 2025. Elderly & rural users on keypad phones often cannot spot fake "digital arrest", KYC/OTP, or non-SEBI UPI scams in time.
2. **Last-Mile Civic Exclusion**: Rural elders on button phones cannot type formal English/regional legal petitions, snap street photos, or navigate state grievance portals when water pipes break or roads collapse.

## How Chat_Safe × Urimai Works (End-to-End Flow)

### Step 1 & 2 — Single Voice Prompt (Speed-Dial `'9'`) + Gemini Intent Routing
- Rural parent presses **`9`** on a keypad phone. **Vani Voice IVR** answers in their native language (`"Vanakkam. Tell me what happened."` across 23 languages).
- **Gemini 2.5 Flash** classifies intent in real time:
  - **Scenario A (Kavach — Scam)**: *"A man asked for my OTP for the bank."* → Triggers **Red Alert**, updates 3D Kavach eyes to Furious Red, drafts a **1930 Cybercrime Complaint**, and flashes a **Live SOS** on the Family Hub.
  - **Scenario B (Urimai — Civic)**: *"The panchayat water pipe on my street broke 3 days ago and no one is fixing it."* → Activates the **Urimai Engine**.

### Step 3 & 4 — Multi-Modal O2O Handoff (Family Hub)
- Voice AI replies: *"I understand the water pipe is broken. I have drafted an official complaint to the Municipal Water Board and sent it to your son's phone to submit."*
- Instantly on the Family Hub:
  - **Parent's Voice Recording** playback
  - **Bilingual Legal Petition** (Official English + any of 23 Indian scripts)
  - **Photo Prompt & Unicode A4 PDF Generator**: Son uploads a photo; Urimai embeds it directly into a crisp A4 PDF with the **"Signatures of Affected Residents (Minimum 5 required)"** table and local Ward Office delivery instructions.

### Adaptive Solutions for Remote Sons/Daughters
- **Solution 1 — Digital-First Bypass**: When in another city, switch to **State CM Helpline Mode** (*Tamil Nadu Mudhalvarin Mugavari, Namma Chennai, National CPGRAMS, Maharashtra Aaple Sarkar, Karnataka Janaspandana*, etc.) with 1-click formatted copy text and portal launch.
- **Solution 2 — Local Proxy (WhatsApp Handoff)**: Forward a unique secure link (`proxy.html?kit=...`) via WhatsApp to a neighbor, auto driver, or village e-Seva (CSC) operator so they can snap the photo and generate the local PDF.

## Core Tabs & Features
- **Tab 1 — 📍 Radar & Daily Video Reels**: City-filtered threat scroll with **PII Auto-Redaction** (`[NAME_REDACTED]`, `[PHONE_REDACTED]`, `[UPI_REDACTED]`), anonymized **Civic Watch**, vertical scrollable **Daily Scam Video Reels**, and a **Verified User Video Publisher**.
- **Tab 2 — 🛡️ AI Scanner**: Unified input + mic with automatic **Red (Kavach)** vs **Blue (Urimai)** smart routing + scan history.
- **Tab 3 — 👨‍👩‍👧 Family Hub**: Live SOS alerts, O2O Action Kit, Photo + Bilingual Unicode PDF + 5-Signature Table, CM Helpline Bypass, and Local Proxy WhatsApp Handoff.
- **Tab 4 — 🔥 Daily Streak**: Tinder-style swipe-to-survive game with micro-learning giveaway clues & flame streak counter.
- **Extra Pages**: [8 Scams Sticky Scroll 3D Phone Demo](public/demo.html) · [Local Proxy Camera Page](public/proxy.html) · [Connect Apps & Twilio IVR](public/connect.html) · [Account & Streak](public/account.html).
- **Accessibility & Customization**: Preloader with percentage & scramble animation, 8 Sea-Creature Palettes, Minimalist/Immersive mode, 5 Custom Cursors (`Orbit`, `Comet`, `Neon`, `Spark`, `System`), High Contrast, Wide Dyslexia-Friendly Spacing, and 8 Animated AI Agent Avatars.

## Google Ecosystem Integration
- **Google Gemini 2.5 Flash**: Structured JSON Intent Classification, Bilingual Legal Drafting, PII Auto-Redaction, Kamala Paati Decoy.
- **Web Speech & Google TTS**: 23-language voice input & spoken alerts.
- **Google Maps / Geolocation**: Ward detection & remote-vs-local adaptive routing.
- **Gmail & Google Docs Export**: 1-click pre-filled official grievance drafts.
- **Android PWA Share Target & Google Cloud Run**: Installable PWA (`manifest.webmanifest`) + containerized Node server (`Dockerfile`).

## Run Locally & Test
```bash
npm test
npm run build
npm start
```
Set `GEMINI_API_KEY` in `.env` for live Gemini 2.5 Flash responses (runs 100% deterministically offline when no key is set).
