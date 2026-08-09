import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set base to '/YOUR_REPO_NAME/' for GitHub Pages project site
// Example: if repo is philhealth-yakap-flow → base: '/philhealth-yakap-flow/'
// Use base: '/' only if deploying to a custom domain or username.github.io root
export default defineConfig({
  plugins: [react()],
  base: '/philhealth-yakap-flow/',
})
