# CareTime — Outpatient Queue & Digital Health Record Platform

CareTime is a production-ready, ultra-simple outpatient management system designed for crowded clinical environments. It eliminates chaotic clinic waiting rooms by combining **Dynamic AI Wait-Time Prediction (ONNX / LightGBM)**, **Automated Staged Commute Alerts**, and **Diagnostic Report Digitization (OpenCV / Tesseract OCR)** with a calm daylight clinical UI.

---

## Key Highlights

1. **Ultra-Simple Daylight Design System:**
   - Soft daylight palette (`#F8FAFC` background, `#FFFFFF` cards, `#2563EB` medical blue, crisp high-contrast badges).
   - Generous whitespace, minimum 48px touch targets for tablets/phones, zero dark mode or flashy visual clutter.
   - Built-in **English / বাংলা (Bengali)** dynamic language toggle.

2. **Dynamic AI Wait-Time Prediction (`ai_engine/`):**
   - Regression model trained on 3,000 synthetic outpatient queue trajectories.
   - 5 Dynamic features: Patients ahead, historical baseline, rolling 3-patient pace, visit complexity weights (New Checkup = 1.4, Follow-up = 1.0, Report Show = 0.5), and doctor delay offset.
   - Exported as ONNX (`eta_model.onnx`) with sub-millisecond recalculation on every queue action.

3. **Automated Staged Commute Alerts:**
   - **~45 min ETA:** Notifies patient to start travelling to the clinic.
   - **~10 min ETA:** Notifies patient to enter the waiting area now.

4. **Safety-Guarded Clinical Cockpit:**
   - **3-Line AI Clinical Brief:** Chronic conditions, allergy alert badges, recent abnormal lab findings, and active medications.
   - **Real-time Allergy Warning:** Prescribing an antibiotic or drug conflicting with known patient allergies immediately triggers a high-visibility warning and requires confirmation to override.
   - **Longitudinal Trend Chart:** Visualizes Blood Glucose and HbA1c trajectory across visits.

5. **Diagnostic Report Digitizer (AI OCR):**
   - Image pre-processing via OpenCV (bilateral denoising and adaptive Gaussian thresholding).
   - Normalization and classification against biological reference intervals (NORMAL, HIGH, LOW, CRITICAL).
   - Strict Zero-Hallucination rule.

6. **Zero-Setup Database Architecture:**
   - Connects to PostgreSQL if `DATABASE_URL` is available.
   - Automatically and gracefully falls back to persistent local storage (`database/data.json`) if PostgreSQL is absent, ensuring 100% immediate startup out-of-the-box.

---

## Project Structure

```text
caretime/
├── package.json
├── .env
├── README.md
├── database/
│   ├── schema.sql
│   ├── seed.js
│   └── data.json              # Local fallback persistent store
├── ai_engine/
│   ├── requirements.txt
│   ├── train_eta_model.py
│   ├── ocr_extractor.py
│   └── models/
│       ├── eta_model.onnx
│       └── eta_model_metadata.json
├── server/
│   ├── index.js               # Express + Socket.io entry point
│   ├── db.js                  # PostgreSQL + auto fallback layer
│   ├── etaPredictor.js        # ONNX runtime ETA predictor
│   ├── reportProcessor.js     # Python OCR bridge
│   └── routes/
│       ├── auth.js            # Login & demo quick-login bar
│       ├── queue.js           # Live queue actions & staged alerts
│       ├── reports.js         # Lab upload & biomarker extraction
│       └── doctor.js          # Clinical brief & allergy-guarded Rx
└── public/
    ├── index.html             # Role selection & login
    ├── patient.html           # Patient live queue & report upload
    ├── assistant.html         # Compounder & assistant console
    ├── doctor.html            # Doctor cockpit & prescription pad
    └── js/
        ├── i18n.js            # English / Bengali UI dictionary
        ├── patient.js
        ├── assistant.js
        └── doctor.js
```

---

## Quick Start Instructions

### 1. Seed Database & Start Server
```bash
# Seed initial demo data (1 Doctor, 1 Assistant, 6 Patients with records)
npm run seed

# Start CareTime server (runs on port 3000)
npm start
```

### 2. Access the Applications
- **Home & Role Selector:** `http://localhost:3000/`
- **Patient Live Portal:** `http://localhost:3000/patient.html`
- **Clinic Assistant Console:** `http://localhost:3000/assistant.html`
- **Doctor Clinical Cockpit:** `http://localhost:3000/doctor.html`

### 3. Re-train ETA Predictor Model (Optional)
```bash
python ai_engine/train_eta_model.py
```

---

## Cloud Deployment (Render via Docker)

This repository includes a production-ready `Dockerfile` and `.dockerignore`.

### Deploy to Render:
1. Push this repository to GitHub or GitLab.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** -> **Web Service**.
3. Connect your repository.
4. Select **Docker** as the Runtime (Render will automatically detect the `Dockerfile`).
5. Set:
   - **Environment:** `Docker`
   - **Instance Type:** Free or Starter
   - **Health Check Path:** `/api/health`
6. Click **Deploy Web Service**.
Render will build the image, install Python ML & OCR dependencies, train the ONNX model, pre-seed the database, and bind to `PORT` on `0.0.0.0` automatically.

