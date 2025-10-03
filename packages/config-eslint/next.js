module.exports = {
  extends: ['next/core-web-vitals', './base'],
  rules: {
    // Allow plain <img> tags for assets with relative paths (basePath compatibility)
    '@next/next/no-img-element': 'off',
  },
};
