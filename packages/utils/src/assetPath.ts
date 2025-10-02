/**
 * Get the base path for the application
 * This is used to prepend the correct path to assets when using Next.js with basePath
 */
export function getBasePath(): string {
  // In Next.js, we can access the basePath from the router or config
  // For Docker deployment with basePath, this will be '/hrms', '/crm', etc.
  // For local development, this will be ''
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

/**
 * Get the full asset path with basePath prepended
 * Use this for images and other static assets from the /public folder
 * 
 * @param path - The path to the asset (e.g., '/next.svg')
 * @returns The full path with basePath (e.g., '/hrms/next.svg')
 * 
 * @example
 * ```tsx
 * <Image src={getAssetPath('/next.svg')} alt="Logo" width={100} height={100} />
 * ```
 */
export function getAssetPath(path: string): string {
  const basePath = getBasePath();
  
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Return basePath + path (basePath already has leading slash)
  return basePath ? `${basePath}/${cleanPath}` : `/${cleanPath}`;
}
