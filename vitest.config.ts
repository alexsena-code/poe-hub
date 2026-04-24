import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    setupFiles: ["./tests/vitest.setup.ts"],
    // e2e lives under e2e/*.spec.ts and is driven by Playwright — not Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
    env: {
      DATABASE_URL: "postgresql://poth:poth@localhost:5432/potc_test",
      ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      NEXTAUTH_SECRET: "test-secret-do-not-use-in-production",
      NEXTAUTH_URL: "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
