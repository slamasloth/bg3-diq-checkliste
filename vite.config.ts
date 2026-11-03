import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,json,svg,png}'], maximumFileSizeToCacheInBytes: 3_000_000 },
      manifest: {
        name: 'BG3 DIQ Checklist',
        short_name: 'BG3 Checklist',
        lang: 'en',
        display: 'standalone',
        background_color: '#17161a',
        theme_color: '#7a3b1d',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
