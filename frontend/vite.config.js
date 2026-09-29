import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
  plugins: [
    react(),
    VitePWA({
      // `autoUpdate` instala la versión nueva en cuanto está lista y recarga.
      // La alternativa (preguntar al usuario) añade una pantalla que en mitad
      // de una ronda es justo lo que no se quiere ver.
      registerType: 'autoUpdate',

      // El registro se emite como fichero aparte, no como script en línea:
      // así sigue funcionando cuando se active la CSP de Nginx, que sólo
      // permite scripts propios.
      injectRegister: 'script-defer',

      // Los iconos y el resto de estáticos que no entran en el bundle.
      includeAssets: ['favicon.svg', 'iconos/apple-touch-icon.png'],

      manifest: {
        name: 'Caddex Golf',
        short_name: 'Caddex',
        description:
          'Registra tus rondas y torneos hoyo a hoyo, calcula tu hándicap y descubre dónde pierdes golpes.',
        lang: 'es',
        start_url: '/panel',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // El fondo de la pantalla de arranque en carbón, como la landing.
        background_color: '#0E1014',
        theme_color: '#0E1014',
        icons: [
          { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            // Android recorta el icono con la forma del lanzador; este lleva el
            // símbolo reducido para que el recorte no se coma la bandera.
            src: '/iconos/icono-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Anotar una ronda',
            short_name: 'Nueva ronda',
            url: '/rondas/nueva',
            icons: [{ src: '/iconos/icono-192.png', sizes: '192x192' }],
          },
        ],
      },

      workbox: {
        // Todo el shell de la aplicación se precachea: sin esto, abrirla sin
        // cobertura muestra el error del navegador en vez de la pantalla.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],

        // Cualquier ruta que no sea un fichero se sirve con index.html, que es
        // lo que hace funcionar el enrutado de React estando sin red.
        navigateFallback: '/index.html',
        // ...salvo la API: una petición a /api que falle debe fallar de verdad,
        // para que el código la trate como "sin conexión" y encole la ronda.
        // Si le devolviéramos el index.html, el cliente vería un JSON inválido.
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // Las fuentes de Google cambian poquísimo y su ausencia rompe la
            // tipografía de toda la aplicación.
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fuentes-google',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Nada de la API se cachea a propósito. Una tarjeta o un hándicap
        // servidos desde caché son datos viejos presentados como actuales, y
        // en una aplicación de estadísticas eso es peor que un error honesto.
        navigateFallbackAllowlist: [/^(?!\/api\/).*/],
      },

      devOptions: {
        // Sin esto no hay forma de probar el comportamiento offline en local.
        enabled: false,
        type: 'module',
      },
    }),
  ],
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
