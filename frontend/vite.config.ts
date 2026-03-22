import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  base: '/',

  server: {
    host: "::",
    port: 8080,
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer",
    },
  },

  define: {
    global: "globalThis",
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },

  build: {
    // SECURITY: 'hidden' generates maps for Sentry but doesn't reference them in JS
    // This prevents browsers from auto-discovering source maps
    // Sentry can still use them via debug IDs injected by sentry-cli
    sourcemap: 'hidden',

    rollupOptions: {
      output: {
        // Include source content in maps for Sentry (they're not public anyway)
        sourcemapExcludeSources: false,
      },
    },
  },
}));
