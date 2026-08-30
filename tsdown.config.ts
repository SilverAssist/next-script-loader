import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  // This package declares no `type`, so `false` yields .js for CJS and .mjs
  // for ESM — the names the published `exports` map points at.
  fixedExtension: false,
  dts: { sourcemap: false },
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
});
