/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

type PwaApi = { extendManifestEntries: (fn: (entries: NonNullable<NonNullable<VitePWAOptions['workbox']>['additionalManifestEntries']>) => typeof entries) => void }

/**
 * The web manifest always comes from the network, never from the service worker's cache:
 * Android reads its colors and icons when installing, and a cached copy would keep the
 * old ones until the person taps "Actualizar".
 */
function manifestFromNetwork(): Plugin {
  return {
    name: 'manifest-from-network',
    buildStart() {
      const pwa = this.environment.config.plugins.find((p) => p.name === 'vite-plugin-pwa')
      const api = pwa?.api as PwaApi | undefined
      api?.extendManifestEntries((entries) => entries.filter((e) => (typeof e === 'string' ? e : e.url) !== 'manifest.webmanifest'))
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true, routesDirectory: './src/routes', generatedRouteTree: './src/app/routeTree.gen.ts' }),
    react(),
    VitePWA({
      // Registered from src/app/pwa.ts, which shows "Hay una versión nueva".
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Visitario',
        short_name: 'Visitario',
        description: 'Jornadas, visitas y activaciones de góndola.',
        lang: 'es-AR',
        // Android: theme_color paints the status bar until the page sets its own (the
        // ground of the active theme, see profile/theme.ts); background_color paints the
        // splash and the navigation bar, so it is the dark card, like the bottom navigation.
        theme_color: '#0F1A16',
        background_color: '#172520',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Fonts come from Google: keep them so the app looks the same without signal.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          // Street map (OpenFreeMap): the areas already seen keep showing without signal.
          {
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'map', expiration: { maxEntries: 1500, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
    manifestFromNetwork(),
  ],
  build: {
    // The street map library (maplibre-gl, ~1 MB) is its own chunk, loaded only on the route.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          tanstack: ['@tanstack/react-router', '@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
  css: {
    modules: {
      // `.nav-link` in SCSS is `styles.navLink` in TSX.
      localsConvention: 'camelCaseOnly',
      // Readable class names in development (Button-module__primary__a1b2) to find the file from DevTools.
      generateScopedName: mode === 'production' ? '[hash:base64:6]' : '[name]__[local]__[hash:base64:4]',
    },
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
