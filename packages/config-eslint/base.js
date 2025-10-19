/**
 * Base ESLint Configuration
 * Balanced for type safety and beginner-friendliness
 */
module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    // ============================================
    // TypeScript Rules - Balanced approach
    // ============================================

    // Type Safety (Essential)
    '@typescript-eslint/no-explicit-any': 'warn', // Discourage 'any', but allow in dev
    '@typescript-eslint/no-unsafe-assignment': 'off', // Allow during rapid development
    '@typescript-eslint/no-unsafe-member-access': 'off', // Allow during rapid development
    '@typescript-eslint/no-unsafe-call': 'off', // Allow during rapid development
    '@typescript-eslint/no-unsafe-return': 'off', // Allow during rapid development

    // Unused Variables (Flexible)
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_', // Allow unused vars prefixed with _
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

    // Function & Method Rules (Beginner-friendly)
    '@typescript-eslint/explicit-function-return-type': 'off', // Return types optional
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Module boundary types optional
    '@typescript-eslint/no-empty-function': 'warn', // Warn about empty functions

    // Naming Conventions (Flexible)
    '@typescript-eslint/naming-convention': 'off', // No strict naming rules

    // Import/Require Rules
    '@typescript-eslint/no-require-imports': 'off', // Allow require() when needed
    '@typescript-eslint/no-var-requires': 'warn', // Prefer import over require

    // ============================================
    // General JavaScript Rules
    // ============================================

    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }], // Allow useful console methods
    'no-debugger': 'warn', // Warn but don't fail on debugger
    'no-alert': 'warn', // Warn about alerts
    'prefer-const': 'warn', // Encourage const usage
    'no-var': 'error', // Don't use var
    eqeqeq: ['warn', 'smart'], // Encourage === but be smart
    curly: ['warn', 'multi-line'], // Curly braces for multi-line

    // ============================================
    // Code Quality (Non-blocking)
    // ============================================

    'no-unused-expressions': 'off', // Allow for certain patterns
    '@typescript-eslint/no-unused-expressions': [
      'warn',
      {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      },
    ],

    // ============================================
    // Prettier Integration
    // ============================================
    'prettier/prettier': 'warn', // Format issues as warnings
  },
};
