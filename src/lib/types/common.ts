/**
 * Common Types - MIRRORS BACKEND SSOT
 * @see server/src/shared/types/common.types.ts
 */

/**
 * ISO date string type alias
 */
export type ISODateString = string;

/**
 * Phone number in E.164 format
 */
export type E164PhoneNumber = string;

/**
 * UUID type alias
 */
export type UUID = string;

/**
 * Nullable type helper
 */
export type Nullable<T> = T | null;

/**
 * Common timestamps
 */
export interface Timestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * Base entity with common fields
 */
export interface BaseEntity extends Timestamps {
  id: UUID | number;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Pagination response metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * API success response - MATCHES BACKEND EXACTLY
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * API error response - MATCHES BACKEND EXACTLY
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>[];
    stack?: string;
  };
}

/**
 * Date range filter
 */
export interface DateRange {
  startDate?: string;
  endDate?: string;
}

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort parameters
 */
export interface SortParams {
  sortBy: string;
  sortOrder: SortOrder;
}
