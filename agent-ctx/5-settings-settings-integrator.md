# Task ID: 5-settings — settings-integrator

## Task
Add missing settings (city, exchange rate, AI API) + integrate calendar/calllog sync.

## Work Log
- Read worklog and inspected existing infrastructure:
  - `use-app-settings.ts` (zustand persisted store, fields: pinEnabled/pinCode/theme/accent/username)
  - `/api/appearance/route.ts` (server, allow-list of 5 keys)
  - `src/lib/local/fetch-interceptor.ts` `appearanceRoute` (local APK mirror of above)
  - `/api/weather/route.ts` (hardcoded USER_PROFILE lat/lng)
  - `/api/ai/chat/route.ts` (used ZAI.create() with internal config from /etc/.z-ai-config)
  - `src/lib/local/fetch-interceptor.ts` `weatherRoute` (static mock) + `aiChatRoute` (static mock)
  - `CalendarSync` plugin (`@/lib/native/calendar-sync`) and `CallLogSync` plugin (`@/lib/native/calllog-sync`)
  - Z.ai SDK signature: `ZAI.create()` reads config from `.z-ai-config` file (no API key arg), so direct fetch is needed for user-supplied keys

- Extended `src/hooks/use-app-settings.ts`:
  - Added fields: `city`, `lat`, `lng`, `timezone`, `exchangeRate`, `aiApiKey`, `aiModel`, `aiBaseUrl`
  - Added setters: `setCity`, `setLat`, `setLng`, `setTimezone`, `setExchangeRate`, `setAiApiKey`, `setAiModel`, `setAiBaseUrl`
  - Defaults: city=حلب, lat=36.2021, lng=37.1343, timezone=Asia/Damascus, exchangeRate=12500, aiApiKey="", aiModel=glm-4-flash, aiBaseUrl=""

- Extended `/api/appearance/route.ts` (server):
  - Replaced hardcoded key list with `ALLOWED_KEYS` constant (13 keys total)
  - GET returns all 13 keys with sensible defaults
  - PUT persists all 13 keys (numbers/booleans coerced to string)

- Extended `src/lib/local/fetch-interceptor.ts` `appearanceRoute`:
  - Same `APPEARANCE_KEYS` allow-list mirroring the server route
  - GET/PUT handle all 13 keys consistently with server

- Updated `src/app/api/weather/route.ts`:
  - Added `readLocationSettings()` helper that reads city/lat/lng/timezone from AppSetting table, falling back to USER_PROFILE defaults if missing
  - Open-Meteo URL now uses configured lat/lng + URL-encoded timezone
  - Response `city` and `timezone` reflect the configured values

- Updated `src/app/api/ai/chat/route.ts`:
  - Added `readAISettings()` helper that reads aiApiKey/aiModel/aiBaseUrl from AppSetting table
  - Removed dependency on `z-ai-web-dev-sdk` (ZAI.create() doesn't accept user-supplied keys)
  - If no API key set, returns Arabic message asking user to set up API key in Settings
  - Otherwise makes a direct `fetch(`${baseUrl}/chat/completions`)` with Bearer auth using the user's key, model, and (optional) base URL
  - Default base URL: `https://api.z.ai/api/paas/v4`

- Updated `src/lib/local/fetch-interceptor.ts` `weatherRoute`:
  - Reads city/lat/lng/timezone from appSettings collection in local DB
  - Attempts live open-meteo fetch; on failure falls back to static mock (offline mode)

- Updated `src/lib/local/fetch-interceptor.ts` `aiChatRoute`:
  - Reads aiApiKey/aiModel/aiBaseUrl from appSettings
  - If key present, attempts real API call to Z.ai endpoint
  - Otherwise returns mock response telling user to set up API key in settings

- Added 3 new cards to `src/components/dashboard/sections/settings.tsx`:
  1. **Location (الموقع)**: city input + lat input + lng input + timezone select (13 options) + "use current GPS location" button calling `getCurrentLocation()` from native bridge + Save button. Synced to store + persisted via PUT /api/appearance.
  2. **Exchange Rate (سعر الصرف)**: numeric input (default 12500) + Save button. Persists via /api/appearance.
  3. **AI API Settings (إعدادات الذكاء الاصطناعي)**: API key input (password type with show/hide toggle), model select (6 GLM models), optional base URL input, Save button. Warning banner if no key set. Persists via /api/appearance.

- Integrated Calendar Sync in `src/components/dashboard/sections/calendar-section.tsx`:
  - Added `phoneEvents` local state + `mergedEvents` memo (local + phone, filtered by visible month window)
  - "مزامنة مع الهاتف" button in header (only shown if `isNative()`): requests permissions → `CalendarSync.getEvents({ startTime, endTime })` → maps phone events to EventItem with `[هاتف]` title prefix and `phone-` id prefix → toast with imported count
  - Added "تصدير للهاتف" icon button on EventCard (Share2 icon, only for non-phone events, only shown if `isNative()`): calls `CalendarSync.createEvent()` with the event's title/description/location/times
  - Phone events are read-only (no edit/delete buttons)

- Integrated Call Log Sync in `src/components/dashboard/sections/callpad.tsx`:
  - Added `phoneLogs` local state + `mergedLogs` memo (local + phone, sorted newest-first)
  - "مزامنة السجل" button in header (only shown if `isNative()`): requests permissions → `CallLogSync.getCallLogs({ limit: 100 })` → maps to CallLog shape with `phone-` id prefix → toast with count
  - Phone log entries shown in call log list with "هاتف" badge; tap-to-redial still works
  - Existing "مزامنة من الجهاز" (contacts sync) button preserved alongside

- Verified: `bunx eslint` on all 8 touched files → 0 errors / 0 warnings
- Verified: `bunx tsc --noEmit` → only pre-existing errors remain (line 264 of fetch-interceptor.ts is pre-existing, confirmed by stashing changes and re-running)
- Dev server log shows successful compile (`✓ Compiled in 5.4s`) after the import-path typo was fixed

## Stage Summary
- 3 new settings cards (Location, Exchange Rate, AI API) added to Settings section
- All 13 settings keys persist through both server (/api/appearance → AppSetting table) and local APK (appSettings collection in localStorage DB) paths
- Weather route (server + local) now respects user's configured city/lat/lng/timezone
- AI chat route (server + local) now uses user-supplied API key + model + optional base URL; prompts user to set up key if missing
- Calendar section: phone calendar sync (read phone events with `[هاتف]` prefix) + export events to phone calendar
- Callpad section: phone call log sync (display phone logs with "هاتف" badge in recent calls list)
- All sync buttons only visible when `isNative()` returns true (browser users see no broken buttons)
- Arabic RTL labels throughout; all loading/error states handled with toasts and spinners
- Existing settings (profile, PIN, theme, accent, data, about) preserved unchanged
