/** Vite build for the client: React + Tailwind; GitHub Pages serves it under /MyAIPersona/. */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/MyAIPersona/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
}));
