/**
 * Next.js ESLint Configuration
 * Balanced React/Next.js rules for beginner developers
 */
module.exports = {
  extends: ['next/core-web-vitals', './base'],
  plugins: ['react-hooks'],
  rules: {
    // ============================================
    // Next.js Specific Rules
    // ============================================
    '@next/next/no-img-element': 'off', // Allow <img> for flexibility
    '@next/next/no-html-link-for-pages': 'warn', // Warn about non-Next links

    // ============================================
    // React Rules - Beginner-friendly
    // ============================================

    // React Hooks (Important but flexible)
    'react-hooks/rules-of-hooks': 'error', // Must follow hooks rules
    'react-hooks/exhaustive-deps': 'warn', // Warn about missing deps

    // React Compiler Rules (Relaxed for now)
    'react-hooks/set-state-in-effect': 'off', // Allow setState in useEffect for now
    'react-hooks/purity': 'off', // Allow impure functions for now
    'react-hooks/incompatible-library': 'off', // Allow known incompatible libraries

    // React Best Practices
    'react/no-unescaped-entities': 'warn', // Warn about unescaped quotes
    'react/jsx-key': 'warn', // Warn about missing keys in lists
    'react/jsx-no-target-blank': 'warn', // Security: warn about target="_blank"
    'react/no-children-prop': 'warn', // Prefer children as JSX

    // ============================================
    // JSX/TSX Specific
    // ============================================
    'react/react-in-jsx-scope': 'off', // Not needed in Next.js
    'react/prop-types': 'off', // Use TypeScript instead
    'react/display-name': 'off', // Display name not required

    // ============================================
    // TypeScript + React
    // ============================================
    '@typescript-eslint/no-explicit-any': 'warn', // Discourage any in React components
  },
};
