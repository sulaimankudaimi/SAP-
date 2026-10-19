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
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    testTimeout: 25000,
    include: ['src/tests/**/*.test.ts', 'src/modules/**/*.test.ts'],
    exclude: ['src/tests-db/**', 'node_modules/**', 'dist/**'],
  },
});
