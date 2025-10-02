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
  // Configure basePath and assetPrefix for path-based routing
  // Both are required for Image component to work correctly with unoptimized images
  basePath: basePath,
  assetPrefix: basePath,
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
  // Expose basePath to client-side code
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
