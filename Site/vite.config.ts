import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Only the files that need a DOM pay for one; everything else stays on the
    // node environment, which is markedly faster.
    environmentMatchGlobs: [['tests/dom/**/*.test.ts', 'jsdom']],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/*.ts'],
      // main.ts is the bootstrap — it wires modules together and is covered by
      // the Playwright suite end to end; clock rendering is likewise visual and
      // screenshot-tested. Neither has unit-testable logic of its own.
      exclude: ['src/main.ts', 'src/clock/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
