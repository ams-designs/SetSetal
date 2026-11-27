import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import en from "./src/i18n/en.json" with { type: "json" };

export default defineConfig({
  // Relative base so the same build works at a domain root or in a subfolder
  // (for example GitHub Pages). Routing is hash-based, so no server rewrites.
  base: "./",
  build: { target: "es2020" },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        id: "./",
        name: "SetSetal — Cleaner Communities",
        short_name: "SetSetal",
        description: en["app.description"],
        lang: "en",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#FAF8F1",
        theme_color: "#147D59",
        categories: ["utilities", "lifestyle"],
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        navigateFallback: "index.html"
      }
    })
  ]
});
