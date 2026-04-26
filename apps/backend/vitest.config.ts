import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@/db": resolve(__dirname, "src/db"),
      "@/db/schema": resolve(__dirname, "src/db/schema"),
      "@/lib": resolve(__dirname, "src/lib"),
      "@/utils": resolve(__dirname, "src/utils"),
    },
  },
});
