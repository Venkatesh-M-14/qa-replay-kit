import { defineConfig } from 'vitest/config';
import * as path from 'path';

// separate from vite.config.ts, whose web-extension plugin is only for building
export default defineConfig({
  resolve: {
    alias: { '~': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
