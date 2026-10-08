import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Chemins relatifs : le build peut être servi depuis n'importe quel sous-dossier.
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // En développement, l'API tourne dans `wrangler dev` (apps/api).
    proxy: { '/api': 'http://localhost:8787' },
  },
})
