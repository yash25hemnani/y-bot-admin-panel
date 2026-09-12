// src/utils/pagination.ts

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Utility function to extract pagination parameters from query
export function getPaginationParams(
  query: Record<string, any>,
): PaginationParams {
  // Ensure page and limit are positive integers, with sensible defaults
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10)); // cap at 100
  // Calculate offset (no. of records to skip)
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Utility function to build paginated response
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  return {
    success: true,
    data,
    pagination: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}