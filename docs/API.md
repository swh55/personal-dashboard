# Silah Cloud Platform — REST API v1

> **Version:** 1.0.0
> **Base URL (production):** `https://personal-dashboard-mu-lyart.vercel.app/api/v1`
> **Base URL (local):** `http://localhost:3000/api/v1`
> **OpenAPI spec:** [`/docs/openapi.json`](./openapi.json)
> **Native client guide:** [`/docs/NATIVE_CLIENT_GUIDE.md`](./NATIVE_CLIENT_GUIDE.md)

This document is the authoritative contract for the Silah Cloud Platform REST API v1.
Every endpoint, parameter, response shape, and error code documented here is **stable**
for the lifetime of the v1 major version. Native clients (Android / Windows / iOS) and
the Next.js web client both consume this API.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Base URLs](#2-base-urls)
3. [Authentication](#3-authentication)
4. [Response Contract](#4-response-contract)
5. [Error Codes](#5-error-codes)
6. [HTTP Status Codes](#6-http-status-codes)
7. [Pagination](#7-pagination)
8. [Filtering](#8-filtering)
9. [Sorting](#9-sorting)
10. [Searching](#10-searching)
11. [Soft Delete & Hard Delete](#11-soft-delete--hard-delete)
12. [Optimistic Concurrency](#12-optimistic-concurrency)
13. [Sync Architecture](#13-sync-architecture)
14. [Rate Limits](#14-rate-limits)
15. [Versioning Strategy](#15-versioning-strategy)
16. [Endpoints](#16-endpoints)
    - [Discovery & Health](#discovery--health)
    - [Auth](#auth)
    - [Devices](#devices)
    - [Sync](#sync)
    - [CRUD Domain Endpoints](#crud-domain-endpoints)
17. [Entity Schemas Reference](#17-entity-schemas-reference)

---

## 1. Overview & Architecture

Silah Cloud Platform is a personal dashboard that organizes a user's life — tasks,
contacts, calendar, finances, projects, habits, health, and more — across **24
synchronised entity domains**. The platform consists of:

- **Web app** (Next.js 16 + React 19) deployed on Vercel — uses the same `/api/v1`
  endpoints via cookie session authentication.
- **Native clients** (Android, Windows, iOS) — use Google Sign-In to obtain an
  ID token, exchange it for a Silah access/refresh token pair, and then call
  `/api/v1/*` with `Authorization: Bearer <accessToken>`.
- **Database** — PostgreSQL (Neon) via Prisma 6. All records are user-scoped
  (every table has a `userId` foreign key).
- **Sync engine** — an append-only `SyncEvent` table acts as a per-user,
  monotonic change log. Native clients consume it via `GET /sync/pull?cursor=`
  and contribute to it via `POST /sync/push`.

The API is **single-tenant per user**: there is no global endpoint. Every call is
scoped to the authenticated user, and ownership is enforced at the data layer.

### Design Principles

| Principle                | How it's enforced |
|--------------------------|-------------------|
| **Mass-assignment-proof** | Every Zod schema uses `.strict()` — unknown fields are rejected with `VALIDATION_ERROR`. |
| **Ownership always server-derived** | `userId` comes from the bearer JWT or cookie session — never from the request body or query string. |
| **Stable error contract** | 13 stable error codes (see §5). Native clients can branch on `error.code` without parsing messages. |
| **Offline-first ready** | Sync protocol is delta-based with idempotency keys, so clients can queue changes locally and push them later without duplication. |
| **No secrets in client** | The web client never sees bearer tokens. Native clients store tokens in the platform keystore — `AUTH_SECRET` lives only on the server. |

---

## 2. Base URLs

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://personal-dashboard-mu-lyart.vercel.app/api/v1` |
| **Local development** | `http://localhost:3000/api/v1` |

All paths in this document are relative to the base URL. For example,
`POST /auth/token` means `POST https://personal-dashboard-mu-lyart.vercel.app/api/v1/auth/token`.

A `GET /` discovery endpoint at the base URL returns API metadata, the list of
sync-enabled entities, and links to these docs.

---

## 3. Authentication

The API supports two independent authentication mechanisms. A request may use
**either** — they are not mutually exclusive, but typical clients use only one.

### 3.1 Web (Cookie Session)

The Next.js web app uses NextAuth's JWT session stored in an HTTP-only cookie.
Calls to `/api/v1/*` from the browser include the cookie automatically — no
client-side code changes are required. This is invisible to native clients.

### 3.2 Native (Bearer Token)

Native clients authenticate with an **access token** (a stateless HS256 JWT)
supplied in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Tokens are obtained by exchanging a **Google ID token** for a Silah token pair
at `POST /auth/token`. The flow is:

```
┌─────────────┐                    ┌─────────────┐                  ┌──────────────┐
│  Native App │                    │  Silah API  │                  │    Google    │
│ (Android /  │                    │  /auth/token│                  │  tokeninfo   │
│ Win / iOS)  │                    │             │                  │   endpoint   │
└──────┬──────┘                    └──────┬──────┘                  └──────┬───────┘
       │                                  │                                │
       │ 1. Google Sign-In SDK → idToken  │                                │
       │ (silent sign-in / re-auth)       │                                │
       │                                  │                                │
       │ 2. POST /auth/token              │                                │
       │    { idToken, deviceId,          │                                │
       │      platform, appVersion }      │                                │
       ├─────────────────────────────────►│                                │
       │                                  │ 3. GET tokeninfo?id_token=...  │
       │                                  ├───────────────────────────────►│
       │                                  │ 4. verified payload            │
       │                                  │    { sub, email, aud, exp }    │
       │                                  │◄───────────────────────────────┤
       │                                  │                                │
       │                                  │ 5. Upsert User, upsert Device, │
       │                                  │    issue accessToken (JWT 15m) │
       │                                  │    + refreshToken (opaque 30d) │
       │                                  │                                │
       │ 6. 200 OK                        │                                │
       │    { accessToken, refreshToken,  │                                │
       │      tokenType, expiresIn, user }│                                │
       │◄─────────────────────────────────┤                                │
       │                                  │                                │
       │ 7. Store tokens in keystore.     │                                │
       │    Use accessToken on every      │                                │
       │    subsequent call.              │                                │
       │                                  │                                │
       │ 8. When accessToken expires:     │                                │
       │    POST /auth/refresh            │                                │
       │    { refreshToken }              │                                │
       ├─────────────────────────────────►│                                │
       │                                  │ 9. Hash lookup in ApiToken,    │
       │                                  │    verify not revoked / expired│
       │                                  │    → issue new accessToken     │
       │ 10. 200 OK { accessToken, ... }  │                                │
       │◄─────────────────────────────────┤                                │
       │                                  │                                │
       │ 11. Retry the original request   │                                │
       │     with the new accessToken.    │                                │
```

### 3.3 Token TTLs

| Token | Type | TTL | Storage on server |
|-------|------|-----|-------------------|
| **Access token** | HS256 JWT (stateless) | **15 minutes** | Not stored — verified by signature. A DB lookup only happens to confirm the issuing Device is not revoked. |
| **Refresh token** | Opaque random 32-byte string (base64url) | **30 days** | SHA-256 hash stored in `ApiToken.tokenHash`. The raw value is returned to the client exactly once. |

### 3.4 JWT Claims

The access token is a standard JWT. Decoded payload:

```json
{
  "sub": "user_xxxxxxxx",       // userId
  "deviceId": "dev_yyyyyyyy",   // optional — present if device was registered
  "kind": "access",
  "iat": 1730000000,
  "exp": 1730000900,
  "iss": "silah-cloud",
  "aud": "silah-api-v1"
}
```

Native clients do **not** need to decode the JWT — just send it as a bearer
token. If you want to display the expiry locally, decode with any HS256 JWT
library (the signature does not need to be verified client-side).

### 3.5 Revocation Model

| Action | Effect |
|--------|--------|
| `POST /auth/logout` with `{ refreshToken }` | That refresh token can no longer mint access tokens. The current access token keeps working until it expires (≤15 min). |
| `POST /auth/logout` with `{ deviceId }` | All tokens for that device are revoked. |
| `POST /auth/logout` with `{ allDevices: true }` | Every device for the user is revoked — full remote logout. |
| `DELETE /devices/:id` | Same as `{ deviceId }` logout. |

The access token is **stateless**: revoking a device does not immediately
invalidate its outstanding access tokens. They expire naturally within ≤15 min.
This is an intentional trade-off for performance (no DB lookup per request).

### 3.6 Auth Header Format

```
GET /api/v1/tasks HTTP/1.1
Host: personal-dashboard-mu-lyart.vercel.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1...
Accept: application/json
```

If both a bearer token and a cookie session are present, the bearer token wins.

### 3.7 Auth Failure Responses

| Scenario | HTTP | `error.code` |
|----------|------|--------------|
| No bearer token, no cookie | 401 | `UNAUTHORIZED` |
| Bearer token signature invalid | 401 | `TOKEN_EXPIRED` |
| Bearer token expired | 401 | `TOKEN_EXPIRED` |
| Device revoked (after bearer was issued) | 401 | `DEVICE_REVOKED` |
| Refresh token revoked | 401 | `TOKEN_REVOKED` |
| Refresh token expired | 401 | `TOKEN_EXPIRED` |
| Resource owned by another user | 404 | `NOT_FOUND` (intentionally not 403, to avoid leaking existence) |

---

## 4. Response Contract

Every endpoint returns JSON with one of two top-level shapes.

### 4.1 Success

```json
{
  "success": true,
  "data": { /* the resource, or array of resources, or metadata */ }
}
```

For **list endpoints**, the response includes a `pagination` key alongside `data`:

```json
{
  "success": true,
  "data": [ /* array of resources */ ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 137,
    "totalPages": 3
  }
}
```

Some endpoints add extra top-level keys (e.g. sync `push` returns `data: { results: [...] }`).
Those are documented per-endpoint in §16.

### 4.2 Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body failed validation",
    "details": {
      "title": "String must contain at least 1 character(s)"
    }
  }
}
```

The `details` field is optional. When present, it is usually an object whose
keys are field paths and whose values are human-readable validation messages.

### 4.3 No-Content Responses

A few endpoints (e.g. `POST /auth/logout` with no body) return `204 No Content`
with an empty body. The `success` envelope does not apply.

---

## 5. Error Codes

These are the **stable error codes**. Native clients should branch on `code`,
not on the human-readable `message`.

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 422 | The request body or query string failed Zod schema validation. `details` lists per-field errors. |
| `UNAUTHORIZED` | 401 | No authentication was provided, or the cookie session is anonymous. |
| `FORBIDDEN` | 403 | The caller is authenticated but lacks a permission. (Rare in v1 — most cross-user access returns `NOT_FOUND` instead.) |
| `NOT_FOUND` | 404 | The resource doesn't exist or belongs to another user. |
| `CONFLICT` | 409 | A version conflict (see §12) or a unique-constraint violation. |
| `RATE_LIMITED` | 429 | Too many requests. |
| `METHOD_NOT_ALLOWED` | 405 | The HTTP method is not supported on this path. |
| `INTERNAL_ERROR` | 500 | An unhandled server error. Safe to retry. |
| `BAD_REQUEST` | 400 | The request is malformed in a way that doesn't fit a schema check (e.g. invalid Google ID token). |
| `TOKEN_EXPIRED` | 401 | The access token's signature is invalid or it has expired. Refresh and retry. |
| `TOKEN_REVOKED` | 401 | The refresh token has been revoked. Re-authenticate. |
| `DEVICE_REVOKED` | 401 | The device has been revoked. Re-authenticate. |
| `IDEMPOTENCY_REPLAY` | 200 | (Reserved for sync push when an `operationId` was replayed — the response will instead use `status: "replayed"` in the per-change result.) |

---

## 6. HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200 OK` | Successful GET, PATCH, or DELETE; or a successful sync push. |
| `201 Created` | Successful POST that creates a resource. |
| `204 No Content` | Successful logout with no specific response body. |
| `400 Bad Request` | Malformed request (non-JSON body, invalid cursor, etc.). |
| `401 Unauthorized` | Missing or invalid authentication. |
| `403 Forbidden` | Authenticated but not permitted (rare in v1). |
| `404 Not Found` | Resource doesn't exist or isn't owned by the caller. |
| `405 Method Not Allowed` | The path exists but doesn't support this HTTP verb. |
| `409 Conflict` | Version conflict or unique-constraint violation. |
| `422 Unprocessable Entity` | The body is valid JSON but fails schema validation. |
| `429 Too Many Requests` | Rate-limited. |
| `500 Internal Server Error` | Server error. Safe to retry with backoff. |
| `503 Service Unavailable` | Health check reports `degraded` (DB down). |

---

## 7. Pagination

All list endpoints accept `page` and `pageSize` query params.

| Param | Type | Default | Bounds |
|-------|------|---------|--------|
| `page` | integer | `1` | `≥ 1` |
| `pageSize` | integer | `50` | `1` … `100` (clamped) |

If `pageSize` exceeds 100, it is silently clamped to 100. If `page` is less than
1 or non-numeric, it defaults to 1.

### Response Envelope

```json
{
  "success": true,
  "data": [ /* … */ ],
  "pagination": {
    "page": 2,
    "pageSize": 50,
    "total": 137,
    "totalPages": 3
  }
}
```

`totalPages` is `ceil(total / pageSize)`. When `total` is `0`, `totalPages` is `0`.

---

## 8. Filtering

List endpoints accept whitelisted filter params of the form `?field=value`.
The whitelist is **per-entity** (see §17). Unknown filter keys are silently
ignored (not an error) — they simply don't affect the query.

Example:

```
GET /tasks?status=doing&priority=high
```

### Date Range

Every list endpoint also accepts two date-range params:

| Param | Type | Format |
|-------|------|--------|
| `dateFrom` | ISO 8601 datetime | `2025-01-01T00:00:00Z` |
| `dateTo` | ISO 8601 datetime | `2025-12-31T23:59:59Z` |

These are applied as an inclusive range. If the entity has a `date` field, the
range filters on it; otherwise it falls back to `createdAt`. Invalid date
strings are silently dropped.

Example:

```
GET /expenses?dateFrom=2025-01-01T00:00:00Z&dateTo=2025-01-31T23:59:59Z
```

### Boolean Filters

Boolean filter values are passed as the literal string `"true"` or `"false"`.
For example: `GET /contacts?favorite=true`.

---

## 9. Sorting

List endpoints accept a `sort` query param:

- `sort=createdAt` — ascending
- `sort=-createdAt` — descending (prefix with `-`)
- `sort=+createdAt` — explicitly ascending (the `+` is optional)

The whitelist of sortable fields is per-entity (see §17). Sorting by an
unknown field silently falls back to the entity's default sort.

---

## 10. Searching

List endpoints accept a `search` query param. It performs a case-insensitive
`contains` match across the entity's whitelisted searchable fields (joined
with `OR`).

```
GET /tasks?search=invoice
```

The searchable fields per entity are listed in §17. Entities with no
searchable fields silently ignore the `search` param.

---

## 11. Soft Delete & Hard Delete

All 24 sync-enabled entities support **soft deletion** via a `deletedAt`
timestamp column.

### Default Behavior

- `DELETE /tasks/:id` → sets `deletedAt = now()` and bumps `version`. The
  record remains in the database.
- `GET /tasks` → excludes records where `deletedAt` is set.
- `GET /tasks/:id` → returns `404` for soft-deleted records (unless
  `?includeDeleted=true` is supplied).

### Listing Soft-Deleted Records

```
GET /tasks?includeDeleted=true
```

Returns both live and soft-deleted records. The `deletedAt` field on each
record tells you which is which (`null` for live, ISO timestamp for deleted).

### Hard Delete

```
DELETE /tasks/:id?force=true
```

Permanently removes the record from the database. Use with caution — there is
no undo. A `delete` SyncEvent is still recorded so other clients can remove
their local copy.

### Soft-Delete Propagation in Sync

Soft-deletes are propagated through the sync engine as a `delete` event with
a minimal payload `{ id, deletedAt }`. Clients should mark their local copy
as deleted (or remove it) when they see such an event.

---

## 12. Optimistic Concurrency

Every mutable record has an integer `version` field that starts at `1` and
increments by 1 on every PATCH or soft-delete.

### How to Use It

When updating a record, include `baseVersion` in the PATCH body — the version
your client last saw:

```http
PATCH /tasks/abc123 HTTP/1.1
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "Updated title",
  "baseVersion": 4
}
```

If the server's current `version` doesn't match `baseVersion`, it responds:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Version conflict — the record was modified by another client",
    "details": {
      "baseVersion": 4,
      "currentVersion": 7,
      "strategy": "Pull the latest version and retry your change."
    }
  }
}
```

### When `baseVersion` Is Omitted

If the PATCH body has no `baseVersion` field, the check is skipped and the
update applies unconditionally (last-write-wins). This is fine for single-
client use but unsafe for multi-device sync — always send `baseVersion` if
you support sync.

### Response After Successful Update

The response includes the new `version` (e.g. `5`) so the client can update
its local copy and use it as the `baseVersion` for the next change.

---

## 13. Sync Architecture

Sync lets a native client have a full local copy of the user's data and stay
up to date across multiple devices. The model is **delta-based with
last-write-wins and idempotent pushes**.

### 13.1 The SyncEvent Table

Every mutation on a sync-enabled entity (create / update / delete, whether
via a CRUD endpoint or via `POST /sync/push`) writes a row to `SyncEvent`
**inside the same Prisma transaction** as the data change. The row contains:

| Field | Type | Description |
|-------|------|-------------|
| `seq` | `BigInt` | Per-user monotonic sequence number. `@@unique([userId, seq])`. |
| `entity` | `String` | The Prisma delegate name (e.g. `"task"`, `"contact"`). |
| `entityId` | `String` | The record's `id`. |
| `operation` | `Enum` | `"create"`, `"update"`, or `"delete"`. |
| `payload` | `JSON` | The full record after the change (or `{ id, deletedAt }` for deletes). |
| `operationId` | `String?` | Client-supplied idempotency key (only present for `sync/push` operations). |
| `deviceId` | `String?` | The device that made the change (audit trail). |
| `createdAt` | `DateTime` | When the event was recorded. |

### 13.2 Pull — Delta Sync

```
GET /sync/pull?cursor=<lastSeq>&pageSize=500
```

Returns all SyncEvents with `seq > cursor`, in ascending `seq` order. The
response includes `nextCursor`, which the client persists and uses as the
`cursor` for the next pull.

If `hasMore` is `true`, the client should immediately issue another pull
with the new cursor — there are more events waiting.

If `cursor` is omitted or `0`, the pull is a **full sync** from the
beginning of the user's history. This is what a freshly-installed native
client does on first launch.

### 13.3 Push — Offline Changes

```
POST /sync/push
{
  "changes": [
    {
      "operationId": "550e8400-e29b-41d4-a716-446655440000",
      "entity": "tasks",
      "entityId": "client-cuid-1",
      "operation": "create",
      "payload": { "title": "Buy milk", "status": "todo" }
    },
    {
      "operationId": "550e8400-e29b-41d4-a716-446655440001",
      "entity": "tasks",
      "entityId": "client-cuid-2",
      "operation": "update",
      "baseVersion": 3,
      "payload": { "title": "Buy oat milk" }
    },
    {
      "operationId": "550e8400-e29b-41d4-a716-446655440002",
      "entity": "tasks",
      "entityId": "client-cuid-3",
      "operation": "delete"
    }
  ]
}
```

- **Max batch size**: 100 changes per request.
- **Idempotency**: each change must include a unique `operationId` (UUID).
  If you replay the same `operationId`, the server returns
  `status: "replayed"` with the original `entityId` — no duplicate write.
- **Per-change transactions**: each change is its own transaction. A failure
  in one does not roll back others; the response has per-change results.

### 13.4 Push Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "operationId": "550e8400-e29b-41d4-a716-446655440000",
        "status": "applied",
        "entityId": "client-cuid-1",
        "version": 1
      },
      {
        "operationId": "550e8400-e29b-41d4-a716-446655440001",
        "status": "conflict",
        "entityId": "client-cuid-2",
        "version": 7
      },
      {
        "operationId": "550e8400-e29b-41d4-a716-446655440002",
        "status": "applied",
        "entityId": "client-cuid-3"
      }
    ]
  }
}
```

Possible `status` values:

| Status | Meaning |
|--------|---------|
| `applied` | The change was written. A new SyncEvent was recorded. |
| `replayed` | The `operationId` was already seen — the original result is returned. |
| `conflict` | `baseVersion` did not match the server's current `version`. The client should pull the latest, merge, and retry with the new `baseVersion`. |
| `error` | The change failed (record not found, unknown entity, unique constraint, etc.). `error` contains a message. |
| `skipped` | The change was skipped (reserved for future use). |

### 13.5 Conflict Detection

Conflicts are detected via `baseVersion`:

- On `update`: if `baseVersion` is supplied and doesn't match the server's
  current `version`, the change is rejected with `status: "conflict"`.
- On `delete`: no version check is performed. The delete is applied
  unconditionally (last-write-wins). If the record was already deleted, the
  operation is idempotent.
- On `create`: the client supplies the `entityId` (a CUID). The server
  upserts — if the ID already exists, the existing record is updated
  instead of erroring. This makes create-idempotent across replays.

### 13.6 Soft-Delete Propagation

When a record is soft-deleted (via `DELETE /tasks/:id` or via a `delete`
operation in `sync/push`), the SyncEvent payload is:

```json
{ "id": "abc123", "deletedAt": "2025-01-15T10:30:00.000Z" }
```

Native clients should mark their local copy as deleted (or purge it) when
they see this event.

### 13.7 Sync Status

```
GET /sync/status
```

Returns metadata about the user's sync state:

```json
{
  "success": true,
  "data": {
    "latestSeq": "12345",
    "eventCount": 12345,
    "lastEventAt": "2025-01-15T10:30:00.000Z",
    "perEntity": {
      "tasks": { "count": 500, "lastSeq": "12300", "lastEventAt": "2025-01-15T10:00:00Z" },
      "contacts": { "count": 200, "lastSeq": "12345", "lastEventAt": "2025-01-15T10:30:00Z" }
    },
    "device": {
      "id": "dev_xxx",
      "name": "Pixel 8",
      "platform": "android",
      "appVersion": "1.0.0",
      "lastSeenAt": "2025-01-15T10:29:00Z",
      "revokedAt": null
    },
    "serverTime": "2025-01-15T10:30:01Z"
  }
}
```

Use `latestSeq` as the initial cursor for a fresh sync.

### 13.8 Recommended Sync Loop

```
1. On launch: load persisted cursor (or 0 for first sync).
2. Loop: GET /sync/pull?cursor=<cursor>
   - Apply each event to local DB (create/update/delete).
   - Update local cursor to nextCursor.
   - If hasMore, repeat immediately; else break.
3. Drain local outbox:
   - POST /sync/push with up to 100 pending changes.
   - For each result:
     - applied → remove from outbox.
     - replayed → remove from outbox (already done).
     - conflict → pull latest, merge, re-queue with new baseVersion.
     - error → log + keep in outbox for retry with backoff.
4. Schedule next sync:
   - On data mutation: immediate.
   - Otherwise: every 5 minutes (or via push notification).
```

See [`NATIVE_CLIENT_GUIDE.md`](./NATIVE_CLIENT_GUIDE.md) for full pseudocode.

---

## 14. Rate Limits

The v1 API currently uses a basic in-memory per-instance rate limiter. The
limits are intentionally generous for typical single-user traffic but will
reject bursts. Practical limits:

| Scope | Limit |
|-------|-------|
| Per-IP (anonymous) | 60 requests / minute |
| Per-user (authenticated) | 300 requests / minute |
| `POST /auth/token` | 10 requests / minute per IP (anti-abuse on Google token verification) |
| `POST /sync/push` | 30 requests / minute per user |

When rate-limited, the response is:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests"
  }
}
```

with HTTP 429. There is no `Retry-After` header in v1 — clients should use
exponential backoff (start at 1s, double up to 60s).

> **Note:** Because the rate limiter is in-memory and per-instance, multi-
> instance deployments (e.g. Vercel serverless) may effectively allow N× the
> listed limits. Treat the limits as soft guidance, not hard guarantees. A
> distributed Redis-backed limiter is planned for v1.1.

---

## 15. Versioning Strategy

### Current Version

The current major version is **v1**, accessed via the `/api/v1/` URL prefix.

### Backward Compatibility Guarantees (within v1)

The following are **stable** and will not change without a major version bump:

- URL paths under `/api/v1/`
- HTTP methods on each path
- Request body schemas (fields may be **added** but not removed or renamed)
- Response envelope shape (`{ success, data }` / `{ success, error }`)
- Error code strings (§5)
- The 13 error codes are exhaustive — new codes may be added but existing
  ones will not be removed or renamed
- The semantics of `baseVersion`, `cursor`, `operationId`
- Token TTLs (15 min access / 30 day refresh) — these may change in a minor
  version, but the API will continue to return `expiresIn` so clients can
  adapt dynamically

### Forward Compatibility Guarantees (for native clients)

- New fields **may** be added to response objects. Clients must ignore
  unknown fields (don't fail parsing).
- New query params **may** be added to list endpoints.
- New endpoints **may** be added under `/api/v1/`.
- New error codes **may** be added. Clients should treat unknown codes as
  `INTERNAL_ERROR` (display the message, log the code).

### Breaking Changes → v2

When v2 is introduced:

- v2 will live at `/api/v2/`.
- v1 will be maintained for **at least 12 months** after v2 ships, with
  bug fixes but no new features.
- The sunset of v1 will be announced via the `GET /` discovery endpoint
  (a `deprecation` field) and via HTTP `Sunset` headers on v1 responses.

### Minor Versions

Minor versions (e.g. v1.1) are reflected in the `version` field of the
`GET /` and `GET /health` responses but do **not** change the URL prefix.
Minor versions add features; they never break compatibility.

---

## 16. Endpoints

### Discovery & Health

#### `GET /`

**Auth:** none

Returns API metadata, sync entity list, and documentation links.

**Response:**

```json
{
  "success": true,
  "data": {
    "name": "Silah Cloud Platform API",
    "version": "v1",
    "description": "Production REST API for the Silah personal dashboard…",
    "baseUrl": "/api/v1",
    "authentication": {
      "web": "NextAuth cookie session (automatic for the web app)",
      "native": "Bearer access token from POST /api/v1/auth/token (Google ID token exchange)",
      "docs": "See /docs/API.md for the full authentication flow."
    },
    "sync": {
      "enabled": true,
      "pullEndpoint": "GET /api/v1/sync/pull?cursor=<seq>",
      "pushEndpoint": "POST /api/v1/sync/push",
      "statusEndpoint": "GET /api/v1/sync/status",
      "syncEnabledEntities": ["contacts", "notes", "events", "tasks", "expenses", ...]
    },
    "domains": ["auth", "tasks", "contacts", ...],
    "links": {
      "self": "/api/v1",
      "health": "/api/v1/health",
      "docs": "/docs/API.md",
      "openapi": "/docs/openapi.json"
    }
  }
}
```

---

#### `GET /health`

**Auth:** none

Lightweight liveness + database probe. Safe to call unauthenticated. Does
not expose secrets.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "v1",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "latencyMs": 12,
    "services": { "database": "ok" }
  }
}
```

If the database is unreachable, returns HTTP **503** with
`status: "degraded"` and `services.database: "down"`.

---

### Auth

#### `POST /auth/token`

Exchange a Google ID token for a Silah access + refresh token pair.

**Auth:** none (this is the login endpoint)

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idToken` | string | yes | Google ID token from the platform Sign-In SDK. |
| `deviceId` | string | no | Stable client-generated device identifier (e.g. Android `ANDROID_ID`, Windows machine GUID, iOS `UIDevice.identifierForVendor`). Used to upsert the Device row. |
| `deviceName` | string | no | Human-readable device name (e.g. "Pixel 8"). |
| `platform` | enum | no | `"android"`, `"windows"`, `"ios"`, `"web"`, `"other"`. |
| `appVersion` | string | no | Client app version (e.g. `"1.0.0"`). |

The schema is `.strict()` — unknown fields are rejected.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "user_xxx",
      "email": "user@example.com",
      "name": "Example User",
      "image": "https://lh3.googleusercontent.com/...",
      "provider": "google"
    }
  }
}
```

- `expiresIn` is in seconds (always `900` = 15 minutes for v1).
- The `refreshToken` is returned **once**. Store it securely.

**Errors:**

| HTTP | `error.code` | When |
|------|--------------|------|
| 400 | `BAD_REQUEST` | Google ID token is invalid, expired, or has the wrong audience. |
| 422 | `VALIDATION_ERROR` | Request body failed schema validation. |
| 500 | `INTERNAL_ERROR` | `AUTH_SECRET` env var is missing on the server. |

---

#### `POST /auth/refresh`

Exchange a refresh token for a new access token.

**Auth:** none (the refresh token itself is the credential)

**Request body:**

```json
{ "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..." }
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

**Errors:**

| HTTP | `error.code` | When |
|------|--------------|------|
| 401 | `UNAUTHORIZED` | Refresh token not found in DB. |
| 401 | `TOKEN_REVOKED` | Refresh token was revoked (logout). |
| 401 | `DEVICE_REVOKED` | The device was revoked. |
| 401 | `TOKEN_EXPIRED` | Refresh token has expired (>30 days old). Re-authenticate. |

The refresh token is **not rotated** in v1 — the same refresh token can be
used repeatedly until it expires or is revoked. (Rotation is planned for v1.1.)

---

#### `POST /auth/logout`

Revoke a refresh token and/or device.

**Auth:** required (bearer or cookie)

**Request body (one of):**

```json
{ "refreshToken": "..." }     // revoke just this refresh token
{ "deviceId": "dev_xxx" }      // revoke a specific device + its tokens
{ "allDevices": true }          // revoke ALL the user's devices + tokens
{}                              // revoke the calling device (bearer only)
```

All fields are optional; the schema is `.strict()`.

**Response (200 OK):**

```json
{ "success": true, "data": { "revoked": "all-devices" } }
```

Possible `revoked` values: `"all-devices"`, `"device"`, `"token"`,
`"calling-device"`. If no body was supplied and the caller has no device
(i.e. cookie session), returns **204 No Content**.

---

#### `GET /auth/me`

Returns the authenticated user's profile.

**Auth:** required (bearer or cookie)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "user_xxx",
    "email": "user@example.com",
    "name": "Example User",
    "image": "https://...",
    "provider": "google",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "authMethod": "bearer",
    "deviceId": "dev_xxx"
  }
}
```

`authMethod` is `"bearer"` for native clients and `"cookie"` for the web app.
`deviceId` is `null` for cookie callers.

---

### Devices

#### `GET /devices`

List the caller's devices, most-recently-seen first.

**Auth:** required

**Query params:** standard pagination (`page`, `pageSize`)

**Response:** standard list envelope. Each device:

```json
{
  "id": "dev_xxx",
  "name": "Pixel 8",
  "platform": "android",
  "appVersion": "1.0.0",
  "deviceId": "client-supplied-id",
  "userAgent": "okhttp/4.12.0",
  "lastSeenAt": "2025-01-15T10:00:00Z",
  "revokedAt": null,
  "createdAt": "2024-12-01T00:00:00Z"
}
```

---

#### `POST /devices`

Register or update a device. (Rarely needed — `POST /auth/token` does this
automatically on login.)

**Auth:** required

**Request body:**

```json
{
  "deviceId": "client-supplied-id",
  "name": "Pixel 8",
  "platform": "android",
  "appVersion": "1.0.0"
}
```

Upserts by `(userId, deviceId)`. Re-registering an existing device
un-revokes it.

**Response (201 Created):** the device object (without `revokedAt`).

---

#### `GET /devices/:id`

Get a single device by its server-side `id` (not the client-supplied
`deviceId`).

**Auth:** required (must own the device)

**Response (200 OK):** the device object (with `revokedAt`, `updatedAt`).

**Errors:** 404 `NOT_FOUND` if the device doesn't exist or isn't owned by
the caller.

---

#### `DELETE /devices/:id`

Revoke a device (remote logout). Sets `revokedAt = now()`. Does not delete
the row — the device stays in the list (with `revokedAt` set) for audit.

**Auth:** required (must own the device)

**Response (200 OK):**

```json
{ "success": true, "data": { "id": "dev_xxx", "revoked": true } }
```

---

### Sync

#### `GET /sync/pull`

Delta pull: fetch SyncEvents since a cursor.

**Auth:** required

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | bigint string | `0` | The last `seq` the client has applied. `0` or omitted = full pull. |
| `pageSize` | integer | `500` | Max events to return. Capped at `1000`. |
| `collections` | comma-separated strings | (all) | Limit to specific entity plurals, e.g. `tasks,contacts`. Unknown names are dropped. |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "seq": "12346",
        "entity": "task",
        "entityId": "abc123",
        "operation": "create",
        "payload": { "id": "abc123", "title": "Buy milk", "version": 1, ... },
        "createdAt": "2025-01-15T10:00:00Z",
        "deviceId": "dev_xxx"
      },
      {
        "seq": "12347",
        "entity": "task",
        "entityId": "abc123",
        "operation": "delete",
        "payload": { "id": "abc123", "deletedAt": "2025-01-15T10:30:00Z" },
        "createdAt": "2025-01-15T10:30:00Z",
        "deviceId": "dev_yyy"
      }
    ],
    "nextCursor": "12347",
    "hasMore": false,
    "serverTime": "2025-01-15T10:30:01Z"
  }
}
```

- `seq` and `nextCursor` are returned as **strings** because they are BigInts
  that may exceed JavaScript's `Number.MAX_SAFE_INTEGER`.
- Apply events to the local DB in `seq` order. The same `seq` will never
  appear in two different pulls.
- If `cursor` is invalid (non-numeric), the response is `200 OK` with an
  empty `events` array and an `error` field in `data` describing the
  problem. This is a soft-fail to avoid breaking clients that persisted a
  bad cursor.

---

#### `POST /sync/push`

Push up to 100 offline changes.

**Auth:** required

**Request body:**

```json
{
  "changes": [
    {
      "operationId": "uuid-string",
      "entity": "tasks",
      "entityId": "client-cuid",
      "operation": "create" | "update" | "delete",
      "baseVersion": 4,
      "payload": { ... }
    }
  ]
}
```

- `operationId` (required): a UUIDv4 generated client-side. Used for
  idempotency.
- `entity` (required): the **plural** name (e.g. `"tasks"`, `"waiting-list"`).
- `entityId` (required): for `create`, the client-generated CUID that
  becomes the new record's `id`. For `update` / `delete`, the existing
  record's `id`.
- `baseVersion` (optional, only for `update`): the version the client last
  saw. If omitted, no version check (last-write-wins).
- `payload` (optional): the record fields. For `delete`, omit. For `create`
  / `update`, must conform to the entity's create/update schema (see §17).

Server-managed fields (`id`, `userId`, `createdAt`, `updatedAt`,
`deletedAt`, `version`) are stripped from `payload` automatically —
including them is harmless but ignored.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "operationId": "...",
        "status": "applied" | "replayed" | "conflict" | "error" | "skipped",
        "entityId": "...",
        "version": 5,
        "error": "optional error message"
      }
    ]
  }
}
```

See §13.4 for the meaning of each `status`.

---

#### `GET /sync/status`

Sync metadata for the current user.

**Auth:** required

**Response (200 OK):** see §13.7.

---

### CRUD Domain Endpoints

Each of the 24 sync-enabled entities has a standard set of 5 endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/{entity}` | List with pagination, filters, sort, search |
| `POST` | `/{entity}` | Create a new record |
| `GET` | `/{entity}/:id` | Fetch a single record |
| `PATCH` | `/{entity}/:id` | Update a record (with optional `baseVersion`) |
| `DELETE` | `/{entity}/:id` | Soft-delete (or `?force=true` for hard delete) |

The 24 entities are:

```
tasks, contacts, notes, events, expenses, accounts, assets, debts,
budgets, projects, meetings, occasions, diary, habits, medications,
pantry, waiting-list, locations, reminders, scheduled-messages,
automation, suggestions, integrations, happiness
```

The exact URL is `/api/v1/<entity>` — for example, `GET /api/v1/waiting-list`.

#### Common Behavior

All 120 endpoints share the following behavior:

**Auth:** required (bearer or cookie). The `userId` is always taken from
the auth principal, never from the request body.

**GET list query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | 1-based page number |
| `pageSize` | integer | 1–100, default 50 |
| `sort` | string | `field` or `-field` (desc) |
| `search` | string | case-insensitive contains across searchable fields |
| `dateFrom` | ISO date | inclusive lower bound on `date` (or `createdAt`) |
| `dateTo` | ISO date | inclusive upper bound |
| `includeDeleted` | `"true"` | include soft-deleted records |
| `<filterField>` | string | any whitelisted filter field for this entity |

**POST create body:** the entity's create schema (see §17). `.strict()` —
unknown fields are rejected.

**GET item response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "userId": "user_xxx",
    "version": 4,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z",
    "deletedAt": null,
    "title": "Buy milk",
    ... // entity-specific fields
  }
}
```

`userId` is included in the response — clients can use it to verify
ownership locally (though the server always enforces it).

**PATCH update body:** the entity's update schema (all fields optional),
plus an optional `baseVersion` for optimistic concurrency.

**PATCH response (200 OK):** the full updated record (with bumped `version`).

**DELETE response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "deleted": true,
    "soft": true
  }
}
```

`soft` is `true` for normal soft-delete, `false` for `?force=true` hard
delete.

#### Common Errors

| HTTP | `error.code` | When |
|------|--------------|------|
| 401 | `UNAUTHORIZED` | No / invalid auth. |
| 404 | `NOT_FOUND` | Record doesn't exist or isn't owned by the caller. |
| 409 | `CONFLICT` | `baseVersion` mismatch (see §12) or unique-constraint violation. |
| 422 | `VALIDATION_ERROR` | Body failed schema validation. `details` lists per-field errors. |
| 500 | `INTERNAL_ERROR` | Server error. |

---

## 17. Entity Schemas Reference

Each entity's create/update schema, filterable fields, sortable fields, and
searchable fields are listed below. Schemas use Zod's `.strict()` — unknown
fields are rejected.

Date fields accept ISO 8601 with optional offset (e.g.
`2025-01-15T10:30:00Z` or `2025-01-15T13:30:00+03:00`).

### tasks

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `title` | required | optional | string, 1–500 chars |
| `description` | optional | optional | string, ≤20000 chars, nullable |
| `status` | default `"todo"` | optional | enum: `todo`, `doing`, `done` |
| `priority` | default `"medium"` | optional | enum: `low`, `medium`, `high` |
| `category` | default `"general"` | optional | string, ≤100 chars |
| `dueDate` | optional | optional | ISO datetime, nullable |
| `projectId` | optional | optional | string, 1–100 chars, nullable |

- **Filterable:** `status`, `priority`, `category`, `projectId`
- **Sortable:** `createdAt`, `updatedAt`, `priority`, `dueDate`, `status`
- **Searchable:** `title`, `description`
- **Default sort:** `createdAt` desc
- **Default include:** `project`

### contacts

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `phone` | required | optional | string, 1–50 chars |
| `whatsapp` | optional | optional | string, ≤50 chars, nullable |
| `email` | optional | optional | email, ≤200 chars, nullable |
| `relation` | default `"other"` | optional | enum: `family`, `friend`, `work`, `business`, `other` |
| `category` | optional | optional | string, ≤100 chars, nullable |
| `note` | optional | optional | string, ≤5000 chars, nullable |
| `favorite` | default `false` | optional | boolean |
| `avatar` | optional | optional | string, ≤2000 chars, nullable |

- **Filterable:** `relation`, `category`, `favorite`
- **Sortable:** `createdAt`, `updatedAt`, `name`
- **Searchable:** `name`, `phone`, `whatsapp`, `email`, `note`
- **Default sort:** `name` asc

### notes

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `title` | required | optional | string, 1–500 chars |
| `content` | required | optional | string, ≤100000 chars |
| `color` | default `"default"` | optional | enum: `default`, `yellow`, `green`, `blue`, `red`, `purple` |
| `pinned` | default `false` | optional | boolean |

- **Filterable:** `color`, `pinned`
- **Sortable:** `createdAt`, `updatedAt`, `title`
- **Searchable:** `title`, `content`
- **Default sort:** `pinned` desc

### events

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `title` | required | optional | string, 1–500 chars |
| `description` | optional | optional | string, ≤20000 chars, nullable |
| `startDate` | required | optional | ISO datetime |
| `endDate` | optional | optional | ISO datetime, nullable |
| `allDay` | default `false` | optional | boolean |
| `type` | default `"personal"` | optional | enum: `work`, `personal`, `family`, `health`, `other` |
| `color` | default `"emerald"` | optional | enum: `emerald`, `amber`, `rose`, `blue`, `violet`, `slate` |
| `location` | optional | optional | string, ≤500 chars, nullable |

- **Filterable:** `type`, `color`
- **Sortable:** `startDate`, `createdAt`, `updatedAt`
- **Searchable:** `title`, `description`, `location`
- **Default sort:** `startDate` asc

### expenses

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `amount` | required | optional | finite number |
| `currency` | default `"syp"` | optional | enum: `syp`, `usd` |
| `category` | default `"general"` | optional | string, ≤100 chars |
| `description` | optional | optional | string, ≤2000 chars, nullable |
| `date` | optional | optional | ISO datetime, nullable |
| `accountId` | optional | optional | string, 1–100 chars, nullable |

- **Filterable:** `category`, `currency`, `accountId`
- **Sortable:** `date`, `createdAt`, `amount`
- **Searchable:** `description`, `category`
- **Default sort:** `date` desc

### accounts

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `balance` | default `0` | optional | finite number |
| `currency` | default `"syp"` | optional | enum: `syp`, `usd` |
| `type` | default `"bank"` | optional | enum: `bank`, `cash`, `savings`, `credit` |
| `institution` | optional | optional | string, ≤200 chars, nullable |

- **Filterable:** `type`, `currency`
- **Sortable:** `createdAt`, `updatedAt`, `name`, `balance`
- **Searchable:** `name`, `institution`
- **Default sort:** `createdAt` asc

### assets

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `amount` | required | optional | finite number |
| `currency` | default `"syp"` | optional | enum: `syp`, `usd` |
| `type` | default `"cash"` | optional | enum: `cash`, `bank`, `real-estate`, `gold`, `stocks`, `other` |
| `description` | optional | optional | string, ≤2000 chars, nullable |

- **Filterable:** `type`, `currency`
- **Sortable:** `createdAt`, `updatedAt`, `name`, `amount`
- **Searchable:** `name`, `description`
- **Default sort:** `createdAt` desc

### debts

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `personName` | required | optional | string, 1–200 chars |
| `amount` | required | optional | finite number |
| `currency` | default `"syp"` | optional | enum: `syp`, `usd` |
| `type` | default `"owed"` | optional | enum: `owed`, `owe` |
| `description` | optional | optional | string, ≤2000 chars, nullable |
| `dueDate` | optional | optional | ISO datetime, nullable |
| `settled` | default `false` | optional | boolean |

- **Filterable:** `type`, `currency`, `settled`
- **Sortable:** `createdAt`, `dueDate`, `amount`
- **Searchable:** `personName`, `description`
- **Default sort:** `createdAt` desc

### budgets

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `category` | required | optional | string, 1–100 chars |
| `limit` | required | optional | finite positive number |
| `month` | required | optional | integer 1–12 |
| `year` | required | optional | integer 2000–2100 |

- **Filterable:** `category`, `month`, `year`
- **Sortable:** `createdAt`, `year`, `month`
- **Searchable:** (none)
- **Default sort:** `year` desc

### projects

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `description` | optional | optional | string, ≤20000 chars, nullable |
| `status` | default `"active"` | optional | enum: `active`, `paused`, `completed`, `archived` |
| `color` | default `"emerald"` | optional | string, ≤50 chars |
| `progress` | default `0` | optional | integer 0–100 |
| `startDate` | optional | optional | ISO datetime, nullable |
| `endDate` | optional | optional | ISO datetime, nullable |

- **Filterable:** `status`, `color`
- **Sortable:** `createdAt`, `updatedAt`, `name`, `progress`
- **Searchable:** `name`, `description`
- **Default include:** `tasks`, `checklist`
- **Default sort:** `createdAt` desc

### meetings

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `title` | required | optional | string, 1–500 chars |
| `agenda` | optional | optional | string, ≤20000 chars, nullable |
| `notes` | optional | optional | string, ≤20000 chars, nullable |
| `location` | optional | optional | string, ≤500 chars, nullable |
| `participants` | optional | optional | string, ≤2000 chars, nullable |
| `startDate` | required | optional | ISO datetime |
| `endDate` | optional | optional | ISO datetime, nullable |
| `status` | default `"scheduled"` | optional | enum: `scheduled`, `completed`, `cancelled` |

- **Filterable:** `status`
- **Sortable:** `startDate`, `createdAt`, `updatedAt`
- **Searchable:** `title`, `agenda`, `notes`, `location`, `participants`
- **Default sort:** `startDate` asc

### occasions

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `title` | required | optional | string, 1–200 chars |
| `date` | required | optional | ISO datetime |
| `type` | default `"birthday"` | optional | enum: `birthday`, `anniversary`, `holiday`, `other` |
| `recurring` | default `true` | optional | boolean |
| `note` | optional | optional | string, ≤2000 chars, nullable |

- **Filterable:** `type`, `recurring`
- **Sortable:** `date`, `createdAt`
- **Searchable:** `title`, `note`
- **Default sort:** `date` asc

### diary

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `title` | optional | optional | string, ≤500 chars, nullable |
| `content` | required | optional | string, ≤100000 chars |
| `mood` | default `"neutral"` | optional | enum: `happy`, `sad`, `neutral`, `angry`, `excited`, `anxious` |
| `weather` | optional | optional | string, ≤50 chars, nullable |
| `date` | optional | optional | ISO datetime, nullable |

- **Filterable:** `mood`
- **Sortable:** `date`, `createdAt`, `updatedAt`
- **Searchable:** `title`, `content`
- **Default sort:** `date` desc

### habits

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `description` | optional | optional | string, ≤2000 chars, nullable |
| `frequency` | default `"daily"` | optional | enum: `daily`, `weekly` |
| `target` | default `1` | optional | integer 1–1000 |
| `color` | default `"emerald"` | optional | string, ≤50 chars |
| `icon` | default `"CheckCircle"` | optional | string, ≤100 chars |
| `active` | default `true` | optional | boolean |

- **Filterable:** `frequency`, `active`
- **Sortable:** `createdAt`, `updatedAt`, `name`
- **Searchable:** `name`, `description`
- **Default include:** `logs`
- **Default sort:** `createdAt` asc

### medications

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `dosage` | optional | optional | string, ≤200 chars, nullable |
| `frequency` | default `"daily"` | optional | string, ≤100 chars |
| `startDate` | optional | optional | ISO datetime, nullable |
| `endDate` | optional | optional | ISO datetime, nullable |
| `notes` | optional | optional | string, ≤2000 chars, nullable |
| `active` | default `true` | optional | boolean |

- **Filterable:** `active`, `frequency`
- **Sortable:** `createdAt`, `updatedAt`, `name`
- **Searchable:** `name`, `dosage`, `notes`
- **Default sort:** `createdAt` asc

### pantry

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `quantity` | default `1` | optional | integer ≥0 |
| `unit` | default `"piece"` | optional | enum: `piece`, `kg`, `g`, `l`, `ml`, `pack` |
| `lowStock` | default `1` | optional | integer ≥0 |
| `category` | default `"other"` | optional | enum: `grains`, `dairy`, `meat`, `vegetables`, `fruits`, `beverages`, `cleaning`, `other` |

- **Filterable:** `category`, `unit`
- **Sortable:** `createdAt`, `updatedAt`, `name`, `quantity`
- **Searchable:** `name`
- **Default sort:** `name` asc

### waiting-list

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `title` | required | optional | string, 1–500 chars |
| `description` | optional | optional | string, ≤2000 chars, nullable |
| `priority` | default `0` | optional | integer 0–100 |
| `ready` | default `false` | optional | boolean |

- **Filterable:** `ready`, `priority`
- **Sortable:** `priority`, `createdAt`, `updatedAt`
- **Searchable:** `title`, `description`
- **Default sort:** `priority` desc

### locations

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `address` | default `""` | optional | string, ≤1000 chars |
| `lat` | required | optional | finite number (latitude) |
| `lng` | required | optional | finite number (longitude) |
| `icon` | default `"MapPin"` | optional | string, ≤100 chars |
| `color` | default `"blue"` | optional | string, ≤50 chars |

- **Filterable:** `color`
- **Sortable:** `createdAt`, `updatedAt`, `name`
- **Searchable:** `name`, `address`
- **Default sort:** `name` asc

### reminders

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `contactId` | optional | optional | string, 1–100 chars, nullable |
| `contactName` | required | optional | string, 1–200 chars |
| `frequency` | default `"weekly"` | optional | enum: `daily`, `weekly`, `monthly` |
| `lastContacted` | optional | optional | ISO datetime, nullable |
| `nextReminder` | optional | optional | ISO datetime, nullable |
| `active` | default `true` | optional | boolean |

- **Filterable:** `frequency`, `active`, `contactId`
- **Sortable:** `nextReminder`, `createdAt`, `updatedAt`
- **Searchable:** `contactName`
- **Default sort:** `nextReminder` asc

### scheduled-messages

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `recipient` | required | optional | string, 1–200 chars |
| `message` | required | optional | string, ≤10000 chars |
| `channel` | default `"whatsapp"` | optional | enum: `whatsapp`, `sms`, `telegram`, `email` |
| `scheduledAt` | required | optional | ISO datetime |
| `sent` | (server-managed) | optional | boolean — can be patched to mark as sent |

- **Filterable:** `channel`, `sent`
- **Sortable:** `scheduledAt`, `createdAt`
- **Searchable:** `recipient`, `message`
- **Default sort:** `scheduledAt` asc

### automation

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `name` | required | optional | string, 1–200 chars |
| `trigger` | required | optional | string, 1–200 chars |
| `action` | required | optional | string, 1–200 chars |
| `config` | optional | optional | string, ≤20000 chars, nullable (typically JSON-encoded) |
| `active` | default `true` | optional | boolean |

- **Filterable:** `active`, `trigger`
- **Sortable:** `createdAt`, `updatedAt`, `name`
- **Searchable:** `name`, `trigger`, `action`
- **Default sort:** `createdAt` desc

### suggestions

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `title` | required | optional | string, 1–500 chars |
| `content` | required | optional | string, ≤20000 chars |
| `category` | default `"general"` | optional | string, ≤100 chars |
| `status` | default `"pending"` | optional | enum: `pending`, `accepted`, `rejected` |

- **Filterable:** `category`, `status`
- **Sortable:** `createdAt`, `updatedAt`
- **Searchable:** `title`, `content`
- **Default sort:** `createdAt` desc

### integrations

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `service` | required | (immutable) | enum: `google_calendar`, `google_drive`, `telegram`, `email`, `github`, `google_contacts`, `cloud_sync` |
| `name` | required | optional | string, 1–200 chars |
| `connected` | default `false` | optional | boolean |
| `config` | optional | optional | string, ≤20000 chars, nullable (typically JSON-encoded OAuth tokens — do NOT log) |
| `lastSync` | (server-managed) | optional | ISO datetime, nullable |

- **Filterable:** `service`, `connected`
- **Sortable:** `createdAt`, `updatedAt`, `service`
- **Searchable:** `name`, `service`
- **Default sort:** `createdAt` asc

### happiness

| Field | Create | Update | Type / Constraints |
|-------|--------|--------|--------------------|
| `date` | required | optional | ISO datetime |
| `score` | required | optional | integer 1–10 |
| `factors` | optional | optional | string, ≤20000 chars, nullable (typically JSON-encoded) |
| `note` | optional | optional | string, ≤5000 chars, nullable |

- **Filterable:** (none)
- **Sortable:** `date`, `createdAt`
- **Searchable:** `note`
- **Default sort:** `date` desc

---

## Appendix A — Example End-to-End Native Session

```bash
# 1. Sign in with Google on the device, obtain idToken (client-side SDK).

# 2. Exchange for Silah tokens.
curl -X POST https://personal-dashboard-mu-lyart.vercel.app/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "<google-id-token>",
    "deviceId": "pixel-8-unique-id",
    "deviceName": "Pixel 8",
    "platform": "android",
    "appVersion": "1.0.0"
  }'
# → { "success": true, "data": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900, ... } }

# 3. Use the access token on subsequent calls.
curl https://personal-dashboard-mu-lyart.vercel.app/api/v1/tasks?status=doing \
  -H "Authorization: Bearer <accessToken>"
# → { "success": true, "data": [...], "pagination": {...} }

# 4. Create a task.
curl -X POST https://personal-dashboard-mu-lyart.vercel.app/api/v1/tasks \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Buy milk", "priority": "high" }'
# → { "success": true, "data": { "id": "abc123", "version": 1, ... } }

# 5. Update it with optimistic concurrency.
curl -X PATCH https://personal-dashboard-mu-lyart.vercel.app/api/v1/tasks/abc123 \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Buy oat milk", "baseVersion": 1 }'
# → { "success": true, "data": { "id": "abc123", "version": 2, ... } }

# 6. Pull sync deltas.
curl "https://personal-dashboard-mu-lyart.vercel.app/api/v1/sync/pull?cursor=0&pageSize=500" \
  -H "Authorization: Bearer <accessToken>"
# → { "success": true, "data": { "events": [...], "nextCursor": "5", "hasMore": false, ... } }

# 7. When the access token expires (HTTP 401 TOKEN_EXPIRED), refresh.
curl -X POST https://personal-dashboard-mu-lyart.vercel.app/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<refreshToken>" }'
# → { "success": true, "data": { "accessToken": "<new-token>", "expiresIn": 900 } }

# 8. Logout.
curl -X POST https://personal-dashboard-mu-lyart.vercel.app/api/v1/auth/logout \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{ "allDevices": true }'
# → { "success": true, "data": { "revoked": "all-devices" } }
```

---

## Appendix B — Change Log

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2025-01-15 | Initial v1 release: auth, sync, 24 CRUD domains, devices, health. |
