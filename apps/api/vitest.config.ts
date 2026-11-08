import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@hatlock/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@hatlock/database': path.resolve(__dirname, '../../packages/database/src/index.ts'),
      '@hatlock/hatpesa': path.resolve(__dirname, '../../packages/hatpesa/src/index.ts'),
      '@hatlock/sonicpesa': path.resolve(__dirname, '../../packages/sonicpesa/src/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
