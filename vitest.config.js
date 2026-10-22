import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["test/setup.js"],
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/types.js"],
      thresholds: {
        lines: 98,
        functions: 100,
        statements: 98,
        branches: 85,
      },
    },
  },
});
