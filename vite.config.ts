import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The dev server origin is fixed so the Agama server can be started with exactly this value in
// `--enable-cors` / `inst.cors=` (or just use `*`).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
