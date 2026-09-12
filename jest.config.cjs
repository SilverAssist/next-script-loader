/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 75,
      statements: 75,
    },
  },
  // @swc/jest instead of ts-jest: ts-jest peer-requires TypeScript <7 and has
  // no TypeScript 7 release; swc transpiles without type-checking --
  // `npm run typecheck` (tsc --noEmit) is what type-checks.
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
        },
      },
    ],
  },
};
