import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    setupFiles: ["./tests/vitest.setup.ts"],
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
