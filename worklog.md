# Silah Cloud Platform — Worklog

---
Task ID: 1-4
Agent: Main Orchestrator
Task: Environment setup, repo clone, branch creation

Work Log:
- Cloned https://github.com/swh55/personal-dashboard into /home/z/my-project
- Configured git user: swh55 <softwarehouse55@gmail.com>
- Created branch feature/api-platform
- Installed dependencies (917 packages)
- Generated Prisma client to validate schema

Stage Summary:
- Project is Next.js 16 + React 19 + Prisma 6 + NextAuth v4 (JWT) + PostgreSQL/Neon
- 32 existing Prisma models, all user-scoped
- 45 existing API routes under /api/* (unversioned)
- No zod validation in existing routes; mass-assignment vulnerability in PUT handlers
- No /api/v1, no real sync (only full-pull + client localStorage queue)

---
Task ID: 3
Agent: Explore (Codebase Audit)
Task: Full codebase audit — framework, auth, prisma, API routes, entities, security

Work Log:
- Read package.json, prisma/schema.prisma, src/lib/auth.ts, src/lib/auth-helpers.ts, src/lib/db.ts
- Enumerated all 45 files under src/app/api/
- Mapped every route's methods, auth, ownership, validation status
- Identified security concerns (mass-assignment, no validation, no rate limiting)

Stage Summary:
- Complete audit report appended to worklog (see full report in conversation)
- Key finding: all routes derive userId from JWT (good), but spread `...data` in PUT (mass-assignment vulnerability)
- zod installed but unused; no middleware; SyncQueue model is dead schema
- 24 sync-enabled entity domains identified

---
Task ID: 5
Agent: Main Orchestrator
Task: Prisma schema updates for sync + new platform models

Work Log:
- Added `version Int @default(1)` to all 24 mutable user-scoped models
- Added `deletedAt DateTime?` to 13 models that were missing it
- Added `@@index([userId, updatedAt])` to all sync-enabled models for delta queries
- Added User relations: devices, apiTokens, syncEvents
- Created Device model (id, userId, platform, appVersion, deviceId, lastSeenAt, revokedAt)
- Created ApiToken model (tokenHash, kind, scopes, expiresAt, revokedAt, deviceId)
- Created SyncEvent model (seq BigInt, entity, entityId, operation, payload, operationId)
- Generated Prisma client successfully — schema validated

Stage Summary:
- Schema is backward-compatible (all new fields have defaults)
- 3 new models: Device, ApiToken, SyncEvent
- 24 entities now have version + deletedAt + updatedAt index for delta sync
- Monotonic per-user seq via @@unique([userId, seq]) + atomic nextSeq() in transactions

---
Task ID: 6
Agent: Main Orchestrator
Task: v1 API infrastructure (response, validation, pagination, auth, tokens, sync, crud factory)

Work Log:
- Created src/lib/api/response.ts — unified { success, data } / { success, error } contract + 13 error codes
- Created src/lib/api/pagination.ts — page/pageSize, filters, date range, search, sort, includeDeleted
- Created src/lib/api/validation.ts — zod parseBody with strict() + formatted error details
- Created src/lib/api/tokens.ts — HS256 JWT (no deps) + opaque refresh tokens (SHA-256 hashed)
- Created src/lib/api/auth-v1.ts — dual auth: bearer token (native) OR cookie session (web)
- Created src/lib/api/sync.ts — recordSyncEvent() + nextSeq() + SYNC_ENTITIES registry
- Created src/lib/api/crud.ts — generic CRUD factory with ownership, version, conflict, sync, activity

Stage Summary:
- All infrastructure is server-side only; no secrets in client bundle
- Access token: stateless JWT (15 min), verified by signature + device-revoked DB check
- Refresh token: opaque, hash-stored (30 day), revocable via device cascade
- CRUD factory centralises: auth, zod strict validation, ownership, pagination, soft-delete, version bump, conflict detection (409), SyncEvent recording, activity logging

---
Task ID: 7
Agent: Main Orchestrator
Task: Native auth API endpoints

Work Log:
- POST /api/v1/auth/token — Google ID token → Silah access+refresh tokens (verifies via Google tokeninfo, upserts User, registers Device)
- POST /api/v1/auth/refresh — refresh token → new access token (hash lookup, revocation check, expiry check)
- POST /api/v1/auth/logout — revoke refresh token / device / all devices
- GET /api/v1/auth/me — current user profile (works with both auth methods)

Stage Summary:
- Full OAuth token-exchange flow for native clients
- Idempotent device registration (upsert by userId+deviceId)
- Never returns secrets; tokens issued once at creation

---
Task ID: 8
Agent: Main Orchestrator
Task: Sync API endpoints

Work Log:
- GET /api/v1/sync/pull — delta pull since cursor (BigInt seq), optional collections filter, pageSize+1 hasMore detection
- POST /api/v1/sync/push — batch push (max 100 changes), per-change transaction, idempotent via operationId, conflict detection via baseVersion
- GET /api/v1/sync/status — latestSeq, eventCount, perEntity breakdown, device info

Stage Summary:
- Delta sync via monotonic per-user seq (BigInt, @@unique constraint)
- Idempotency: replaying same operationId returns original result
- Conflict detection: baseVersion mismatch → 409 with currentVersion + strategy hint
- Soft-delete aware: deletes emit { id, deletedAt } payload

---
Task ID: 9 (partial)
Agent: Main Orchestrator
Task: CRUD factory + 24 domain entity configs + 48 route files

Work Log:
- Created src/lib/api/entities.ts — 24 entity configs with strict zod schemas (create + update)
- Generated 48 route files (24 collection + 24 item) via script
- Each route file is 2-3 lines: imports config, exports handlers from factory
- Lint passed clean

Stage Summary:
- All 24 sync-enabled entities have full CRUD: GET (list+pagination+filter+sort+search), POST (create), GET/:id, PATCH/:id (with version conflict), DELETE/:id (soft+force)
- Mass-assignment protection via zod .strict() on every schema
- Ownership enforced via session-derived userId, never client-supplied

---
Task ID: 11
Agent: Technical Writer
Task: API documentation — API.md, openapi.json, NATIVE_CLIENT_GUIDE.md

Work Log:
- Read existing worklog (Tasks 1-9) to understand context and what previous agents built
- Read all v1 API source files to extract the exact contract:
  - src/lib/api/response.ts — 13 error codes, {success,data}/{success,error} envelope
  - src/lib/api/pagination.ts — page/pageSize bounds, filter/sort/search/date-range helpers
  - src/lib/api/auth-v1.ts — dual cookie+bearer auth, ownership assertions
  - src/lib/api/tokens.ts — HS256 JWT (15 min), opaque refresh (30 day), TTLs and signing
  - src/lib/api/sync.ts — SyncEvent recording, nextSeq(), 24-entity SYNC_ENTITIES registry
  - src/lib/api/entities.ts — all 24 zod schemas (create+update) + filterable/sortable/searchable fields per entity
  - src/lib/api/crud.ts — generic CRUD factory: ownership, soft-delete, version conflict, sync recording
  - src/app/api/v1/auth/token/route.ts — Google ID token exchange flow
  - src/app/api/v1/auth/refresh/route.ts — refresh token rotation logic
  - src/app/api/v1/auth/logout/route.ts — revocation semantics (token/device/all-devices)
  - src/app/api/v1/auth/me/route.ts — current user profile
  - src/app/api/v1/sync/pull/route.ts — delta pull with cursor + hasMore detection
  - src/app/api/v1/sync/push/route.ts — batch push with operationId idempotency + conflict detection
  - src/app/api/v1/sync/status/route.ts — sync metadata + perEntity breakdown
  - src/app/api/v1/health/route.ts — DB probe + status/degraded
  - src/app/api/v1/route.ts — discovery endpoint
  - src/app/api/v1/devices/route.ts + [id]/route.ts — device listing/registration/revocation
- Created /home/z/my-project/docs/ directory (did not exist)
- Wrote docs/API.md (1786 lines, 62KB) — comprehensive human-readable API documentation:
  - Overview & architecture (web + native clients, design principles)
  - Base URLs (production Vercel + local dev)
  - Authentication: web cookie session + native Google ID token exchange with ASCII sequence diagram
  - Token TTLs (15 min access / 30 day refresh), JWT claims, revocation model
  - Response contract (success/error envelopes, pagination meta)
  - All 13 error codes with HTTP status mapping
  - HTTP status codes table
  - Pagination (page/pageSize, max 100, default 50, response shape)
  - Filtering (whitelisted per entity, dateFrom/dateTo, booleans)
  - Sorting (sort=field / sort=-field, whitelist enforcement)
  - Searching (case-insensitive contains across searchable fields)
  - Soft delete + hard delete (?force=true, ?includeDeleted=true)
  - Optimistic concurrency (baseVersion, 409 conflict response with strategy hint)
  - Sync architecture (SyncEvent table, pull/push protocol, idempotency, conflict detection, soft-delete propagation, sync status, recommended sync loop)
  - Rate limits (in-memory per-instance, soft limits per endpoint)
  - Versioning strategy (v1 stability guarantees, forward/backward compat, v2 plan)
  - All endpoints documented with method/path/auth/query params/request body/response shape/example:
    - GET / (discovery) and GET /health
    - POST /auth/token, POST /auth/refresh, POST /auth/logout, GET /auth/me
    - GET/POST /devices, GET/DELETE /devices/:id
    - GET /sync/pull, POST /sync/push, GET /sync/status
    - Common CRUD behavior for all 24 entities (5 endpoints each = 120 endpoints)
  - Per-entity schema reference (all 24 entities with create/update field tables, filterable/sortable/searchable/default sort)
  - Appendix A: full end-to-end native session example with curl
  - Appendix B: change log
- Wrote docs/openapi.json (2467 lines, 189KB, valid JSON) — OpenAPI 3.1 spec:
  - Info block (title "Silah Cloud Platform API", version "1.0.0")
  - 2 server URLs (production + local)
  - 29 tags (Discovery, Health, Auth, Devices, Sync, + 24 entity tags + Occurrences)
  - 2 security schemes (bearerAuth JWT, cookieAuth NextAuth)
  - 59 paths covering all 140+ endpoints (24 collections + 24 items + 4 auth + 2 devices + 3 sync + 2 root)
  - 120 reusable operations under components/operations (24 entities × 5 operations)
  - 89 schemas (envelopes, pagination meta, error, device, sync event/result, + all 24 entity create/update/record schemas)
  - 9 reusable parameters (Page, PageSize, Sort, Search, DateFrom, DateTo, IncludeDeleted, Force, PathId)
  - 9 reusable responses (Unauthorized, NotFound, Conflict, ValidationError, BadRequest, InternalError, RateLimited)
  - Validated JSON parses cleanly: 59 paths, 29 tags, 89 schemas, 120 operations
- Wrote docs/NATIVE_CLIENT_GUIDE.md (1597 lines, 57KB) — focused native client guide:
  - Architecture overview (UI/Local Repository/HTTP Client layers with ASCII diagram)
  - Authentication flow step-by-step (Google Sign-In → POST /auth/token → store tokens → use bearer)
  - Token refresh logic (intercept 401 TOKEN_EXPIRED → single-flight refresh → retry, terminal cases)
  - Making authenticated API calls (header format, common patterns, error branching)
  - Sync loop pseudocode (pull → apply → push → schedule, outbox design, client-side IDs, cursor persistence)
  - Conflict resolution strategies (server wins, client wins, field-level merge, manual merge) with per-entity recommendations
  - Offline-first architecture (SQLite schema, read/write patterns, background sync service, large initial sync)
  - Security best practices (token storage per platform, Google client ID, cert pinning, log redaction, biometric re-auth, device revocation UX)
  - Full Kotlin (Android) code snippets: SilahAuth with EncryptedSharedPreferences, SilahHttpClient with auto-refresh, SyncEngine with pull/push
  - Full C# (.NET/Windows) code snippets: SilahAuth with PasswordVault, SilahApiClient with auto-refresh, SyncEngine
  - Testing & debugging guide (local server, test tokens, sync status inspection, common pitfalls table)
  - Pre-shipping checklist (auth, HTTP client, local DB, sync engine, UX, security, API compliance)
- Did NOT modify any source code — only created the 3 documentation files in docs/

Stage Summary:
- Three documentation files delivered as the authoritative v1 API contract:
  - docs/API.md — human-readable, comprehensive, the contract native client devs rely on
  - docs/openapi.json — machine-readable OpenAPI 3.1, importable into Postman/Swagger/etc.
  - docs/NATIVE_CLIENT_GUIDE.md — focused integration guide with working Kotlin + C# code
- All 24 entity schemas documented at field level (create/update field tables with type/constraints)
- All 13 error codes documented with HTTP status, meaning, and when they occur
- Sync protocol fully documented: cursor-based delta sync, idempotency via operationId, conflict detection via baseVersion, soft-delete propagation
- Native client flow documented end-to-end: Google Sign-In → token exchange → bearer auth → 401 refresh → sync loop
- JSON spec validated as syntactically correct and structurally complete (59 paths, 120 operations, 89 schemas)
- No source code changes — documentation-only task, ready for native client teams to consume

---
Task ID: 12
Agent: QA Engineer
Task: Write API tests for the v1 API platform

Work Log:
- Read existing worklog (Tasks 1-11) to understand the v1 API infrastructure built by previous agents
- Read all v1 API source files to extract the exact contract:
  - src/lib/api/response.ts — 13 error codes, {success,data}/{success,error} envelope
  - src/lib/api/tokens.ts — HS256 JWT sign/verify, opaque refresh token generation, SHA-256 hashing
  - src/lib/api/auth-v1.ts — dual cookie+bearer auth resolution, device revocation check
  - src/lib/api/validation.ts — zod parseBody with strict() mode, formatted error details
  - src/lib/api/pagination.ts — page/pageSize clamping, filters, date range, search, sort, includeDeleted
  - src/lib/api/sync.ts — SYNC_ENTITIES registry (24 entries), getSyncEntity, getDelegate, recordSyncEvent, serializeForSync
  - src/lib/api/crud.ts — generic CRUD factory: create, read, update (with version conflict), delete (soft+force), list
  - src/lib/api/entities.ts — all 24 entity zod schemas (create+update) with .strict() mass-assignment protection
  - src/app/api/v1/auth/token/route.ts, sync/pull/route.ts, sync/push/route.ts, health/route.ts
- Read existing test infrastructure:
  - vitest.config.ts — jsdom environment, globals: true, setupFiles: ./src/__tests__/setup.ts
  - src/__tests__/setup.ts — mocks localStorage + matchMedia for jsdom
  - 8 existing test files in src/__tests__/ (crud, multi-tenant, pomodoro, settings, local-db, navigation, platform, sync-queue)
  - package.json test script: `vitest run`
- Updated vitest.config.ts to include `tests/v1/**/*.test.ts` in the test glob
- Created tests/v1/ directory with 8 test files (610 new test cases):

1. **tests/v1/response.test.ts** (24 tests):
   - apiSuccess returns 200 with { success: true, data } + custom status + extra keys
   - apiCreated returns 201 + extra keys
   - apiNoContent returns 204 with empty body
   - apiList returns 200 with pagination meta
   - apiError returns correct shape/status + details inclusion
   - All 10 convenience wrappers (apiBadRequest→400, apiValidationError→422, apiUnauthorized→401, apiForbidden→403, apiNotFound→404, apiConflict→409, apiRateLimited→429, apiMethodNotAllowed→405, apiInternalError→500) with correct error codes
   - ErrorCode registry: 13 codes, all non-empty strings, all unique

2. **tests/v1/tokens.test.ts** (31 tests):
   - issueAccessToken produces a valid 3-part JWT with base64url header
   - Returns null when AUTH_SECRET is missing or too short (<16 chars)
   - verifyAccessToken returns payload for valid token with correct claims (sub, deviceId, kind, iss, aud, iat, exp)
   - exp = iat + 900s (15 min TTL)
   - Returns null for: tampered payload, tampered signature (first char change), expired token (fake timers), wrong-secret token, malformed token (wrong part count), garbage string, wrong iss, wrong aud, wrong kind
   - generateRefreshToken produces unique base64url-safe tokens across 100 calls
   - hashToken is deterministic, produces 64-char SHA-256 hex, matches crypto.createHash output
   - TTL accessors: accessTokenTtlSeconds=900, refreshTokenTtlSeconds=30days, refreshTokenTtlDays=30
   - generateDeviceId produces valid UUIDs, unique across 50 calls

3. **tests/v1/pagination.test.ts** (44 tests):
   - parsePagination: defaults (page=1, pageSize=50), valid params, clamps page=0→1, page=-5→1, pageSize=0→default, pageSize=999→100 (MAX), non-numeric→default, skip/take computation
   - buildPaginationMeta: correct totalPages (ceil), handles total=0, exact division, partial last page
   - parseFilters: only whitelisted keys returned, empty values omitted, non-whitelisted keys (userId, createdAt) dropped, empty whitelist
   - parseDateRange: valid dateFrom+dateTo, only dateFrom, only dateTo, neither→undefined, invalid dates ignored, both invalid→undefined, custom key names
   - parseSearch: trimmed string, whitespace-only→undefined, empty→undefined, absent→undefined, multi-word intact
   - parseSort: -field→desc, %2Bfield→asc (URL-encoded +), bare field→asc, unknown field→default, no sort→default, custom default, -unknownField→default
   - parseIncludeDeleted: true only for "true", false for "false"/absent/"1"/"yes"/empty

4. **tests/v1/validation.test.ts** (26 tests):
   - parseBody returns { ok: true, data } for valid body, applies zod defaults, accepts nullable optional
   - Returns 422 for malformed JSON, empty body
   - Returns 422 for missing required field (title), empty title, invalid enum value
   - Strict mode (mass-assignment): rejects userId, id, createdAt, updatedAt, version, deletedAt, multiple unknown fields, arbitrary unknown field — all return 422 with VALIDATION_ERROR code + non-empty details
   - schemas primitives: float (rejects NaN/Infinity), positiveFloat (rejects 0/negative), nonNegativeInt, isoDate (accepts offset), version (accepts ≥1 or undefined, rejects 0/negative/non-int)

5. **tests/v1/sync-registry.test.ts** (22 tests):
   - SYNC_ENTITIES has exactly 24 entries, every entry has delegate+plural+softDelete
   - All softDelete=true, all plural names unique, all delegate names unique
   - Includes all 24 expected plural names (contacts, notes, events, tasks, expenses, budgets, assets, accounts, debts, projects, meetings, occasions, diary, habits, medications, pantry, waiting-list, locations, reminders, happiness, scheduled-messages, automation, suggestions, integrations)
   - getSyncEntity: returns config for "tasks"/"contacts"/"waiting-list"/"scheduled-messages"/"happiness", returns undefined for unknown/empty/singular/wrong-case
   - getDelegate: returns delegate for "task" + all 24 delegate names, returns undefined for unknown model
   - serializeForSync: empty obj for null/non-object, passes primitives, converts Date→ISO string, converts bigint→string, handles mixed fields, shallow-copies nested objects

6. **tests/v1/entity-schemas.test.ts** (405 tests):
   - Registry completeness: 24 entities covered
   - Per-entity (×24, via describe.each): valid create payload passes, rejects userId/id/createdAt/updatedAt/version/deletedAt in create (mass-assignment), rejects multiple server-managed fields, rejects arbitrary unknown field, update accepts empty payload + baseVersion=1 + baseVersion=42, rejects baseVersion=0/-1, rejects unknown field in update
   - In-depth field validation:
     - task: empty title rejected, title>500 rejected, status enum (todo/doing/done), priority enum (low/medium/high), defaults applied
     - expense: accepts positive/zero/negative, rejects NaN/Infinity/string, currency enum (syp/usd)
     - happiness: score 1-10 accepted, 0/11 rejected, non-integer rejected, missing date/score rejected
     - budget: positive limit required, month 1-12, year 2000-2100
     - contact: email validation, relation enum
     - integration: 7 valid service names, invalid service rejected
     - pantry: non-negative integer quantity, 6 valid units
     - project: progress 0-100, non-integer rejected

7. **tests/v1/auth-v1.test.ts** (20 tests):
   - Bearer token valid JWT → principal with authMethod="bearer", userId, deviceId, email=""
   - Bearer with invalid/tampered token → 401 TOKEN_EXPIRED (device lookup NOT called)
   - Bearer with tampered signature (first char change) → 401 TOKEN_EXPIRED
   - Bearer with revoked device → 401 DEVICE_REVOKED
   - Bearer with non-existent device → 401 DEVICE_REVOKED
   - Bearer with device.userId != token.sub → 401 UNAUTHORIZED
   - Bearer without deviceId in token → skips device check, succeeds
   - Case-insensitive "bearer" prefix
   - Bearer with invalid token content → 401 TOKEN_EXPIRED
   - Cookie session valid → principal with authMethod="cookie", userId, email
   - getCurrentUser returns null → 401 UNAUTHORIZED
   - No auth header + no session → 401 UNAUTHORIZED
   - Non-Bearer Authorization header → falls back to cookie session
   - Device lookup throws → 500 INTERNAL_ERROR
   - getCurrentUser throws → 500 INTERNAL_ERROR
   - assertOwnership: null when owned, 404 when different user/null/undefined, 404 (not 403) to avoid leaking existence

8. **tests/v1/crud-factory.test.ts** (38 tests):
   - GET (list): 401 when unauthenticated, paginated list with correct pagination meta, excludes soft-deleted by default (deletedAt: null in where), includes soft-deleted when includeDeleted=true, applies pagination (skip+take), clamps pageSize to 100, applies whitelisted filters, does NOT apply non-whitelisted filters (userId/createdAt — mass-assignment protection), applies sort field+direction, 500 on error
   - POST (create): 401 when unauthenticated, creates with userId+version:1 returns 201, records SyncEvent inside transaction, 422 for missing required field, 422 for unknown field (strict), 409 CONFLICT on P2002 unique constraint, 500 on unexpected error, logs activity after create
   - PATCH (update): 401 when unauthenticated, updates + bumps version (increment:1) + records SyncEvent, 409 CONFLICT with currentVersion when baseVersion mismatch, skips version check when baseVersion absent (last-write-wins), 404 when not found, 404 when wrong userId, 404 when soft-deleted, 422 for invalid body, strips userId+id from update data
   - DELETE: 401 when unauthenticated, soft-delete by default (sets deletedAt + increments version, does NOT call hard delete), hard-delete when force=true (calls delete, does NOT call update), 404 when not found, 404 when wrong userId, logs activity after delete
   - GET (single item): 401 when unauthenticated, returns record when owned, 404 when wrong userId, 404 when soft-deleted (default), returns soft-deleted when includeDeleted=true

Mocking strategy:
- vi.mock("@/lib/db") with Proxy or explicit mock delegates — no live Prisma connection
- vi.mock("@/lib/auth-helpers") getCurrentUser for cookie session path
- vi.mock("@/lib/api/auth-v1") requirePrincipal for CRUD factory isolation
- vi.mock("@/lib/activity") logActivity returning resolved Promise
- vi.hoisted() for shared mock state referenced by vi.mock factories
- process.env.AUTH_SECRET set in beforeEach for JWT signing/verification
- vi.useFakeTimers() for expired-token test
- Real NextRequest from next/server for HTTP request construction

Issues found and fixed during test development (test-only, no source changes):
- zod v4 strict mode reports unrecognized keys with empty path (→ "_root" in formatZodError), not per-field paths — tests adjusted to check details is non-empty rather than checking specific field keys
- URL "+" in query string is decoded as space by URLSearchParams — test uses %2B encoding for sort=+field
- HTTP header trailing whitespace is stripped by NextRequest — test adjusted to use "Bearer not-a-real-jwt" instead of "Bearer "
- Base64url last-character tampering may not change decoded bytes (lower 2 bits unused) — test changed to tamper first character (all 6 bits significant)
- vi.mock factories are hoisted above variable declarations — used vi.hoisted() to define shared mock state
- logActivity mock must return a Promise (CRUD factory calls .catch() on the return value) — mockResolvedValue(undefined) in beforeEach

Final test run result:
- Test Files: 16 passed (16)
- Tests: 648 passed (648)
- Duration: ~14s
- Breakdown: 610 new tests in tests/v1/ (8 files) + 38 existing tests in src/__tests__/ (8 files)

Stage Summary:
- 8 test files created in tests/v1/ covering all v1 API pure-logic modules
- 610 new test cases, all passing
- Tests are self-contained unit tests — no live database, no Next.js server, no network calls
- Prisma is fully mocked via vi.mock; auth helpers are mocked where needed
- Mass-assignment protection verified for all 24 entities (userId, id, createdAt, updatedAt, version, deletedAt all rejected by .strict())
- JWT lifecycle fully tested: issue, verify (valid + 8 invalid scenarios), refresh token uniqueness, SHA-256 hashing
- CRUD factory tested end-to-end with mocked Prisma transactions: create, read, update (with optimistic concurrency), delete (soft + force), list (with pagination/filter/sort)
- Dual auth resolution tested: bearer token (valid/invalid/revoked/mismatched), cookie session, no auth, error handling
- No source code was modified — all fixes were in test files only
