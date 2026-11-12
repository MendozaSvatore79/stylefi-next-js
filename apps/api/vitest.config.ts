import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC compila los decoradores de Nest con sus metadatos (esbuild, el de Vitest, no los emite).
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
