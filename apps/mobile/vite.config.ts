import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

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
