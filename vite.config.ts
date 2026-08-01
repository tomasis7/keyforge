import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site from /<repo>/, so the built asset URLs
// need that prefix. It comes from the environment rather than being hardcoded
// so `npm run dev` still serves from / and the build stays portable to a host
// that serves from the root.
const base = process.env.VITE_BASE ?? '/';

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
});
