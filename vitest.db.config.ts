import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(fileURLToPath(new URL('.', import.meta.url)), '.'),
    },
  },
  test: {
    name: 'db',
    environment: 'node',
    globals: true,
    include: ['src/tests-db/**/*.test.ts'],
    exclude: ['src/tests/**', 'node_modules/**', 'dist/**'],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
