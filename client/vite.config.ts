import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  base: '.',
  server: { port: 5173 },
  resolve: {
    alias: {
      '@pb/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
