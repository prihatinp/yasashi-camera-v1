import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Repo GitHub Pages project site: https://<user>.github.io/yasashi-camera-v1/
  // Harus path absolut (bukan "./") supaya BrowserRouter basename valid.
  base: "/yasashi-camera-v1/",
});
