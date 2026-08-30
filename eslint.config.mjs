import base from "@silverassist/npm-package-standards/eslint/base";
import { ESLINT_IGNORE_PATTERNS } from "@silverassist/next-testing-toolkit";
import tseslint from "typescript-eslint";

export default tseslint.config(...base, {
  ignores: [
    ...ESLINT_IGNORE_PATTERNS,
    "node_modules/",
    "dist/",
    "*.config.mjs",
    "*.config.js",
    "*.config.ts",
    "*.config.cjs",
  ],
});
