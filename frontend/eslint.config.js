import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'e2e/artifacts']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Tests, their helpers and the end-to-end suite run under Jest in Node, not in the app bundle.
    files: ['**/*.test.{js,jsx}', 'src/test/**', 'e2e/**'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.jest, ...globals.node },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['*.config.js', 'e2e/support/*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
