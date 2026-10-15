/** Standard API contracts, used by both the backend and the frontend. */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Every list endpoint returns this shape: `{ data, meta }`. */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Every error response returns this shape. */
export interface ApiErrorResponse {
  statusCode: number;
  /** HTTP reason, e.g. "Conflict" */
  error: string;
  /** Human-readable message (French), or the list of validation errors */
  message: string | string[];
  /** Stable machine code the frontend can switch on, e.g. "DEVIS_SANS_LIGNES" */
  code?: string;
  path: string;
  timestamp: string;
  /** Same value as the X-Request-Id response header — quote it when reporting a bug */
  requestId?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
}
