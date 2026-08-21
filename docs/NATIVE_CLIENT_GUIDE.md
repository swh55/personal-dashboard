# Native Client Integration Guide

> **Audience:** Developers building Android, Windows, and iOS clients for the Silah Cloud Platform.
> **Companion docs:** [`API.md`](./API.md) (full API contract) · [`openapi.json`](./openapi.json) (machine-readable spec)
> **API version:** v1
> **Base URL (production):** `https://personal-dashboard-mu-lyart.vercel.app/api/v1`

This guide walks you through everything you need to ship a native client that
authenticates, calls the REST API, and stays synchronised across multiple
devices. The platform is **offline-first by design** — your client is expected
to maintain a full local copy of the user's data in SQLite (or equivalent) and
use the sync protocol to stay current.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication Flow](#2-authentication-flow)
3. [Token Refresh Logic](#3-token-refresh-logic)
4. [Making Authenticated API Calls](#4-making-authenticated-api-calls)
5. [Sync Loop](#5-sync-loop)
6. [Conflict Resolution Strategies](#6-conflict-resolution-strategies)
7. [Offline-First Architecture](#7-offline-first-architecture)
8. [Security Best Practices](#8-security-best-practices)
9. [Code Snippets](#9-code-snippets)
    - [Kotlin (Android)](#kotlin-android)
    - [C# (Windows / .NET)](#c-windows--net)
10. [Testing & Debugging](#10-testing--debugging)
11. [Checklist for Shipping](#11-checklist-for-shipping)

---

## 1. Architecture Overview

A Silah native client has three logical layers:

```
┌──────────────────────────────────────────────────────────────────┐
│                       UI Layer (Compose / WinUI / SwiftUI)       │
└────────────────────────────┬─────────────────────────────────────┘
                             │ reads / writes
┌────────────────────────────▼─────────────────────────────────────┐
│              Local Repository (offline-first)                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  SQLite (full local copy of user's data + sync cursor)     │  │
│  │  Outbox queue (pending pushes with operationId)            │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────┬───────────────────┘
               │ reads                         │ writes (queued)
               ▼                               ▼
┌──────────────────────────┐         ┌─────────────────────────────┐
│  Sync Engine             │         │  HTTP Client                │
│  - pull → apply to local │◄────────┤  - Bearer auth              │
│  - drain outbox → push   │────────►│  - 401 → refresh → retry    │
│  - schedule next pull    │         │  - exponential backoff      │
└──────────────────────────┘         └─────────────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────────┐
                              │  Silah Cloud Platform API v1      │
                              │  https://personal-dashboard-...   │
                              └───────────────────────────────────┘
```

The single most important principle: **the UI never talks to the network
directly**. Every read goes to the local SQLite cache; every write goes to
the local cache first and is queued in an outbox for async push. This gives
you instant UI, works offline, and lets sync run in the background.

---

## 2. Authentication Flow

Silah uses **Google Sign-In** as its identity provider. Native clients never
see a password — they obtain a Google ID token from the platform SDK and
exchange it for Silah-issued tokens.

### Step-by-Step

1. **Configure Google Sign-In in your app.**
   - Use the same Google OAuth client ID that the Silah server is configured
     with (`GOOGLE_CLIENT_ID` env var on the server). For Android, this is
     typically `<package>.apps.googleusercontent.com`; for iOS, the reversed
     client ID; for Windows, a Web client ID.
   - If you don't know the Silah `GOOGLE_CLIENT_ID`, ask the server admin.
     The audience check on the server will reject ID tokens minted for a
     different app.

2. **Trigger Google Sign-In.**
   - One-tap sign-in is recommended for returning users.
   - On first launch, show a "Sign in with Google" button.

3. **Obtain the Google ID token.**
   - Android: `GetSignInTokenRequest` / `CredentialProvider`.
   - iOS: `GIDSignIn.sharedInstance.signIn()` → `user.idToken?.tokenString`.
   - Windows: MSAL `AcquireTokenInteractive` with the Google scope, or use
     a WebView flow against Google's OAuth endpoint.

4. **Generate a stable `deviceId`.**
   - Android: `Settings.Secure.ANDROID_ID` (or a UUID persisted in
     `EncryptedSharedPreferences`).
   - iOS: `UIDevice.current.identifierForVendor?.uuidString`.
   - Windows: a UUID persisted in `ApplicationData.Current.LocalSettings`.
   - This ID must be **stable across app launches**. The server uses it to
     upsert the Device row and scope tokens to this physical device.

5. **POST to `/auth/token`** with the ID token + device info:

   ```http
   POST /api/v1/auth/token HTTP/1.1
   Host: personal-dashboard-mu-lyart.vercel.app
   Content-Type: application/json

   {
     "idToken": "<google-id-token>",
     "deviceId": "<stable-device-id>",
     "deviceName": "Pixel 8",
     "platform": "android",
     "appVersion": "1.0.0"
   }
   ```

6. **Store the response tokens securely.**
   - The response contains:
     ```json
     {
       "success": true,
       "data": {
         "accessToken": "eyJhbGciOiJIUzI1NiIs...",
         "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2gg...",
         "tokenType": "Bearer",
         "expiresIn": 900,
         "user": { "id": "...", "email": "...", "name": "...", ... }
       }
     }
     ```
   - Store `accessToken` and `refreshToken` in the platform keystore
     (Android Keystore, iOS Keychain, Windows DPAPI). Never in plain
     `SharedPreferences` / `NSUserDefaults`.
   - The `refreshToken` is returned **once**. If you lose it, the user must
     sign in again.
   - Persist the `user` object for displaying the profile in settings UI.

7. **You're now authenticated.** Use the access token as a Bearer token
   on every subsequent API call.

### Visual Flow

```
User taps "Sign in with Google"
            │
            ▼
┌─────────────────────────┐
│  Google Sign-In SDK     │
│  (one-tap / button)     │
└────────────┬────────────┘
             │ idToken (Google JWT, ~5 min TTL)
             ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/v1/auth/token                                    │
│  { idToken, deviceId, deviceName, platform, appVersion }    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
   Server verifies idToken with Google tokeninfo
   (audience check, expiry, verified email)
             │
             ▼
   Server upserts User + Device, mints:
     - accessToken (HS256 JWT, 15 min TTL)
     - refreshToken (opaque, SHA-256 hashed in DB, 30 day TTL)
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  200 OK { accessToken, refreshToken, expiresIn, user }      │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
   Store tokens in platform keystore.
   Start sync engine (pull initial dataset).
```

---

## 3. Token Refresh Logic

Access tokens expire after **15 minutes**. When they do, the server responds
with HTTP 401 and `error.code = "TOKEN_EXPIRED"`. Your HTTP client should
intercept this response, refresh the token, and retry the original request
transparently.

### Pseudocode

```
function authenticatedFetch(method, path, body):
    response = fetch(method, path, body, headers: { Authorization: "Bearer " + accessToken })
    if response.status == 401 and response.error.code == "TOKEN_EXPIRED":
        newAccessToken = refreshAccessToken()
        if newAccessToken == null:
            // Refresh failed — refresh token revoked or expired.
            // Clear session, prompt user to sign in again.
            session.clear()
            showSignInScreen()
            throw SessionExpiredError()
        response = fetch(method, path, body, headers: { Authorization: "Bearer " + newAccessToken })
    return response

function refreshAccessToken():
    // Synchronize so only one refresh happens at a time even if multiple
    // requests get 401 simultaneously.
    synchronized(refreshLock):
        // Double-check after acquiring lock — another thread may have refreshed.
        if cachedAccessTokenStillValid():
            return cachedAccessToken
        response = POST("/auth/refresh", { refreshToken: storedRefreshToken })
        if response.status == 200:
            cachedAccessToken = response.data.accessToken
            return cachedAccessToken
        else:
            return null
```

### Critical Implementation Details

1. **Single-flight the refresh.** If 5 requests get a 401 simultaneously,
   only one should call `/auth/refresh` — the others should wait for its
   result and use the new access token. Otherwise you'll burn through the
   rate limit and risk race conditions.

2. **Don't refresh proactively.** The 15-minute TTL is short enough that
   proactive refresh wastes battery and bandwidth. Wait for the 401.

3. **Handle these terminal cases by clearing the session:**
   - `/auth/refresh` returns `TOKEN_REVOKED` → user logged out from another device.
   - `/auth/refresh` returns `DEVICE_REVOKED` → device was revoked.
   - `/auth/refresh` returns `TOKEN_EXPIRED` on the refresh token itself → 30 days elapsed since login.
   - `/auth/refresh` returns `UNAUTHORIZED` → refresh token not in DB (revoked or never existed).

4. **The refresh token is NOT rotated.** The same refresh token can be used
   repeatedly for the full 30-day window. Don't try to extract a "new"
   refresh token from the `/auth/refresh` response — there isn't one.

5. **Don't store the access token in plaintext.** Even though it's short-
   lived, storing it in plaintext means a malicious app could exfiltrate
   it and impersonate the user for up to 15 minutes. Use the keystore.

### Logging Out

To log out (single device):

```http
POST /api/v1/auth/logout HTTP/1.1
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "allDevices": false }
```

Or with the body omitted entirely — the server revokes the calling device.
After logout, clear the locally-stored access + refresh tokens and the
SQLite cache (or mark it as logged-out so the user must re-authenticate
before seeing data).

For "log out everywhere" (remote wipe of all devices):

```json
{ "allDevices": true }
```

---

## 4. Making Authenticated API Calls

Every authenticated request needs:

```
GET /api/v1/tasks?status=doing HTTP/1.1
Host: personal-dashboard-mu-lyart.vercel.app
Authorization: Bearer <accessToken>
Accept: application/json
```

### Common Patterns

**List with pagination + filters:**

```
GET /tasks?page=1&pageSize=50&status=doing&priority=high&sort=-createdAt
```

**Create:**

```http
POST /tasks HTTP/1.1
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "title": "Buy milk", "priority": "high" }
```

Response: `201 Created` with the full record (including server-assigned
`id`, `version: 1`, `createdAt`, `updatedAt`).

**Update with optimistic concurrency:**

```http
PATCH /tasks/abc123 HTTP/1.1
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "title": "Buy oat milk", "baseVersion": 4 }
```

If `baseVersion` doesn't match the server's current `version`, you get
`409 CONFLICT` with:

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

Handle by pulling the latest (`GET /tasks/abc123`), merging your change,
and retrying with the new `baseVersion`.

**Delete (soft by default):**

```http
DELETE /tasks/abc123 HTTP/1.1
Authorization: Bearer <accessToken>
```

The record stays in the DB with `deletedAt` set; subsequent `GET /tasks`
responses exclude it. Use `?force=true` for a hard delete (permanent
removal — no undo).

### Handling Errors

Branch on `error.code`, not on `error.message`:

```kotlin
when (response.error?.code) {
    "VALIDATION_ERROR"  -> showFormErrors(response.error.details)
    "UNAUTHORIZED"      -> triggerReLogin()
    "TOKEN_EXPIRED"     -> refreshAndRetry()
    "TOKEN_REVOKED"     -> triggerReLogin()
    "DEVICE_REVOKED"    -> triggerReLogin()
    "NOT_FOUND"         -> showNotFound()
    "CONFLICT"          -> pullLatestAndRetry()
    "RATE_LIMITED"      -> backoffAndRetry()
    "INTERNAL_ERROR"    -> backoffAndRetry()
    else                -> showGenericError(response.error.message)
}
```

---

## 5. Sync Loop

Sync is what makes multi-device work. The pattern is:

1. **Pull** delta changes from the server.
2. **Apply** them to the local SQLite cache.
3. **Push** queued local changes to the server.
4. **Repeat** on a schedule or on data mutation.

### When to Sync

| Trigger | Action |
|---------|--------|
| App launch | Full sync (pull + push). |
| User mutates data | Debounced push (500ms after last edit). |
| Push notification (silah.sync) | Immediate pull. |
| App comes to foreground | Pull only (cheap). |
| Timer (every 5 minutes) | Pull only. |
| Network reconnects | Full sync. |

### Pull — Apply — Push Pseudocode

```
function syncLoop():
    # 1. PULL
    cursor = loadCursorFromDisk()
    loop:
        response = GET /sync/pull?cursor=<cursor>&pageSize=500
        if not response.success:
            log("pull failed: " + response.error.message)
            scheduleRetry(backoff)
            return

        for event in response.data.events:
            applyEventToLocalDb(event)

        cursor = response.data.nextCursor
        saveCursorToDisk(cursor)

        if response.data.hasMore:
            continue   # immediately pull next page
        else:
            break

    # 2. PUSH
    pushOutbox()

    # 3. SCHEDULE NEXT
    scheduleNextSync(in: 5.minutes)


function applyEventToLocalDb(event):
    switch event.operation:
        case "create":
            localDb.upsert(event.entity, event.entityId, event.payload)
        case "update":
            localDb.upsert(event.entity, event.entityId, event.payload)
            # Note: server-side last-write-wins. The event's payload is
            # the full record after the change, so upsert is correct.
        case "delete":
            localDb.markDeleted(event.entity, event.entityId)
            # If event.payload.deletedAt is set, it's a soft-delete —
            # keep the row locally with deletedAt set (so the user can
            # see it in the recycle bin). Otherwise hard-delete locally.


function pushOutbox():
    pending = localDb.loadPendingChanges(limit: 100)
    if pending.isEmpty():
        return

    response = POST /sync/push, body: { changes: pending }
    if not response.success:
        scheduleRetry(backoff)
        return

    for result in response.data.results:
        switch result.status:
            case "applied":
                localDb.markChangePushed(result.operationId)
            case "replayed":
                # Already applied on a previous push — safe to remove from outbox.
                localDb.markChangePushed(result.operationId)
            case "conflict":
                # Pull the latest version, merge, re-queue.
                latest = GET /<entity>/<result.entityId>
                merged = mergeStrategy.merge(localVersion, latest, myChange)
                localDb.upsert(merged)
                localDb.requeueWithNewBaseVersion(
                    operationId = result.operationId,
                    newBaseVersion = result.version,
                    newPayload = merged
                )
            case "error":
                log("push error for " + result.operationId + ": " + result.error)
                # Keep in outbox for retry with backoff. After N retries
                # (e.g. 5), surface to the user as a "sync failed" notification.
```

### Outbox Design

Every local write should also enqueue an outbox entry:

```
outbox:
  - operationId: UUID (generated client-side, the idempotency key)
  - entity: "tasks"
  - entityId: <local CUID> (for create, generate this client-side; for
              update/delete, use the existing server-assigned ID)
  - operation: "create" | "update" | "delete"
  - baseVersion: <int> (for update — the version the client last saw)
  - payload: { ... } (the changed fields)
  - queuedAt: timestamp
  - retryCount: int
```

Use a UUID library to generate `operationId` (e.g. `UUID.randomUUID()` in
Kotlin, `Guid.NewGuid()` in C#). The same `operationId` must be reused on
retries — that's how the server dedupes.

### Client-Side IDs for Create

When the user creates a new record locally (e.g. adds a task while offline),
generate a CUID client-side and use it as `entityId` in the outbox entry.
This becomes the permanent ID of the record on the server. Benefits:

- The UI can reference the record by ID immediately (no waiting for server).
- If the same create is pushed twice (network retry), the server upserts
  instead of creating duplicates.

CUIDs are 24-character strings like `ckq12345abcde`. Use any CUID library
or just use a UUID — the server accepts any string ≤100 chars.

### Cursor Persistence

The cursor (the last `seq` you've applied) must be persisted to disk
**atomically** — never hold it only in memory. If the app crashes between
applying events and saving the cursor, you'll re-apply some events on next
launch. This is safe (the apply logic must be idempotent — `upsert` handles
this), but it's wasteful.

Use a transaction:

```
function applyEventToLocalDb(event):
    localDb.transaction:
        applyEvent(event)
        saveCursor(event.seq)
```

---

## 6. Conflict Resolution Strategies

A conflict happens when the client's `baseVersion` doesn't match the
server's current `version` — meaning another client (the web app, another
device) modified the same record between your last pull and your push.

The server **detects** conflicts but does **not resolve** them — that's the
client's job. Three common strategies, in order of complexity:

### Strategy A: Server Wins (Simplest)

Drop your local change and accept the server's version.

```
case "conflict":
    latest = GET /<entity>/<result.entityId>
    localDb.upsert(latest)   # overwrite local with server's version
    localDb.markChangeAbandoned(result.operationId)
```

Use this for entities where the user is unlikely to be editing on multiple
devices simultaneously (e.g. pantry items, locations). Simple, no data
loss beyond the user's local edit.

### Strategy B: Client Wins (Last-Write-Wins)

Re-apply your change on top of the server's current version.

```
case "conflict":
    latest = GET /<entity>/<result.entityId>
    # Merge: take server's version, overlay my changed fields
    merged = { ...latest, ...myPayload }
    # Re-queue with new baseVersion
    localDb.requeueWith(
        operationId = result.operationId,    # keep the same for idempotency
        newBaseVersion = result.version,     # server's current version
        newPayload = merged
    )
```

Use this for entities where the user's most recent edit is most important
(e.g. notes — the user wants their latest typing to win).

### Strategy C: Field-Level Merge (Most Sophisticated)

For records with multiple independent fields (e.g. a contact's `phone` and
`email`), merge at the field level — if the server changed `phone` and you
changed `email`, both changes survive.

```
case "conflict":
    latest = GET /<entity>/<result.entityId>
    merged = { ...latest }
    for (field, value) in myPayload:
        if myPayload[field] != myOldLocalVersion[field]:
            # I changed this field — keep my change
            merged[field] = value
        else:
            # I didn't touch this field — accept server's version
            merged[field] = latest[field]
    localDb.requeueWith(result.operationId, result.version, merged)
```

This requires keeping the "old local version" around (the version the
client had before the user edited). Worth it for high-value entities like
contacts, accounts, projects.

### Strategy D: Surface to User (Manual Merge)

For irreplaceable data (e.g. diary entries, notes), show a conflict UI:

```
case "conflict":
    showConflictResolutionScreen(
        localVersion = myPayload,
        serverVersion = GET /<entity>/<result.entityId>,
        onResolve = { chosen -> localDb.requeueWith(..., chosen) }
    )
```

Rarely needed — reserve for entities where field-level merge isn't enough
(e.g. long-form text where the user genuinely needs to see both versions).

### Recommended Per-Entity Strategy

| Entity | Strategy | Rationale |
|--------|----------|-----------|
| tasks | client wins | Users want their latest status / priority. |
| contacts | field-level merge | Phone, email, and address change independently. |
| notes | client wins | Last edit wins for content. |
| events | field-level merge | Time may change on one device, location on another. |
| expenses | server wins | Amount/category rarely conflict; if they do, server's authoritative. |
| accounts | field-level merge | Balance and institution change independently. |
| diary | client wins | User's latest writing. |
| habits | server wins | Config rarely changes; conflicts are rare. |
| projects | field-level merge | Status and progress change independently. |
| everything else | server wins | Safe default. |

---

## 7. Offline-First Architecture

### Local Database Schema

Your SQLite schema should mirror the server's entity schemas, plus:

- A `version` column on every mutable table (for `baseVersion`).
- A `deletedAt` column on every soft-delete-enabled table.
- A `lastSyncSeq` table with a single row storing the cursor per entity
  (or globally — global is simpler since `seq` is per-user monotonic).

```
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'general',
    dueDate TEXT,
    projectId TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    deletedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_dueDate ON tasks(dueDate);

CREATE TABLE outbox (
    operationId TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    entityId TEXT NOT NULL,
    operation TEXT NOT NULL,    -- 'create' | 'update' | 'delete'
    baseVersion INTEGER,
    payload TEXT NOT NULL,      -- JSON
    queuedAt INTEGER NOT NULL,
    retryCount INTEGER NOT NULL DEFAULT 0,
    lastError TEXT
);

CREATE TABLE sync_cursor (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cursor TEXT NOT NULL DEFAULT '0'
);
```

### Reading from Local DB

The UI **always** reads from SQLite. This gives you:

- Instant rendering (no spinner waiting on network).
- Full offline access (airplane mode? no problem).
- Cheap queries (no pagination round-trips).

```
function getTasks(filter):
    return localDb.query("SELECT * FROM tasks WHERE deletedAt IS NULL AND ...")
```

### Writing to Local DB

Every write is a **two-step** operation:

1. Apply the change to the local DB (in a transaction with version bump).
2. Enqueue an outbox entry.

```
function createTaskLocal(title, priority):
    id = generateCuid()
    now = isoNow()
    localDb.transaction:
        localDb.insert("tasks", {
            id, title, priority, status: "todo",
            version: 1, createdAt: now, updatedAt: now
        })
        localDb.insert("outbox", {
            operationId: uuid(),
            entity: "tasks",
            entityId: id,
            operation: "create",
            payload: { title, priority, status: "todo" },
            queuedAt: now
        })
    # Return the new task immediately — UI renders instantly.
    return localDb.findById("tasks", id)
```

### Background Sync Service

Run sync as a background service / work manager task:

- **Android:** `WorkManager` with `Constraints` requiring network.
  Schedule a periodic worker (15 min minimum) plus a one-shot worker
  triggered by data mutations.
- **iOS:** `BGAppRefreshTask` for periodic sync, plus local notifications
  to wake the app when significant changes happen.
- **Windows:** A background `DispatcherTimer` while the app is running,
  plus a Windows service or scheduled task for true background sync.

### Handling Large Initial Sync

A user with 10,000 records will have a multi-megabyte initial sync. Show
a progress UI:

```
function initialSync():
    showProgress("Syncing your data...")
    while True:
        response = GET /sync/pull?cursor=<cursor>&pageSize=1000
        applyEvents(response.data.events)
        updateProgress(eventsApplied: totalApplied)
        cursor = response.data.nextCursor
        if not response.data.hasMore:
            break
    hideProgress()
```

---

## 8. Security Best Practices

### Token Storage

| Platform | Recommended storage | Why |
|----------|---------------------|-----|
| Android | `AndroidKeystore` + `EncryptedSharedPreferences` | Hardware-backed key storage; encrypted at rest. |
| iOS | `Keychain` (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) | Hardware-backed; survives reboot but not device migration. |
| Windows | `DataProtectionProvider` (DPAPI) with `Scope = CurrentUser` | Encrypts with user's Windows credentials. |

**Never** store tokens in:
- Plain `SharedPreferences` / `NSUserDefaults` (world-readable on rooted/jailbroken devices).
- A SQLite database without encryption.
- A file in the app's external storage (other apps can read it).
- Source code / app bundle.

### Google Client ID

The Google OAuth client ID used by your native app is **not a secret** —
it's baked into the app binary. That's fine; Google's security model relies
on the ID token's `audience` claim and the package name / bundle ID
verification Google performs during sign-in. Don't try to "hide" the client
ID — that's security theatre.

What **is** a secret and must never ship in the app:
- The Silah server's `AUTH_SECRET` (used to sign JWTs).
- Any server-side OAuth client secrets.
- Database connection strings.
- API keys for server-side services.

### Certificate Pinning (Optional but Recommended)

To prevent MITM attacks via compromised CAs, consider pinning the Vercel
certificate's public key. Note that Vercel rotates certificates, so pin
the **issuer** (Let's Encrypt) rather than the leaf cert, or use a backup
pin for rotation.

### Don't Log Tokens

Strip `Authorization` headers from your HTTP logs in debug builds:

```kotlin
HttpLoggingInterceptor().apply {
    level = if (BuildConfig.DEBUG) Level.HEADERS else Level.NONE
    redactHeader("Authorization")
    redactHeader("Cookie")
}
```

### Re-authenticate on Biometric Prompt

If your app uses biometric unlock (fingerprint / Face ID), don't cache the
access token in memory between biometric unlocks — re-read it from the
keystore each time. This way a stolen unlocked phone still requires
biometric to access the app.

### Device Revocation UX

If the user revokes this device from the web UI (via `DELETE /devices/:id`),
the next API call returns `401 DEVICE_REVOKED`. Handle this gracefully:

1. Clear all local data (SQLite cache, tokens).
2. Show a modal: "This device was signed out from another device. Please sign in again."
3. Return to the sign-in screen.

---

## 9. Code Snippets

### Kotlin (Android)

#### Auth + Token Storage

```kotlin
// SilahAuth.kt
package com.silah.client

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class SilahAuth(private val context: Context, private val httpClient: OkHttpClient) {

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "silah_auth",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val baseUrl = "https://personal-dashboard-mu-lyart.vercel.app/api/v1"

    var accessToken: String?
        get() = prefs.getString("accessToken", null)
        private set(value) = prefs.edit().putString("accessToken", value).apply()

    private var refreshToken: String?
        get() = prefs.getString("refreshToken", null)
        private set(value) = prefs.edit().putString("refreshToken", value).apply()

    private val refreshLock = Object()

    /** Exchange a Google ID token for Silah tokens. Call on sign-in. */
    suspend fun exchangeIdToken(
        idToken: String,
        deviceId: String,
        deviceName: String,
        appVersion: String
    ): Result<User> = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("idToken", idToken)
            put("deviceId", deviceId)
            put("deviceName", deviceName)
            put("platform", "android")
            put("appVersion", appVersion)
        }.toString()

        val request = Request.Builder()
            .url("$baseUrl/auth/token")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        try {
            httpClient.newCall(request).execute().use { resp ->
                val json = JSONObject(resp.body!!.string())
                if (!json.optBoolean("success")) {
                    return@withContext Result.failure(
                        Exception(json.optJSONObject("error")?.optString("message"))
                    )
                }
                val data = json.getJSONObject("data")
                accessToken = data.getString("accessToken")
                refreshToken = data.getString("refreshToken")
                val user = User(
                    id = data.getJSONObject("user").getString("id"),
                    email = data.getJSONObject("user").getString("email"),
                    name = data.getJSONObject("user").optString("name")
                )
                Result.success(user)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Refresh the access token. Single-flight. Returns null on terminal failure. */
    suspend fun refreshAccessToken(): String? = synchronized(refreshLock) {
        // Double-check after acquiring lock.
        accessToken?.let { return it }

        val token = refreshToken ?: return null
        val body = JSONObject().apply { put("refreshToken", token) }.toString()

        val request = Request.Builder()
            .url("$baseUrl/auth/refresh")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        try {
            httpClient.newCall(request).execute().use { resp ->
                if (resp.code != 200) {
                    // Terminal — clear session.
                    clearSession()
                    return null
                }
                val json = JSONObject(resp.body!!.string())
                val newToken = json.getJSONObject("data").getString("accessToken")
                accessToken = newToken
                newToken
            }
        } catch (e: Exception) {
            null
        }
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }
}
```

#### Authenticated HTTP Client with Auto-Refresh

```kotlin
// SilahHttpClient.kt
class SilahHttpClient(
    private val auth: SilahAuth,
    private val baseUrl: String
) {
    private val client = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) Level.HEADERS else Level.NONE
            redactHeader("Authorization")
        })
        .build()

    suspend fun get(path: String, params: Map<String, String> = emptyMap()): ApiResponse =
        request("GET", path, params, null)

    suspend fun post(path: String, body: JSONObject): ApiResponse =
        request("POST", path, emptyMap(), body)

    suspend fun patch(path: String, body: JSONObject): ApiResponse =
        request("PATCH", path, emptyMap(), body)

    suspend fun delete(path: String): ApiResponse =
        request("DELETE", path, emptyMap(), null)

    private suspend fun request(
        method: String,
        path: String,
        params: Map<String, String>,
        body: JSONObject?
    ): ApiResponse = withContext(Dispatchers.IO) {
        val urlBuilder = HttpUrl.parse("$baseUrl$path")!!.newBuilder()
        params.forEach { (k, v) -> urlBuilder.addQueryParameter(k, v) }

        var attempt = 0
        while (true) {
            val token = auth.accessToken ?: throw SessionExpiredException()
            val reqBuilder = Request.Builder()
                .url(urlBuilder.build())
                .header("Authorization", "Bearer $token")

            when (method) {
                "GET" -> reqBuilder.get()
                "DELETE" -> reqBuilder.delete()
                else -> reqBuilder.method(
                    method,
                    body?.toString()?.toRequestBody("application/json".toMediaType())
                )
            }

            client.newCall(reqBuilder.build()).execute().use { resp ->
                val responseBody = resp.body!!.string()
                val json = if (responseBody.isNotEmpty())
                    JSONObject(responseBody) else JSONObject()

                if (resp.code == 401 && attempt == 0) {
                    val errorCode = json.optJSONObject("error")?.optString("code")
                    if (errorCode == "TOKEN_EXPIRED" || errorCode == "DEVICE_REVOKED") {
                        val newToken = auth.refreshAccessToken()
                        if (newToken != null) {
                            attempt++
                            return@use continue  // retry with new token
                        } else {
                            throw SessionExpiredException()
                        }
                    }
                }

                ApiResponse(
                    success = json.optBoolean("success", false),
                    code = resp.code,
                    data = json.opt("data"),
                    error = json.optJSONObject("error")
                )
            }
        }
    }
}

data class ApiResponse(
    val success: Boolean,
    val code: Int,
    val data: Any?,
    val error: JSONObject?
)

class SessionExpiredException : Exception()
```

#### Sync Loop

```kotlin
// SyncEngine.kt
class SyncEngine(
    private val api: SilahHttpClient,
    private val localDb: LocalDb
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun start() {
        scope.launch { fullSync() }
    }

    suspend fun fullSync() {
        pullAll()
        pushOutbox()
    }

    private suspend fun pullAll() {
        var cursor = localDb.getCursor()
        while (true) {
            val resp = api.get("/sync/pull", mapOf(
                "cursor" to cursor,
                "pageSize" to "500"
            ))
            if (!resp.success) {
                Log.w("SyncEngine", "pull failed: ${resp.error}")
                return
            }

            val data = resp.data as JSONObject
            val events = data.getJSONArray("events")
            for (i in 0 until events.length()) {
                val event = events.getJSONObject(i)
                localDb.applyEvent(event)
                cursor = event.getString("seq")
            }
            localDb.saveCursor(cursor)

            if (!data.getBoolean("hasMore")) break
        }
    }

    private suspend fun pushOutbox() {
        val pending = localDb.getPendingChanges(limit = 100)
        if (pending.isEmpty()) return

        val changesJson = JSONObject().apply {
            put("changes", JSONArray().apply {
                pending.forEach { change ->
                    put(JSONObject().apply {
                        put("operationId", change.operationId)
                        put("entity", change.entity)
                        put("entityId", change.entityId)
                        put("operation", change.operation)
                        change.baseVersion?.let { put("baseVersion", it) }
                        change.payload?.let { put("payload", it) }
                    })
                }
            })
        }

        val resp = api.post("/sync/push", changesJson)
        if (!resp.success) return

        val results = (resp.data as JSONObject).getJSONArray("results")
        for (i in 0 until results.length()) {
            val result = results.getJSONObject(i)
            when (result.getString("status")) {
                "applied", "replayed" -> {
                    localDb.markChangePushed(result.getString("operationId"))
                }
                "conflict" -> {
                    handleConflict(result)
                }
                "error" -> {
                    localDb.incrementRetryCount(
                        result.getString("operationId"),
                        result.optString("error")
                    )
                }
            }
        }
    }

    private suspend fun handleConflict(result: JSONObject) {
        val entityId = result.getString("entityId")
        val newVersion = result.getInt("version")
        // Strategy B: client wins — re-apply our payload with the new baseVersion.
        localDb.requeueChange(
            operationId = result.getString("operationId"),
            newBaseVersion = newVersion
        )
    }
}
```

### C# (Windows / .NET)

#### Auth + Token Storage

```csharp
// SilahAuth.cs
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.Security.Credentials;
using Windows.Security.Cryptography.DataProtection;

public class SilahAuth
{
    private const string ResourceName = "SilahCloudPlatform";
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl = "https://personal-dashboard-mu-lyart.vercel.app/api/v1";
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    private string _accessToken;
    private string _refreshToken;

    public SilahAuth(HttpClient httpClient)
    {
        _httpClient = httpClient;
        LoadTokensFromVault();
    }

    public string AccessToken => _accessToken;

    /// <summary>Exchange a Google ID token for Silah tokens. Call on sign-in.</summary>
    public async Task<User> ExchangeIdTokenAsync(
        string idToken, string deviceId, string deviceName, string appVersion)
    {
        var body = new
        {
            idToken,
            deviceId,
            deviceName,
            platform = "windows",
            appVersion
        };
        var json = JsonSerializer.Serialize(body);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var resp = await _httpClient.PostAsync($"{_baseUrl}/auth/token", content);
        var respJson = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(respJson);

        if (!doc.RootElement.GetProperty("success").GetBoolean())
        {
            var msg = doc.RootElement.GetProperty("error").GetProperty("message").GetString();
            throw new Exception(msg);
        }

        var data = doc.RootElement.GetProperty("data");
        _accessToken = data.GetProperty("accessToken").GetString();
        _refreshToken = data.GetProperty("refreshToken").GetString();
        SaveTokensToVault();

        var userEl = data.GetProperty("user");
        return new User
        {
            Id = userEl.GetProperty("id").GetString(),
            Email = userEl.GetProperty("email").GetString(),
            Name = userEl.TryGetProperty("name", out var n) ? n.GetString() : null
        };
    }

    /// <summary>Refresh the access token. Single-flight. Returns null on terminal failure.</summary>
    public async Task<string> RefreshAccessTokenAsync()
    {
        await _refreshLock.WaitAsync();
        try
        {
            if (_accessToken != null) return _accessToken; // another caller refreshed
            if (_refreshToken == null) return null;

            var body = new { refreshToken = _refreshToken };
            var json = JsonSerializer.Serialize(body);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var resp = await _httpClient.PostAsync($"{_baseUrl}/auth/refresh", content);
            if (resp.StatusCode != System.Net.HttpStatusCode.OK)
            {
                ClearSession();
                return null;
            }

            var respJson = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(respJson);
            _accessToken = doc.RootElement.GetProperty("data").GetProperty("accessToken").GetString();
            SaveTokensToVault();
            return _accessToken;
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    public void ClearSession()
    {
        _accessToken = null;
        _refreshToken = null;
        var vault = new PasswordVault();
        try
        {
            foreach (var cred in vault.FindAllByResource(ResourceName))
                vault.Remove(cred);
        }
        catch { /* no creds */ }
    }

    private void SaveTokensToVault()
    {
        var vault = new PasswordVault();
        try
        {
            foreach (var cred in vault.FindAllByResource(ResourceName))
                vault.Remove(cred);
        }
        catch { }
        if (_accessToken != null)
            vault.Add(new PasswordCredential(ResourceName, "access", _accessToken));
        if (_refreshToken != null)
            vault.Add(new PasswordCredential(ResourceName, "refresh", _refreshToken));
    }

    private void LoadTokensFromVault()
    {
        var vault = new PasswordVault();
        try
        {
            _accessToken = vault.Retrieve(ResourceName, "access")?.Password;
            _refreshToken = vault.Retrieve(ResourceName, "refresh")?.Password;
        }
        catch { /* not present */ }
    }
}

public record User { public string Id { get; set; } public string Email { get; set; } public string Name { get; set; } }
public class SessionExpiredException : Exception { }
```

#### Authenticated HTTP Client with Auto-Refresh

```csharp
// SilahApiClient.cs
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class SilahApiClient
{
    private readonly HttpClient _httpClient;
    private readonly SilahAuth _auth;
    private readonly string _baseUrl;

    public SilahApiClient(HttpClient httpClient, SilahAuth auth, string baseUrl)
    {
        _httpClient = httpClient;
        _auth = auth;
        _baseUrl = baseUrl;
    }

    public async Task<ApiResult> GetAsync(string path, Dictionary<string, string> query = null)
        => await SendAsync(HttpMethod.Get, path, query, null);

    public async Task<ApiResult> PostAsync(string path, object body)
        => await SendAsync(HttpMethod.Post, path, null, body);

    public async Task<ApiResult> PatchAsync(string path, object body)
        => await SendAsync(HttpMethod.Patch, path, null, body);

    public async Task<ApiResult> DeleteAsync(string path)
        => await SendAsync(HttpMethod.Delete, path, null, null);

    private async Task<ApiResult> SendAsync(
        HttpMethod method, string path,
        Dictionary<string, string> query, object body)
    {
        var url = $"{_baseUrl}{path}";
        if (query != null && query.Count > 0)
        {
            var sb = new StringBuilder(url);
            sb.Append('?');
            var first = true;
            foreach (var kv in query)
            {
                if (!first) sb.Append('&');
                sb.Append(Uri.EscapeDataString(kv.Key));
                sb.Append('=');
                sb.Append(Uri.EscapeDataString(kv.Value));
                first = false;
            }
            url = sb.ToString();
        }

        for (int attempt = 0; attempt < 2; attempt++)
        {
            if (_auth.AccessToken == null)
                throw new SessionExpiredException();

            using var req = new HttpRequestMessage(method, url);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _auth.AccessToken);

            if (body != null)
            {
                var json = JsonSerializer.Serialize(body);
                req.Content = new StringContent(json, Encoding.UTF8, "application/json");
            }

            using var resp = await _httpClient.SendAsync(req);
            var respBody = await resp.Content.ReadAsStringAsync();
            using var doc = respBody.Length > 0 ? JsonDocument.Parse(respBody) : null;

            if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized && attempt == 0)
            {
                var code = doc?.RootElement.GetProperty("error").GetProperty("code").GetString();
                if (code == "TOKEN_EXPIRED" || code == "DEVICE_REVOKED")
                {
                    var newToken = await _auth.RefreshAccessTokenAsync();
                    if (newToken == null) throw new SessionExpiredException();
                    continue; // retry with new token
                }
            }

            var success = doc?.RootElement.GetProperty("success").GetBoolean() ?? false;
            return new ApiResult(
                success,
                (int)resp.StatusCode,
                doc?.RootElement.GetProperty("data"),
                doc?.RootElement.GetProperty("error")
            );
        }

        throw new InvalidOperationException("Unreachable");
    }
}

public record ApiResult(bool Success, int StatusCode, JsonElement? Data, JsonElement? Error);
```

#### Sync Loop

```csharp
// SyncEngine.cs
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;

public class SyncEngine
{
    private readonly SilahApiClient _api;
    private readonly LocalDb _localDb;

    public SyncEngine(SilahApiClient api, LocalDb localDb)
    {
        _api = api;
        _localDb = localDb;
    }

    public async Task FullSyncAsync()
    {
        await PullAllAsync();
        await PushOutboxAsync();
    }

    private async Task PullAllAsync()
    {
        var cursor = _localDb.GetCursor();
        while (true)
        {
            var resp = await _api.GetAsync("/sync/pull", new Dictionary<string, string>
            {
                { "cursor", cursor },
                { "pageSize", "500" }
            });
            if (!resp.Success) return;

            var data = resp.Data.Value;
            var events = data.GetProperty("events").EnumerateArray();
            foreach (var ev in events)
            {
                _localDb.ApplyEvent(ev);
                cursor = ev.GetProperty("seq").GetString();
            }
            _localDb.SaveCursor(cursor);

            if (!data.GetProperty("hasMore").GetBoolean()) break;
        }
    }

    private async Task PushOutboxAsync()
    {
        var pending = _localDb.GetPendingChanges(limit: 100);
        if (pending.Count == 0) return;

        var changes = new List<object>();
        foreach (var c in pending)
        {
            changes.Add(new
            {
                operationId = c.OperationId,
                entity = c.Entity,
                entityId = c.EntityId,
                operation = c.Operation,
                baseVersion = c.BaseVersion,
                payload = c.Payload
            });
        }

        var resp = await _api.PostAsync("/sync/push", new { changes });
        if (!resp.Success) return;

        var results = resp.Data.Value.GetProperty("results").EnumerateArray();
        foreach (var result in results)
        {
            var opId = result.GetProperty("operationId").GetString();
            var status = result.GetProperty("status").GetString();

            switch (status)
            {
                case "applied":
                case "replayed":
                    _localDb.MarkChangePushed(opId);
                    break;
                case "conflict":
                    HandleConflict(result);
                    break;
                case "error":
                    _localDb.IncrementRetryCount(opId, result.GetProperty("error").GetString());
                    break;
            }
        }
    }

    private void HandleConflict(JsonElement result)
    {
        var opId = result.GetProperty("operationId").GetString();
        var newVersion = result.GetProperty("version").GetInt32();
        // Strategy B: client wins — re-apply our payload with the new baseVersion.
        _localDb.RequeueChange(opId, newVersion);
    }
}
```

---

## 10. Testing & Debugging

### Local Server

Run the Silah platform locally:

```bash
cd /home/z/my-project
npm run dev    # starts Next.js on http://localhost:3000
```

Point your native client at `http://localhost:3000/api/v1`. For testing
from a physical device, use `https://<your-machine>.ngrok.io/api/v1` via
ngrok — Vercel requires HTTPS for production.

### Test Tokens

You can obtain a Google ID token for testing by:

1. Using the [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Selecting the `openid email profile` scope.
3. Exchanging the resulting ID token at `POST /auth/token`.

### Inspecting the Sync State

`GET /sync/status` shows you:

- `latestSeq` — the highest event seq the server has for this user.
- `eventCount` — total events.
- `perEntity` — per-entity breakdown.
- `device` — info about the calling device (useful to confirm `platform`
  and `appVersion` were set correctly).

Useful for verifying that your client's cursor matches the server's latest.

### Debugging Conflicts

If a record keeps coming back as `conflict`:

1. Check the server's current version: `GET /tasks/abc123` → look at
   `version` and `updatedAt`.
2. Check your local version.
3. Confirm your client is sending `baseVersion` in the PATCH/push body —
   if you forget it, no conflict check happens (last-write-wins).
4. Confirm your client is updating its local `version` after every
   successful PATCH/push (otherwise the next change will always conflict).

### Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Forgot to persist cursor | Every launch re-syncs from 0 | Persist cursor atomically in SQLite |
| Not single-flight on refresh | Multiple 401s → multiple `/auth/refresh` calls → rate limited | Use a lock / mutex around refresh |
| Storing access token in plain prefs | Token exfiltratable on rooted device | Use AndroidKeystore / Keychain / DPAPI |
| Sending `userId` in body | `VALIDATION_ERROR` — schemas are `.strict()` | Don't send server-managed fields |
| Forgetting `baseVersion` | No conflict detection — silent overwrites | Always send `baseVersion` for updates |
| Generating `operationId` per retry | Duplicate creates on push retries | Generate once, reuse on retries |
| Treating `seq` as a JS number | Precision loss above 2^53 | Use BigInt / string parsing |
| Hard-coding `expiresIn` | Breaks when server changes TTL | Read `expiresIn` from the response |

---

## 11. Checklist for Shipping

Before you ship your native client, verify:

- [ ] **Auth**
  - [ ] Google Sign-In configured with the correct client ID.
  - [ ] `POST /auth/token` exchanges ID token for access + refresh tokens.
  - [ ] Tokens stored in platform keystore (not plain prefs).
  - [ ] 401 `TOKEN_EXPIRED` triggers single-flight refresh + retry.
  - [ ] Terminal refresh failures (`TOKEN_REVOKED`, `DEVICE_REVOKED`,
        `TOKEN_EXPIRED` on refresh) clear the session and prompt re-login.
  - [ ] Logout button calls `POST /auth/logout` with `{ allDevices: true }`
        or empty body.

- [ ] **HTTP Client**
  - [ ] `Authorization: Bearer <accessToken>` header on every authenticated call.
  - [ ] `Accept: application/json` header.
  - [ ] Exponential backoff on 429 `RATE_LIMITED` and 5xx.
  - [ ] Authorization header redacted from logs.

- [ ] **Local DB**
  - [ ] SQLite schema mirrors the 24 sync-enabled entities.
  - [ ] `version` column on every mutable table.
  - [ ] `deletedAt` column on soft-delete-enabled tables.
  - [ ] Outbox table with `operationId`, `entity`, `entityId`, `operation`,
        `baseVersion`, `payload`, `retryCount`.
  - [ ] Cursor persisted atomically with event application.

- [ ] **Sync Engine**
  - [ ] Pull → apply → push loop runs on app launch.
  - [ ] Local mutations enqueue outbox entries.
  - [ ] Push retries use the same `operationId` (idempotency).
  - [ ] Conflicts handled per the chosen strategy (§6).
  - [ ] Background sync scheduled (WorkManager / BGAppRefreshTask / DispatcherTimer).
  - [ ] Initial large sync shows progress UI.

- [ ] **UX**
  - [ ] App works fully offline (reads from SQLite, writes to outbox).
  - [ ] "Last synced at X" indicator in settings.
  - [ ] "Sync failed — retry" banner when outbox has stuck entries.
  - [ ] Device list (via `GET /devices`) shown in settings, with revoke
        buttons (via `DELETE /devices/:id`).

- [ ] **Security**
  - [ ] No secrets in the app bundle.
  - [ ] Tokens in keystore.
  - [ ] Certificate pinning (optional but recommended).
  - [ ] Biometric re-auth re-reads tokens from keystore.

- [ ] **Compliance with API Contract**
  - [ ] All 24 entity domains supported.
  - [ ] Pagination: `page` + `pageSize` (≤100).
  - [ ] Sorting: `sort=field` or `sort=-field`.
  - [ ] Search: `?search=...`.
  - [ ] Date range: `?dateFrom=...&dateTo=...`.
  - [ ] Soft delete: include `?includeDeleted=true` for recycle-bin view.
  - [ ] Hard delete: `?force=true` only on user-confirmed "delete forever".
  - [ ] Optimistic concurrency: `baseVersion` in PATCH bodies and push
        payloads for updates.

If you can check every box above, you have a fully compliant Silah native
client. Welcome aboard!
