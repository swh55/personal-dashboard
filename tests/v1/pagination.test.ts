// =============================================================================
// Tests: src/lib/api/pagination.ts — query string parsing helpers
// =============================================================================
// Verifies:
//   - parsePagination with valid params, defaults, out-of-bounds (clamped)
//   - parseFilters only returns whitelisted keys
//   - parseDateRange with valid/invalid dates
//   - parseSearch trims and returns undefined for empty
//   - parseSort with -field, +field, field, unknown field (fallback)
//   - parseIncludeDeleted true/false

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  parsePagination,
  buildPaginationMeta,
  parseFilters,
  parseDateRange,
  parseSearch,
  parseSort,
  parseIncludeDeleted,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
} from "@/lib/api/pagination";

function makeReq(url: string): NextRequest {
  return new NextRequest(url);
}

describe("parsePagination", () => {
  it("uses defaults when no query params supplied", () => {
    const p = parsePagination(makeReq("http://localhost/api/v1/tasks"));
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(p.skip).toBe(0);
    expect(p.take).toBe(DEFAULT_PAGE_SIZE);
  });

  it("parses valid page + pageSize", () => {
    const p = parsePagination(
      makeReq("http://localhost/api/v1/tasks?page=3&pageSize=20")
    );
    expect(p.page).toBe(3);
    expect(p.pageSize).toBe(20);
    expect(p.skip).toBe(40); // (3-1) * 20
    expect(p.take).toBe(20);
  });

  it("clamps page=0 to page=1", () => {
    const p = parsePagination(makeReq("http://localhost/api/v1/tasks?page=0"));
    expect(p.page).toBe(1);
    expect(p.skip).toBe(0);
  });

  it("clamps negative page to page=1", () => {
    const p = parsePagination(
      makeReq("http://localhost/api/v1/tasks?page=-5")
    );
    expect(p.page).toBe(1);
  });

  it("clamps pageSize=0 to default", () => {
    const p = parsePagination(
      makeReq("http://localhost/api/v1/tasks?pageSize=0")
    );
    expect(p.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("clamps pageSize=999 to MAX_PAGE_SIZE (100)", () => {
    const p = parsePagination(
      makeReq("http://localhost/api/v1/tasks?pageSize=999")
    );
    expect(p.pageSize).toBe(MAX_PAGE_SIZE);
    expect(p.pageSize).toBe(100);
  });

  it("clamps negative pageSize to default", () => {
    const p = parsePagination(
      makeReq("http://localhost/api/v1/tasks?pageSize=-10")
    );
    expect(p.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("handles non-numeric page gracefully", () => {
    const p = parsePagination(
      makeReq("http://localhost/api/v1/tasks?page=abc")
    );
    // parseInt("abc", 10) → NaN → clamped to 1
    expect(p.page).toBe(1);
  });

  it("handles non-numeric pageSize gracefully", () => {
    const p = parsePagination(
      makeReq("http://localhost/api/v1/tasks?pageSize=xyz")
    );
    expect(p.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("computes skip correctly for page 2, pageSize 10", () => {
    const p = parsePagination(
      makeReq("http://localhost/api/v1/tasks?page=2&pageSize=10")
    );
    expect(p.skip).toBe(10);
    expect(p.take).toBe(10);
  });
});

describe("buildPaginationMeta", () => {
  it("returns page, pageSize, total, totalPages", () => {
    const meta = buildPaginationMeta(1, 10, 25);
    expect(meta).toEqual({ page: 1, pageSize: 10, total: 25, totalPages: 3 });
  });

  it("computes totalPages correctly for exact division", () => {
    const meta = buildPaginationMeta(1, 10, 20);
    expect(meta.totalPages).toBe(2);
  });

  it("returns totalPages=0 when total=0", () => {
    const meta = buildPaginationMeta(1, 10, 0);
    expect(meta.totalPages).toBe(0);
  });

  it("rounds up totalPages for partial last page", () => {
    const meta = buildPaginationMeta(1, 50, 101);
    expect(meta.totalPages).toBe(3); // ceil(101/50) = 3
  });
});

describe("parseFilters", () => {
  it("returns only whitelisted keys", () => {
    const req = makeReq(
      "http://localhost/api/v1/tasks?status=done&priority=high&userId=evil&createdAt=2024-01-01"
    );
    const filters = parseFilters(req, ["status", "priority"]);
    expect(filters).toEqual({ status: "done", priority: "high" });
    expect(filters.userId).toBeUndefined();
    expect(filters.createdAt).toBeUndefined();
  });

  it("omits keys with empty values", () => {
    const req = makeReq("http://localhost/api/v1/tasks?status=&priority=high");
    const filters = parseFilters(req, ["status", "priority"]);
    expect(filters.status).toBeUndefined();
    expect(filters.priority).toBe("high");
  });

  it("returns empty object when no whitelisted keys present", () => {
    const req = makeReq("http://localhost/api/v1/tasks?foo=bar&baz=qux");
    const filters = parseFilters(req, ["status", "priority"]);
    expect(filters).toEqual({});
  });

  it("returns empty object when no query params at all", () => {
    const req = makeReq("http://localhost/api/v1/tasks");
    const filters = parseFilters(req, ["status"]);
    expect(filters).toEqual({});
  });

  it("handles empty whitelist", () => {
    const req = makeReq("http://localhost/api/v1/tasks?status=done");
    const filters = parseFilters(req, []);
    expect(filters).toEqual({});
  });
});

describe("parseDateRange", () => {
  it("parses valid dateFrom and dateTo", () => {
    const req = makeReq(
      "http://localhost/api/v1/tasks?dateFrom=2024-01-01&dateTo=2024-12-31"
    );
    const range = parseDateRange(req);
    expect(range).toBeDefined();
    expect(range!.gte).toEqual(new Date("2024-01-01"));
    expect(range!.lte).toEqual(new Date("2024-12-31"));
  });

  it("parses only dateFrom", () => {
    const req = makeReq("http://localhost/api/v1/tasks?dateFrom=2024-06-15");
    const range = parseDateRange(req);
    expect(range).toBeDefined();
    expect(range!.gte).toEqual(new Date("2024-06-15"));
    expect(range!.lte).toBeUndefined();
  });

  it("parses only dateTo", () => {
    const req = makeReq("http://localhost/api/v1/tasks?dateTo=2024-12-31");
    const range = parseDateRange(req);
    expect(range).toBeDefined();
    expect(range!.gte).toBeUndefined();
    expect(range!.lte).toEqual(new Date("2024-12-31"));
  });

  it("returns undefined when neither bound is supplied", () => {
    const req = makeReq("http://localhost/api/v1/tasks");
    const range = parseDateRange(req);
    expect(range).toBeUndefined();
  });

  it("ignores invalid date strings", () => {
    const req = makeReq(
      "http://localhost/api/v1/tasks?dateFrom=not-a-date&dateTo=2024-12-31"
    );
    const range = parseDateRange(req);
    expect(range).toBeDefined();
    expect(range!.gte).toBeUndefined();
    expect(range!.lte).toEqual(new Date("2024-12-31"));
  });

  it("returns undefined when both dates are invalid", () => {
    const req = makeReq(
      "http://localhost/api/v1/tasks?dateFrom=foo&dateTo=bar"
    );
    const range = parseDateRange(req);
    expect(range).toBeUndefined();
  });

  it("supports custom key names", () => {
    const req = makeReq(
      "http://localhost/api/v1/tasks?from=2024-01-01&to=2024-06-01"
    );
    const range = parseDateRange(req, "from", "to");
    expect(range).toBeDefined();
    expect(range!.gte).toEqual(new Date("2024-01-01"));
    expect(range!.lte).toEqual(new Date("2024-06-01"));
  });
});

describe("parseSearch", () => {
  it("returns the trimmed search string", () => {
    const req = makeReq("http://localhost/api/v1/tasks?search=hello");
    expect(parseSearch(req)).toBe("hello");
  });

  it("trims whitespace", () => {
    const req = makeReq("http://localhost/api/v1/tasks?search=%20%20hello%20%20");
    expect(parseSearch(req)).toBe("hello");
  });

  it("returns undefined when search param is absent", () => {
    const req = makeReq("http://localhost/api/v1/tasks");
    expect(parseSearch(req)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    const req = makeReq("http://localhost/api/v1/tasks?search=");
    expect(parseSearch(req)).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    const req = makeReq("http://localhost/api/v1/tasks?search=%20%20%20");
    expect(parseSearch(req)).toBeUndefined();
  });

  it("returns multi-word search strings intact", () => {
    const req = makeReq("http://localhost/api/v1/tasks?search=hello%20world");
    expect(parseSearch(req)).toBe("hello world");
  });
});

describe("parseSort", () => {
  it("parses -field as descending", () => {
    const req = makeReq("http://localhost/api/v1/tasks?sort=-createdAt");
    const sort = parseSort(req, ["createdAt", "updatedAt"]);
    expect(sort).toEqual({ field: "createdAt", dir: "desc" });
  });

  it("parses +field as ascending", () => {
    // %2B is the URL-encoded form of "+" — without encoding, "+" is decoded
    // as a space by URLSearchParams.
    const req = makeReq("http://localhost/api/v1/tasks?sort=%2Btitle");
    const sort = parseSort(req, ["createdAt", "title"]);
    expect(sort).toEqual({ field: "title", dir: "asc" });
  });

  it("parses bare field as ascending", () => {
    const req = makeReq("http://localhost/api/v1/tasks?sort=title");
    const sort = parseSort(req, ["createdAt", "title"]);
    expect(sort).toEqual({ field: "title", dir: "asc" });
  });

  it("falls back to default sort when field is unknown", () => {
    const req = makeReq("http://localhost/api/v1/tasks?sort=userId");
    const sort = parseSort(req, ["createdAt", "title"]);
    expect(sort).toEqual({ field: "createdAt", dir: "desc" });
  });

  it("falls back to default sort when no sort param is present", () => {
    const req = makeReq("http://localhost/api/v1/tasks");
    const sort = parseSort(req, ["createdAt", "title"]);
    expect(sort).toEqual({ field: "createdAt", dir: "desc" });
  });

  it("respects a custom default sort", () => {
    const req = makeReq("http://localhost/api/v1/tasks");
    const sort = parseSort(req, ["createdAt"], { field: "name", dir: "asc" });
    expect(sort).toEqual({ field: "name", dir: "asc" });
  });

  it("falls back to custom default when field is unknown", () => {
    const req = makeReq("http://localhost/api/v1/tasks?sort=evilField");
    const sort = parseSort(req, ["createdAt"], { field: "name", dir: "asc" });
    expect(sort).toEqual({ field: "name", dir: "asc" });
  });

  it("parses -field with unknown field → falls back to default", () => {
    const req = makeReq("http://localhost/api/v1/tasks?sort=-evilField");
    const sort = parseSort(req, ["createdAt"]);
    expect(sort).toEqual({ field: "createdAt", dir: "desc" });
  });
});

describe("parseIncludeDeleted", () => {
  it("returns true when includeDeleted=true", () => {
    const req = makeReq("http://localhost/api/v1/tasks?includeDeleted=true");
    expect(parseIncludeDeleted(req)).toBe(true);
  });

  it("returns false when includeDeleted=false", () => {
    const req = makeReq("http://localhost/api/v1/tasks?includeDeleted=false");
    expect(parseIncludeDeleted(req)).toBe(false);
  });

  it("returns false when includeDeleted is absent", () => {
    const req = makeReq("http://localhost/api/v1/tasks");
    expect(parseIncludeDeleted(req)).toBe(false);
  });

  it("returns false for non-true values", () => {
    const req1 = makeReq("http://localhost/api/v1/tasks?includeDeleted=1");
    expect(parseIncludeDeleted(req1)).toBe(false);
    const req2 = makeReq("http://localhost/api/v1/tasks?includeDeleted=yes");
    expect(parseIncludeDeleted(req2)).toBe(false);
    const req3 = makeReq("http://localhost/api/v1/tasks?includeDeleted=");
    expect(parseIncludeDeleted(req3)).toBe(false);
  });
});
