import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';

// ESLint is the project's static-analysis gate for the React/JSX frontend.
export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }],
      // React 19 / new JSX transform: no in-scope React import needed.
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-vars': 'error',
    },
  },
  {
    // Test files run under Vitest (jsdom) with Node globals available.
    files: ['**/*.test.{js,jsx}', '**/__tests__/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  { ignores: ['node_modules/**', 'dist/**'] },
];
