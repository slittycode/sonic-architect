import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const testGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  vi: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  require: 'readonly',
  module: 'readonly',
  __dirname: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'skills/**',
      'archive/**',
      'plans/**',
      '.worktrees/**',
      '.playwright-mcp/**',
      '.playwright-cli/**',
      '.jules/**',
      'reports/**',
      '**/*.png',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '__tests__/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: testGlobals,
    },
  },
  {
    files: [
      'bin/**/*.js',
      'scripts/**/*.{js,mjs,cjs}',
      '*.config.{js,ts,mjs,cjs}',
      'vite.config.ts',
      'vitest.config.ts',
    ],
    languageOptions: {
      globals: nodeGlobals,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
