import type { Pagination } from '@aria/types';

export const paginate = (items: unknown[], { page, pageSize }: Pagination) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

// Asset path utilities for Next.js with basePath
export { getBasePath, getAssetPath } from './assetPath';
