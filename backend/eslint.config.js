import js from '@eslint/js';
import globals from 'globals';

// ESLint is the project's static-analysis gate for this plain-ESM-JS backend
// (we deliberately do not run tsc/checkJs — see CLAUDE.md "Gates").
export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['node_modules/**'] },
];
