import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import reactHooks from 'eslint-plugin-react-hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  ...compat.extends('@aria/eslint-config/next'),
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // ============================================
      // React Hooks - Essential rules only
      // ============================================
      'react-hooks/rules-of-hooks': 'error', // Must follow hooks rules
      'react-hooks/exhaustive-deps': 'warn', // Warn about deps, don't fail

      // ============================================
      // React Compiler Rules - Disabled for now
      // These will be addressed in a separate PR
      // ============================================
      'react-hooks/set-state-in-effect': 'off', // Allow common patterns
      'react-hooks/purity': 'off', // Allow impure functions
      'react-hooks/incompatible-library': 'off', // Allow third-party libs

      // ============================================
      // TypeScript - Balanced for beginners
      // ============================================
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn', // Discourage but allow
      '@typescript-eslint/no-unused-expressions': 'off', // Allow for certain patterns
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'next-env.d.ts',
      '*.config.js',
      '*.config.ts',
    ],
  },
];

export default eslintConfig;
