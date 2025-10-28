import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Proxy configuration for browser dev mode
  // Only proxy Next.js API - Electric runs locally via Docker
  server: {
    proxy: {
      // Proxy Next.js API requests (for write buffer flush)
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
