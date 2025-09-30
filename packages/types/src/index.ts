export interface Pagination {
  page: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
}
