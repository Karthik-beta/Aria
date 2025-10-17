import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// Multi-zone doesn't need basePath - routes are native to zones
const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  // Enable standalone output for Docker
  output: 'standalone',
  // Optimize images for Docker deployment
  images: {
    unoptimized: true,
  },
  // Add trailing slash for consistent routing
  trailingSlash: true,
  // Skip ESLint during production build in Docker
  eslint: {
    ignoreDuringBuilds: process.env.DOCKER_ENV === 'true',
  },
};

export default nextConfig;
