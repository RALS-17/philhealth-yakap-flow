/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vercel, Capacitor/Android, local → base '/'
// GitHub Pages project site → set GITHUB_PAGES=1
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === '1' ? '/philhealth-yakap-flow/' : '/',
})
