import { base as aliBase } from 'eslint-config-ali';
import prettier from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
// import tslintPlugin from 'typescript-eslint';
export default defineConfig([
  // ...tslintPlugin.configs.recommended,
  ...aliBase,
  prettier,
  {
    ignores: ['dist/**/*', 'node_modules/**/*'],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@/semi': [1, 'never'],
      'prettier/prettier': [
        'error',
        {
          printWidth: 80,
          singleQuote: true,
          trailingComma: 'all',
          proseWrap: 'never',
          tabWidth: 2,
          semi: false,
          arrowParens: 'always',
        },
      ],
    },
  },
  globalIgnores(['**/dist/**', '**/node_modules/**']),
]);
