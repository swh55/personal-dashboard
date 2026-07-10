# Task 5 — sections-batch-3

## Files Created
All under `/home/z/my-project/src/components/dashboard/sections/`:

1. **`health.tsx`** — `HealthSection`
   - 3 stat cards (active meds, avg sleep hours, avg quality 1-4)
   - Two-column layout: Medications Card (Switch toggle active, edit/delete, Add/Edit Dialog) + Sleep Card (recharts LineChart of duration-hours + 14-day list with quality badges, Add Sleep Dialog)
   - Quality badges: poor=rose, fair=amber, good=emerald, excellent=blue (with emoji)
   - POST/PUT/DELETE use `type=medication|sleep` discriminator per API spec
   - DELETE medication = soft delete (deletedAt); DELETE sleep = hard delete (per API)

2. **`diary.tsx`** — `DiarySection`
   - Mood filter chips (6 moods: happy/excited/neutral/anxious/sad/angry with emoji + counts)
   - Search Card by title/content
   - Responsive grid of entry cards (mood emoji, title, weather Lucide-icon badge, content line-clamp-4, date + mood badge)
   - Click → full-view Dialog with edit + delete actions
   - Add/Edit Dialog: title, content textarea, mood Select w/ emoji, weather Select, date
   - AlertDialog delete confirm (soft)

3. **`accounts.tsx`** — `AccountsSection`
   - Hero gradient Card: total balance in SYP-equivalent (USD × 12500) + SYP/USD breakdown
   - 2 secondary stat Cards (count, total USD)
   - Account Cards grid: type-colored icon (bank/cash/savings/credit), name, type badge, institution, balance (emerald-glow/amber-glow, rose-500 when negative), USD→SYP equivalent
   - Add/Edit Dialog + AlertDialog delete (hard delete per API)

4. **`occasions.tsx`** — `OccasionsSection`
   - Hero Card: next occasion (gradient avatar with type emoji + full date + "اليوم!" or "بعد X يوم" badge)
   - Sorted list grouped by month of next occurrence (recurring occasions auto-advance year if past)
   - Each Card: type-colored icon + title + emoji + date + days-until Badge + recurring (سنوي) Badge + note
   - Add/Edit Dialog (title, date, type Select w/ emoji, recurring checkbox, note)
   - AlertDialog delete confirm (hard delete)

5. **`activity.tsx`** — `ActivitySection`
   - 6-stat bar: total + per-action counts (create=emerald, update=blue, delete=rose, toggle=amber, sync/export/import=violet)
   - Filter Card: search Input + entity Select (dynamic from observed entities)
   - Activity list: action icon + entity Badge (Arabic labels) + message + timeAgo
   - "Clear old (before 30 days)" button → AlertDialog confirm → DELETE `?before=ISO`
   - Fetches `?limit=200`

6. **`recycle-bin.tsx`** — `RecycleBinSection`
   - Tabs by 10 types (disabled when count=0; each w/ icon + count Badge)
   - Per-item Card: type icon + title (varies by type) + subtitle + "حذف قبل X" via timeAgo
   - Restore button (PUT `{type,id}`) + permanent-delete icon (DELETE `?type&id`) — both with AlertDialog confirm
   - "Restore All" (sequential PUTs) + "Empty Recycle Bin" (sequential DELETEs) with AlertDialog confirm
   - Empty state when total=0

7. **`settings.tsx`** — `SettingsSection`
   - Uses `useAppSettings` store + `next-themes` useTheme (mounted pattern)
   - 5 Cards:
     - **Profile**: avatar (first letter) + username Input + save (setUsername + PUT /api/appearance)
     - **Security**: PIN Switch + when enabled 4-digit PIN Input (digits-only, dir=ltr) + save (setPinCode + PUT); disabled clears pinCode
     - **Appearance**: theme 2-button selector (dark/light + Sun/Moon icons + check) calls setStoreTheme + setRenderedTheme + PUT; accent picker (5 swatches: emerald/amber/rose/blue/violet w/ color preview + check) calls setAccent + PUT
     - **Data**: Export button (POST /api/sync/drive w/ success toast showing filename + counts) + Clear activity button (DELETE /api/activity?before=now + AlertDialog confirm)
     - **About**: app name, version, tech stack, platform, credits w/ Heart icon
   - Separator dividers, loading skeletons while not mounted

## Quality Checks
- `bun run lint` → exit 0
- `bunx tsc --noEmit` → no errors in any of the 7 files (all remaining errors are for other section/widget files outside Task 5 scope)
- `dev.log` → only contains "Module not found" errors for widgets (out of scope); all 7 of my section files resolve cleanly when page.tsx imports them

## Patterns Used
- Consistent header (title + description + refresh + add buttons)
- `useApi` + `reload()` for data fetching
- `toast.success/error` for mutation feedback
- Skeleton loaders, Alert+retry, icon+message+CTA empty states
- AlertDialog confirm for destructive ops
- `custom-scroll` ScrollArea for overflow
- emerald-glow/amber-glow accent classes for theming
- dir="ltr" for numeric inputs (PIN, phone), text-right where needed
