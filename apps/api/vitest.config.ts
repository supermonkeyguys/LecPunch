import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@lecpunch/shared': resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
