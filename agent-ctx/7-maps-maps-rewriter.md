# Task ID: 7-maps
# Agent: maps-rewriter

## Task
Rewrite `src/components/dashboard/sections/maps.tsx` to use an interactive
Leaflet map (loaded dynamically via CDN) with a draggable marker, replacing the
previous non-interactive OpenStreetMap iframe.

## What was done

1. **`useLeaflet()` custom hook** — injects Leaflet CSS (`leaflet.css`) and JS
   (`leaflet.js`) from `https://unpkg.com/leaflet@1.9.4/dist/...` once per
   browser session. Tracks `{ loaded, failed }` state. Skips if `window.L`
   already exists. Cleans up via cancellation flag.

2. **`LeafletMap` component** — props: `lat`, `lng`, `zoom`, `onMarkerMove`,
   `draggable`, `height`, `className`, `hint`.
   - Initializes `L.map()` on a `<div ref>` with explicit inline height
   - Adds OpenStreetMap tile layer
   - Adds a draggable marker at `[lat, lng]`
   - `marker.dragend` → calls `onMarkerMove(lat, lng)` (via ref to avoid stale
     closures)
   - `map.click` → moves marker + calls `onMarkerMove`
   - External `lat`/`lng` prop changes → syncs marker position + `panTo`
   - External `draggable` prop change → toggles `marker.dragging.enable/disable`
   - `ResizeObserver` → calls `map.invalidateSize()` whenever the container
     resizes (handles dialog-open animation)
   - Initial `setTimeout(invalidateSize, 120)` to fix tiles inside animating
     dialog
   - `useEffect` cleanup → `map.remove()` + nulls refs
   - Loading state: spinner with "جارٍ تحميل الخريطة..."
   - Failure state: "تعذّر تحميل الخريطة" with `WifiOff` icon
   - Map container is `dir="ltr"` (surrounding UI stays RTL)

3. **Main `MapsSection`** — kept the existing API contract (`/api/locations`
   GET/POST/DELETE, `SavedLocation` shape unchanged).
   - Main map at top of body, fixed 250px height, draggable marker
   - Header now shows live pin coordinates (`pinPos` state) instead of just
     selected name
   - Header has new "موقعي الحالي" (Locate) button that calls
     `getCurrentLocation()` from `@/lib/native/bridge` and snaps the pin
   - Selecting a saved location from the list snaps `pinPos` to that location's
     coords (drives the map's `lat`/`lng` props)
   - Add dialog has the `LeafletMap` embedded (220px height) above the lat/lng
     inputs — dragging the marker or clicking the map updates the inputs in
     real time, and typing in the inputs moves the marker (sync runs both ways)
   - Add dialog also has a "موقعي الحالي" button to fill coords from GPS
   - Stats card "الخريطة" replaced with "موقع الدبوس" showing live lat/lng
     in mono font (LTR)
   - All existing functionality preserved: icon picker, color picker, delete
     confirm dialog, refresh, etc.

## Verification
- `bunx eslint src/components/dashboard/sections/maps.tsx` → 0 errors / 0 warnings
- `bunx tsc --noEmit --skipLibCheck` → no errors in maps.tsx
- Dev server returns `GET / 200` after edit, page compiles cleanly

## Files touched
- `src/components/dashboard/sections/maps.tsx` (rewritten, ~925 lines)

## API contract
Unchanged — still uses:
- `GET /api/locations` → `{ success, data: SavedLocation[] }`
- `POST /api/locations` with `{ name, address, lat, lng, icon, color }`
- `DELETE /api/locations?id=...`

No new endpoint added (no PUT/PATCH for marker-drag persistence — drag on the
main map is exploratory only and seeds the add dialog when the user clicks
"إضافة مكان").
