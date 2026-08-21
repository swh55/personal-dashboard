// =============================================================================
// v1 API — pagination + query parsing helpers
// =============================================================================

import { NextRequest } from "next/server";

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Parse `page` and `pageSize` from the query string with safe bounds.
 * Page is 1-based. Returns Prisma-ready `skip` / `take`.
 */
export function parsePagination(req: NextRequest): PaginationParams {
  const sp = req.nextUrl.searchParams;
  let page = parseInt(sp.get("page") ?? "1", 10);
  let pageSize = parseInt(sp.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number
) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 0,
  };
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/**
 * Extract whitelisted filter values from the query string.
 * Only keys present in `allowed` are returned — everything else is dropped
 * to prevent injection of unexpected Prisma where-clause keys.
 */
export function parseFilters(
  req: NextRequest,
  allowed: string[]
): Record<string, string | undefined> {
  const sp = req.nextUrl.searchParams;
  const out: Record<string, string | undefined> = {};
  for (const key of allowed) {
    const v = sp.get(key);
    if (v !== null && v !== "") out[key] = v;
  }
  return out;
}

/**
 * Parse a date-range filter (`dateFrom` / `dateTo`) into a Prisma
 * `{ gte, lte }` object for a given date field. Returns `undefined` if
 * neither bound was supplied.
 */
export function parseDateRange(
  req: NextRequest,
  fromKey = "dateFrom",
  toKey = "dateTo"
): { gte?: Date; lte?: Date } | undefined {
  const sp = req.nextUrl.searchParams;
  const from = sp.get(fromKey);
  const to = sp.get(toKey);
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) range.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) range.lte = d;
  }
  if (range.gte || range.lte) return range;
  return undefined;
}

/**
 * Parse the `search` query param for full-text-like filtering.
 */
export function parseSearch(req: NextRequest): string | undefined {
  const s = req.nextUrl.searchParams.get("search");
  if (!s) return undefined;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

/**
 * Parse a `sort` query param like `"-createdAt"` (desc) or `"title"` (asc).
 * Only fields in the whitelist are allowed — anything else is ignored and
 * the `defaultSort` is used instead.
 */
export function parseSort(
  req: NextRequest,
  allowed: string[],
  defaultSort: { field: string; dir: "asc" | "desc" } = {
    field: "createdAt",
    dir: "desc",
  }
): { field: string; dir: "asc" | "desc" } {
  const raw = req.nextUrl.searchParams.get("sort");
  if (!raw) return defaultSort;
  let dir: "asc" | "desc" = "asc";
  let field = raw;
  if (field.startsWith("-")) {
    dir = "desc";
    field = field.slice(1);
  } else if (field.startsWith("+")) {
    dir = "asc";
    field = field.slice(1);
  }
  if (!allowed.includes(field)) return defaultSort;
  return { field, dir };
}

/**
 * Parse the `includeDeleted` flag. When false (default), soft-deleted records
 * (deletedAt != null) are excluded from list responses.
 */
export function parseIncludeDeleted(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get("includeDeleted") === "true";
}
