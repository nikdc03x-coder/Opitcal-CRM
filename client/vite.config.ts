import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite runs our React frontend on port 5173.
// API requests beginning with /api go to Express on port 5000.
// nik
export default defineConfig({
  plugins: [react()],

  build: {
    chunkSizeWarningLimit: 1000,
  },

  server: {
    port: 5173,

    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
