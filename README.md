# Global Care – PhilHealth Benefits Utilization Flow

Interactive React + TypeScript version of the **Global Care Canlubang PhilHealth Ecosystem** flowchart.

## Flow (matches the official ecosystem diagram)

1. **Patient Enters GCC**  
   ER · OPD · Direct Admission / Procedure / Maternity

2. **GCC PhilHealth Screening Coordinator**  
   Identity Verify · Pin/PBEF Validation · Program Screen

3. **Clinical Classification**  
   Which PhilHealth benefit is applicable?

4. **Benefit Pathways**
   - **Emergency Room** → Admissible (ACR / NBB) or Non-Admissible (OECB)
   - **OPD – YAKAP** → Standard benefits or Cancer Screening
   - **Special Package** → AMI · Maternity & New Born · Rehab · Dialysis · Animal Bite · Day Surgery
   - **Z Benefit** → Z Package

5. **Benefit Coordination Engine**  
   Primary Package → Secondary Benefits → Documentation → SOA/eSOA → PhilHealth Deduction → Final Bill/Discharge → eCLAIMS 3.0 + CF5

6. **Post-Discharge Continuity**  
   YAKAP Follow-up · Gamot (Pharmacy & MedPure) · Follow-up/Referral

## Run locally

```bash
cd philhealth-yakap-flow
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Android app

See **[ANDROID.md](./ANDROID.md)** for Capacitor + Android Studio steps.

```bash
npm run android:build
npm run android:open
```

## Project structure

```
philhealth-yakap-flow/
├── public/
│   └── global-care-logo.svg
├── src/
│   ├── App.tsx          ← main flow logic & UI
│   ├── Dashboard.tsx    ← flow monitor
│   ├── index.css        ← styles / theme
│   ├── main.tsx
│   └── vite-env.d.ts
├── capacitor.config.ts  ← Android wrapper
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Editing tips

- **Flow / screens / results** → edit `src/App.tsx`
- **Colors, cards, layout** → edit `src/index.css` (CSS variables at the top)
- **Logo** → replace `public/global-care-logo.svg`

## Deploy to GitHub Pages

1. Push to a repo named `philhealth-yakap-flow` (or update `base` in `vite.config.ts`).
2. Use GitHub Actions with Pages source = GitHub Actions.
3. Site will be at: `https://YOUR_USERNAME.github.io/philhealth-yakap-flow/`
4. For GitHub Pages builds, set `GITHUB_PAGES=1` so Vite uses the repo base path.
