import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      name: "ChatFastWidget",
      formats: ["es", "umd"],
      fileName: (format) =>
        format === "umd" ? "chatfast-widget.umd.cjs" : "chatfast-widget.js",
    },
    rollupOptions: {
      output: {
        exports: "named",
      },
    },
  },
});
