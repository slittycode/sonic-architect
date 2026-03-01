import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['archive/**', 'node_modules/**'],
    // Use empty string so provider defaults to 'local' and no real API calls are made.
    // Uses env (not define) so vi.stubEnv() can override in individual tests.
    env: {
      VITE_GEMINI_API_KEY: '',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  define: {},
});
