import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// En desarrollo el frontend llama a /api/... igual que en producción, donde es
// Nginx quien enruta. Aquí lo redirigimos al backend local para que la ruta sea
// la misma en los dos sitios y no haya que cambiar nada al desplegar.
const proxyApi = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (ruta) => ruta.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: proxyApi,
  },
  preview: {
    port: 4173,
    proxy: proxyApi,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
