# Global Care – PhilHealth Benefits Utilization Flow

Interactive React + TypeScript version of the PhilHealth Benefits Navigator for **Global Care Medical Center – Canlubang**.

Same design and flow as the HTML demo:
- Blue primary / Green secondary theme
- Patient Entry Points → Navigator → ER Triage / YAKAP paths → Benefit packages
- YAKAP, OECB, Admitted (NBB/ACR), Cancer Screening, Z-Benefit

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

## Project structure

```
philhealth-yakap-flow/
├── public/
│   └── global-care-logo.svg
├── src/
│   ├── App.tsx          ← main flow logic & UI (edit here)
│   ├── index.css        ← styles / theme
│   ├── main.tsx
│   └── vite-env.d.ts
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

## Deploy to GitHub Pages (free website)

1. Push this folder to a GitHub repository named `philhealth-yakap-flow`  
   (or change `base` in `vite.config.ts` to match your repo name).

2. In the repo on GitHub:  
   **Settings → Pages → Build and deployment**  
   - Source: **GitHub Actions**

3. Create the workflow file  
   `.github/workflows/deploy.yml` with:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

4. Push the workflow, wait for the Action to finish.  
   Your site will be at:  
   `https://YOUR_USERNAME.github.io/philhealth-yakap-flow/`

**Note:** If your repo has a different name, update `base` in `vite.config.ts` to `'/your-repo-name/'`.
