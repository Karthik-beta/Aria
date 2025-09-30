import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
