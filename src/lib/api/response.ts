// =============================================================================
// Silah Cloud Platform — v1 API response contract
// =============================================================================
// Unified success/error shape for every /api/v1/* endpoint.
//
//   Success: { success: true, data: T }
//   Error:   { success: false, error: { code, message, details? } }
//
// List responses include pagination metadata:
//   { success: true, data: T[], pagination: { page, pageSize, total, totalPages } }

import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Error codes — stable contract for native clients
// ---------------------------------------------------------------------------
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  DEVICE_REVOKED: "DEVICE_REVOKED",
  IDEMPOTENCY_REPLAY: "IDEMPOTENCY_REPLAY",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Success helpers
// ---------------------------------------------------------------------------
export function apiSuccess<T>(data: T, status = 200, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, ...extra }, { status });
}

export function apiCreated<T>(data: T, extra?: Record<string, unknown>) {
  return apiSuccess(data, 201, extra);
}

export function apiNoContent() {
  return new NextResponse(null, { status: 204 });
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function apiList<T>(
  data: T[],
  pagination: PaginationMeta,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ success: true, data, pagination, ...extra }, { status: 200 });
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------
export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown
) {
  const body: { success: false; error: ApiError } = {
    success: false,
    error: { code, message },
  };
  if (details !== undefined) body.error.details = details;
  return NextResponse.json(body, { status });
}

// Convenience wrappers for the most common cases
export const apiBadRequest = (message: string, details?: unknown) =>
  apiError(ErrorCode.BAD_REQUEST, message, 400, details);

export const apiValidationError = (message: string, details?: unknown) =>
  apiError(ErrorCode.VALIDATION_ERROR, message, 422, details);

export const apiUnauthorized = (message = "Unauthorized — authentication required") =>
  apiError(ErrorCode.UNAUTHORIZED, message, 401);

export const apiForbidden = (message = "Forbidden — you do not own this resource") =>
  apiError(ErrorCode.FORBIDDEN, message, 403);

export const apiNotFound = (message = "Resource not found") =>
  apiError(ErrorCode.NOT_FOUND, message, 404);

export const apiConflict = (message: string, details?: unknown) =>
  apiError(ErrorCode.CONFLICT, message, 409, details);

export const apiRateLimited = (message = "Too many requests") =>
  apiError(ErrorCode.RATE_LIMITED, message, 429);

export const apiMethodNotAllowed = () =>
  apiError(ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed", 405);

export const apiInternalError = (message = "Internal server error") =>
  apiError(ErrorCode.INTERNAL_ERROR, message, 500);
