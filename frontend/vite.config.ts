import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Czytelnik',
        short_name: 'Czytelnik',
        description: 'Читайте польские книги с русскими переводами',
        start_url: '/Czytelnik/',
        scope: '/Czytelnik/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        orientation: 'portrait',
        lang: 'ru',
        icons: [
          {
            src: '/Czytelnik/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        runtimeCaching: [
          {
            // Chapter content (large, stable once published) — serve from cache instantly
            urlPattern: /\/books\/.*\/ch-\d+\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'chapter-json',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Library metadata (index.json, meta.json, chapters.json) — always revalidate
            urlPattern: /\/books\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'book-meta',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Cover images — stable once a book is added
            urlPattern: /\/books\/.*\.(jpg|jpeg|png|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'book-covers',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // TTS audio files
            urlPattern: /\/books\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'book-audio',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  base: '/Czytelnik/',
})
