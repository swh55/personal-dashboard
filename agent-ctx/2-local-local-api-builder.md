# Task ID 2-local — local-api-builder

## Deliverables
- `src/lib/local/db.ts` — localStorage-backed DB singleton mirroring the Prisma client surface used by the API routes.
- `src/lib/local/fetch-interceptor.ts` — `installFetchInterceptor()` + `localApiHandler()` that routes every `/api/*` request to in-memory handlers backed by `db`.

## Key decisions

### DB module (`db.ts`)
- All data persisted as one JSON blob under `localStorage["dashboard-db"]` (single read/write per call — simpler than per-collection keys and easy to back up / restore as a unit).
- `initDB()` is idempotent: it seeds from `SEED_DATA` only when the key is missing, and it also back-fills any missing collections if new ones were added in a later seed. This means a future agent can extend `SEED_DATA` and existing users won't lose their data.
- `genId()` = `Date.now().toString(36) + Math.random().toString(36).slice(2,10)` — short, sortable, collision-resistant enough for a single-user offline app.
- `insert` auto-fills `id`, `createdAt`, `updatedAt`. `update` always bumps `updatedAt`. `softDelete` sets `deletedAt` via `update`. This matches what Prisma does on `.create` / `.update`.
- Exported as a flat object `db` plus individual named exports, so callers can import either `import { db }` or `import { getCollection, insert, ... }`.

### Interceptor (`fetch-interceptor.ts`)
- **Activation gate**: `shouldIntercept()` returns `true` only when `window.capacitor?.isNative === true` OR `localStorage["force-local-mode"] === "true"`. This means in a normal browser the app keeps hitting the real Next.js API routes; the interceptor stays dormant. Useful for testing the offline path in dev without rebuilding.
- **Transparency**: the wrapper function preserves the exact `fetch(input, init)` signature and only diverts URLs whose pathname starts with `/api/`. Everything else (assets, RSC, fonts, etc.) falls through to the original fetch. The rest of the app has no idea it's running locally.
- **Routing**: a flat `ROUTES` array of `{ path, handler }` pairs, looked up by exact pathname match. 37 entries covering every API route the app currently uses. If no route matches, returns 404 — same as Next.js would.
- **Request parsing**: `parseRequest()` handles `Request` objects (reads `url`, `method`, and `body.json()` if `init` wasn't passed), `URL` objects, and plain strings. Body parsing supports string JSON, `FormData`, and `Blob`. All bodies are normalised to a plain JS object before reaching the handler.
- **Response shape**: every handler returns a `Response` built via the `ok(data, extra, status)` / `fail(error, status)` helpers, which wrap the body as `{ success, ... }` JSON with `Content-Type: application/json`. Matches `NextResponse.json(...)` byte-for-byte for the routes I read.
- **Endpoint parity**: I read every route file in `src/app/api/*/route.ts` and replicated the exact response shape, query params, validation rules, status codes, and Arabic activity-log messages. Notable bits:
  - contacts GET enriches each row with `_count.calls` (mirrors Prisma `include`).
  - tasks GET joins `project` and returns `stats: { total, todo, doing, done, high, overdue }`.
  - expenses GET returns `stats.byCategory` with per-category `{ syp, usd, count }`.
  - dashboard GET uses `getUpcomingHolidays`/`isHoliday` from `@/lib/holidays`.
  - finances GET uses `USD_TO_SYP = 12500` (from `@/lib/constants`) for the SYP conversion.
  - quran GET includes the full 114-element `surahNames` array (copied verbatim from the real route).
  - habits GET computes `todayDone`, `todayValue`, `streak`, `last7Days` per habit using the same `computeStreak` algorithm (handles "today missing, start from yesterday").
  - contact-reminders GET computes `overdue` and `daysUntilDue` per row.
  - recycle-bin groups by the 10 soft-deletable types and supports restore (`PUT { type, id }`) and permanent delete (`DELETE ?type&id`).
  - smart-notifications aggregates events, overdue/soon tasks, due debts, due reminders, low-stock pantry, upcoming occasions, and holidays — producing the same `notifications[]` + `stats{total,critical,warning,info}` shape.
- **Specials**:
  - `/api/weather` returns a static sunny-day mock for حلب (the real route calls open-meteo, which won't work offline).
  - `/api/ai/chat` returns a canned Arabic message explaining that the local mode can't reach the LLM.
  - `/api/ai-insights` is implemented with a simplified subset of the real algorithm (spending patterns by category with budget %, overdue + high-priority task suggestions, basic budget-exceeded + overdue predictive alerts). Enough to populate the UI without re-implementing all four sub-analyses verbatim.
  - `/api/sync/contacts|calendar|drive` all return `{ success: false, error: "المزامنة تتطلب اتصالاً بالإنترنت" }` with status 401, matching the "not connected" path of the real routes.
- **Activity logging**: every create/update/delete calls `db.logActivity(action, entity, message)` with the same Arabic strings the real routes use, so the activity feed looks identical to the online version.

## How the main agent wires it up
Just call `installFetchInterceptor()` once at app startup. Recommended spot is in the existing `useAppSettings` hook or a top-level `<Providers>` component, inside a `useEffect`:

```ts
useEffect(() => {
  if (typeof window !== "undefined") {
    import("@/lib/local/fetch-interceptor").then(({ installFetchInterceptor }) => {
      installFetchInterceptor();
    });
  }
}, []);
```

The dynamic import keeps the interceptor (and the seed data) out of the server bundle — important because it touches `window` and `localStorage`.

To test offline mode in the browser without rebuilding for APK: open devtools console and run `localStorage.setItem("force-local-mode", "true")`, then refresh. To go back online: `localStorage.removeItem("force-local-mode")` and refresh.

## Lint / build status
- `bun run lint` → clean (exit 0).
- `bunx tsc --noEmit` → zero errors in `src/lib/local/db.ts` and `src/lib/local/fetch-interceptor.ts`. (Pre-existing errors remain in `examples/websocket/*.tsx` and `prisma/seed.ts`, unrelated to this task.)
- Dev server log shows no new errors after my files were added — the interceptor stays dormant in browser mode (no `force-local-mode` flag), so all existing API requests continue to hit the real Next.js routes.

## Out-of-scope notes for the main agent
- The interceptor is **not yet activated** anywhere in the app. The main agent must call `installFetchInterceptor()` at startup for the APK build to actually go offline.
- `src/lib/db.ts` (the Prisma client) is unchanged — it's still used by the real API routes when running on a server. The interceptor bypasses it entirely when active.
- I did not modify `prisma/schema.prisma` or any existing API route file. The interceptor is purely additive.
- I did not generate any images.
