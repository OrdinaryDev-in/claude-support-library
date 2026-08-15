import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e/**"],
  },
  resolve: {
    // Mirrors tsconfig.json's "@/*": ["./*"] path alias.
    alias: { "@": import.meta.dirname },
  },
});
