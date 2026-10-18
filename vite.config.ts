import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/mktmxxng/',
  // Firebase SDK is most of the bundle; it is precached by the service worker after first load.
  build: { chunkSizeWarningLimit: 1200 },
  // Shown on the account page so it's easy to tell whether a phone has picked up the latest deploy.
  define: { __BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MKTMXXNG',
        short_name: 'MKTMXXNG',
        description: 'Roll a random Makati cafe, log what you ordered.',
        theme_color: '#2A2933',
        background_color: '#C9CDCB',
        display: 'standalone',
        start_url: '/mktmxxng/',
        scope: '/mktmxxng/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
