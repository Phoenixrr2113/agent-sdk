import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';

/** @type {import('eslint').Linter.Config[]} */
export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  jsdoc.configs['flat/recommended-typescript'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Enforce JSDoc/TSDoc-only comments
      'no-warning-comments': 'off',
      'jsdoc/no-bad-blocks': 'warn',
      'multiline-comment-style': ['warn', 'starred-block'],
      'no-inline-comments': 'warn',
      'line-comment-position': ['warn', { position: 'above' }],
      'spaced-comment': ['warn', 'always', { markers: ['/'] }],
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.js', '**/*.d.ts'],
  },
];
