import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } },
    plugins: { '@typescript-eslint': typescript },
    rules: { ...js.configs.recommended.rules, ...typescript.configs.recommended.rules, 'no-undef': 'off' },
  },
  { files: ['frontend/src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
];
