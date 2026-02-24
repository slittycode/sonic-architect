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
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(
      process.env.VITE_GEMINI_API_KEY ?? 'test-key'
    ),
  },
});
