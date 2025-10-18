module.exports = {
  extends: ['next/core-web-vitals', './base'],
  plugins: ['react-hooks'],
  rules: {
    // Allow plain <img> tags for assets with relative paths (basePath compatibility)
    '@next/next/no-img-element': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
