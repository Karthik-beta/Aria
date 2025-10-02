import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// Determine if we're in production Docker environment
const isDocker = process.env.DOCKER_ENV === 'true';
const basePath = isDocker ? '/hrms' : '';

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  // Enable standalone output for Docker
  output: 'standalone',
  // Configure asset prefix for path-based routing
  assetPrefix: basePath || undefined,
  basePath: basePath || undefined,
  // Optimize images for Docker deployment
  images: {
    unoptimized: true, // Required for standalone output
  },
  // Add trailing slash for consistent routing
  trailingSlash: true,
  // Skip ESLint during production build in Docker
  eslint: {
    ignoreDuringBuilds: isDocker,
  },
};

export default nextConfig;
