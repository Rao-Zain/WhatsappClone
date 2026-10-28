import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    // Installable app + service worker (src/sw.js handles caching and push).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt', // we ask before reloading into a new version
      injectRegister: false, // registered in src/pwa/registerServiceWorker.js
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        rollupFormat: 'iife', // classic worker: works in every browser
      },
      manifest: {
        id: '/',
        name: 'WhatsApp Clone',
        short_name: 'WhatsApp Clone',
        description: 'Real-time chat, calls and status updates.',
        lang: 'en',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#1daa61',
        categories: ['social', 'communication'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Lets you try the service worker and push with `npm run dev` (localhost counts as secure).
      devOptions: {
        enabled: true,
        type: 'classic',
        navigateFallback: 'index.html',
      },
    }),
  ],
})