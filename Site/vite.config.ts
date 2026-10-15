import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

/**
 * Mirrors deploy/nginx.conf's `location = /api/time` so `npm run dev`, `npm run preview`
 * and the E2E suite exercise a real sync. Dev tooling only — never part of the build.
 */
const apiTime = (): Plugin => {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.url?.split('?')[0] !== '/api/time') { next(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ epochSec: Date.now() / 1000 }));
  };
  return {
    name: 'api-time',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
};

export default defineConfig({
  plugins: [apiTime()],
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
