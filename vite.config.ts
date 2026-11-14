import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
  },
  plugins: [react()],
  resolve: {
    alias: {
      services: path.resolve(__dirname, "src/services"),
      components: path.resolve(__dirname, "src/components"),
    },
  },
  css: {
    preprocessorOptions: {
      scss: { api: "modern-compiler" },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
