import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const DIA = 60 * 60 * 24

// https://vite.dev/config/
export default defineConfig({
  define: {
    __FECHA_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // La app avisa cuando hay una versión nueva y el usuario decide cuándo
      // actualizar, para no recargar en mitad de un formulario.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Campo OP · Socios y fincas',
        short_name: 'Campo OP',
        description: 'Gestión de socios y fincas para los técnicos de campo de la OP.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f4',
        theme_color: '#15803d',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La «carcasa» de la app se guarda en el móvil para abrirla sin cobertura.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Ortofoto PNOA del IGN: se guardan las teselas ya vistas.
            urlPattern: ({ url }) => url.hostname === 'www.ign.es' && url.pathname.startsWith('/wmts/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapa-pnoa',
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * DIA },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Capa SIGPAC (recintos) del FEGA.
            urlPattern: ({ url }) => url.hostname === 'sigpac-hubcloud.es' && url.pathname.startsWith('/wms'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapa-sigpac',
              expiration: { maxEntries: 3000, maxAgeSeconds: 30 * DIA },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
