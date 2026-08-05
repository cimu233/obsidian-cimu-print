import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    clearMocks: true
  },
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL('./test/obsidianMock.ts', import.meta.url))
    }
  }
});
