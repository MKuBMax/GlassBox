import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
    },
    fileParallelism: false,
    globalSetup: ["./vitest.global-setup.ts"],
    maxWorkers: 1,
  },
});
