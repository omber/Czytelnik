import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        runtimeCaching: [
          {
            // Cache book JSON files
            urlPattern: /\/books\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'book-json',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Cache TTS audio files
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
