/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vercel / custom domain → base '/'
// GitHub Pages project site → base '/philhealth-yakap-flow/'
export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : '/philhealth-yakap-flow/',
})
