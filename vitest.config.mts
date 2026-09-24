import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The planning engine is pure TypeScript with no DOM, so tests run in Node.
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd()) },
  },
});
