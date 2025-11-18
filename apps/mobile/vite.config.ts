import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const mobileRoot = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // Prevent shared packages from bundling the real next-auth client
      "next-auth/react": resolve(mobileRoot, "src/shims/next-auth-react.ts"),
    },
  },

  // Proxy configuration for browser dev mode
  server: {
    // Run on port 5173 (Vite default) to match Electric CORS configuration
    // Electric Cloud allows: localhost:3000, localhost:5173
    port: 5173,
    proxy: {
      // Proxy Next.js API requests (for write buffer flush)
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
