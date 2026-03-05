import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // isto ajuda a PWA a tomar conta do cliente mais depressa
      workbox: {
        clientsClaim: true,
        skipWaiting: true,

        // SPA fallback (React)
        navigateFallback: '/index.html',

        runtimeCaching: [
          // 1) Assets (JS/CSS/img/fonts): CacheFirst
          {
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style' ||
              request.destination === 'image' ||
              request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'm6-assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
              },
            },
          },

          // 2) Supabase REST GET: NetworkFirst (offline-friendly)
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.hostname.endsWith('supabase.co') &&
              url.pathname.includes('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'm6-supabase-get',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
              },
            },
          },
        ],
      },

      manifest: {
        name: 'Equipa M6 Trablisa',
        short_name: 'M6 Trablisa',
        description: 'Aplicação da Equipa M6 Trablisa (Liga de Clubes M6)',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],

  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});