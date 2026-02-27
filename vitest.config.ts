import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  define: {
    // Use empty string in tests so provider defaults to 'local' and no real API calls are made.
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
  },
});
