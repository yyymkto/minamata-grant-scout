// dev:split 用 — Vite (フロント) + wrangler dev (API) を分離して起動
// @cloudflare/vite-plugin で認証フローがフリッカーする場合にこちらを使う
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "app"),
      "@server": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
