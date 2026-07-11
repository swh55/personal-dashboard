# Task ID 4 — sections-batch-2

## Task
Build 6 dashboard section components under `/home/z/my-project/src/components/dashboard/sections/`:
- `expenses.tsx` → `ExpensesSection`
- `finances.tsx` → `FinancesSection`
- `debts.tsx` → `DebtsSection`
- `projects.tsx` → `ProjectsSection`
- `meetings.tsx` → `MeetingsSection`
- `islamic.tsx` → `IslamicSection`

## Context I Read
- `worklog.md` (Tasks 1-3) — foundation + shell + 7 prior sections (overview, calendar, callpad, contacts, tasks, notes, habits)
- `src/lib/api.ts` — `useApi<T>("/url")` returns `{ data, loading, error, reload, setData }`, plus `toast`, `formatDate`, `formatTime`, `formatDateTime`, `daysUntil`, `timeAgo`
- `src/lib/constants.ts` — `CURRENCIES`, `EXPENSE_CATEGORIES`, `USD_TO_SYP`, `formatCurrency`, `formatNumber`, `USER_PROFILE`
- `src/app/api/{expenses,finances,debts,projects,meetings,quran,weather}/route.ts` — verified response shapes (data + stats)
- `prisma/schema.prisma` — Expense, Asset, Account, Debt, Project, Meeting, QuranLog models
- `src/components/dashboard/sections/{contacts,notes}.tsx` — matched patterns for header/stat-card/filter/scroll-area/dialog/alert-dialog
- `package.json` — confirmed `recharts ^2.15.4`, `date-fns ^4`, `sonner ^2` installed
- shadcn/ui source for `progress.tsx`, `slider.tsx`, `select.tsx`, `dialog.tsx`, `alert-dialog.tsx`

## Work Log
1. **expenses.tsx** — `ExpensesSection`:
   - Calls `GET /api/expenses` (returns `{ data, stats }` with `totalSYP`, `totalUSD`, `count`, `byCategory`)
   - 4 stat cards (SYP total, USD total, count, top category with SYP value) — computed client-side from filtered list so they reflect current filter
   - Category Select (EXPENSE_CATEGORIES) + date-range Select (week/month/all; week starts Saturday for RTL)
   - Currency Switch toggle (`convertAll`) — shows SYP equivalent for every expense (USD_TO_SYP)
   - Expense cards with colored category icon (CATEGORY_COLORS map) + currency badge + colored amount (emerald for SYP, amber for USD) + optional SYP-equivalent
   - Hover actions: edit (Pencil → Add/Edit Dialog), delete (Trash2 → AlertDialog soft-delete via `DELETE /api/expenses?id=`)
   - Side panel (lg+) with recharts PieChart: distribution by category in SYP equivalent, PIE_PALETTE, RTL-styled Tooltip + Legend
   - Add/Edit Dialog: amount, currency Select, category Select, date picker, description Textarea
   - Loading skeletons, error Alert+retry, empty state with icon+message+CTA

2. **finances.tsx** — `FinancesSection`:
   - Calls `GET /api/finances` (returns `{ assets, accounts, debts, budgets, totalAssets, totalAccounts, totalOwed, totalOwe, netWorth, monthSpend, monthExpenseCount }`)
   - Net-worth hero Card with gradient `from-emerald-glow/15 to-amber-glow/10` bg + big number (emerald if ≥0, rose if <0)
   - 4 stat cards: total assets (emerald), total accounts (emerald), total owed-to-me (emerald), total I-owe (rose)
   - Monthly spend Card with expense-count Badge
   - Assets breakdown Card (scrollable list with type badge + original-currency amount + SYP equivalent when USD)
   - Accounts breakdown Card (scrollable list with type badge + colored balance + SYP equivalent)
   - Debts overview Card with two side-by-side panels (ديون لي emerald / ديون عليّ rose) listing personName + colored amount
   - All amounts via `formatCurrency`
   - Loading skeletons, error Alert+retry, empty mini-states per section

3. **debts.tsx** — `DebtsSection`:
   - Calls `GET /api/debts` (returns `{ data, stats: { totalOwed, totalOwe, count } }`)
   - 3 stat cards: total owed-to-me (SYP, emerald), total I-owe (SYP, rose), net diff (colored by sign)
   - Filter Select (all/owed/owe) — note that settled debts aren't returned by API
   - Two-section layout: "ديون لي" (emerald accent, ArrowUpRight) + "ديون عليّ" (rose accent, ArrowDownRight)
   - Debt cards: personName + currency badge + due-date Badge (red if overdue, with `daysUntil` days-late count) + description + amount (accent-colored) + USD→SYP equivalent
   - Hover actions: settle (CheckCircle2 → `PUT settled:true`), edit (Pencil), delete (Trash2 → AlertDialog soft delete)
   - Add/Edit Dialog: personName, amount, currency Select, type Select (owed/owe), dueDate, description
   - Loading skeletons, error Alert+retry, per-section empty states, global empty state

4. **projects.tsx** — `ProjectsSection`:
   - Calls `GET /api/projects` (returns `{ data: Project[] with _count.tasks, stats: { total, active, completed, paused, avgProgress } }`)
   - 5 stat cards: total, active, paused, completed, avgProgress%
   - Filter Select (all/active/paused/completed/archived)
   - Project cards grid (md:2, xl:3 cols): color dot (COLOR_HEX map) + name + description (line-clamp-2) + status Badge (color-coded with icon from STATUS_META) + Progress bar with % + task count + start/end dates
   - Click → detail Dialog (color dot + title + status + description + progress + dates + edit/delete)
   - Add/Edit Dialog: name, description, status Select, color Select (with color swatches), progress Slider 0-100 step 5, startDate, endDate
   - AlertDialog delete (soft via `DELETE /api/projects?id=`)
   - Loading skeletons, error Alert+retry, empty state

5. **meetings.tsx** — `MeetingsSection`:
   - Calls `GET /api/meetings` (returns `{ data, stats: { total, upcoming, completed, cancelled } }`)
   - 4 stat cards: total, upcoming, completed, cancelled
   - Filter Select (all/scheduled/completed/cancelled)
   - Meeting cards grid: title + agenda preview + status Badge + date/time (formatted) + location + participants + hover actions (إتمام set completed, إلغاء set cancelled, edit, delete)
   - Click → detail Dialog: shows agenda + time + location + participants + editable notes Textarea (separate PUT to save notes) + status toggle buttons + edit/delete
   - Add/Edit Dialog: title, agenda Textarea, location, status Select, participants, startDate/endDate datetime-local, notes (when editing)
   - Helper `toLocalInput` for datetime-local value formatting
   - AlertDialog delete (soft via `DELETE /api/meetings?id=`)
   - Loading skeletons, error Alert+retry, empty state

6. **islamic.tsx** — `IslamicSection`:
   - Calls `GET /api/quran` (returns `{ data: QuranLog[], stats: { totalAyahs, surahsRead, sessions, surahNames: string[114] } }`) + `GET /api/weather` (for sunrise/sunset)
   - Hijri date banner Card: `new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day, month, year }).format(new Date())` with Gregorian subtitle
   - Left column: 3 stat cards (total ayahs, surahs read, sessions) + Quran log Card (scrollable list of logs with surah name from `stats.surahNames` + from/to ayah badge + ayah count + juz badge + note + date + delete-on-hover)
   - Right column: prayer times Card (static Aleppo times: Fajr 5:00, Dhuhr 12:30, Asr 15:45, Maghrib 19:00, Isha 20:30) with next prayer highlighted (emerald bg + countdown via `getNextPrayerIndex` + `formatCountdown`, recomputed every minute via `setInterval`); weather sunrise/sunset shown in footer if available
   - Daily dhikr Card: rotating from 8-item DHIKR_LIST based on `dayOfYear % DHIKR_LIST.length`, gradient bg, Arabic dhikr, count badge, virtue text
   - Add Reading Dialog: surah Select (1-114 with names from stats.surahNames), fromAyah, toAyah, juz 1-30, note Textarea
   - AlertDialog delete (hard delete via `DELETE /api/quran?id=`)
   - Loading skeletons, error Alert+retry, empty state

## Conventions Followed
- `"use client"` at top of every file
- Named exports matching filenames exactly: `ExpensesSection`, `FinancesSection`, `DebtsSection`, `ProjectsSection`, `MeetingsSection`, `IslamicSection`
- TypeScript strict; all API response shapes typed via local interfaces
- Only existing shadcn/ui components + Lucide icons + recharts (expenses only)
- Arabic throughout; RTL-aware (dir="ltr" + text-right for phone numbers, time strings, datetime-local inputs)
- Each section: `flex h-full flex-col gap-4` root + header (title + description + refresh + add) + stat cards grid + filter Card + `ScrollArea` with `custom-scroll` for overflow
- Loading: Skeleton grids matching layout
- Error: `<Alert variant="destructive">` with retry Button calling `reload()`
- Empty: icon (muted/40) + bold message + muted hint + outline CTA button
- Mutations: `fetch` with `try/catch`, `toast.success`/`toast.error` from `sonner` via `@/lib/api`, `reload()` after success
- Soft deletes: `DELETE /api/{resource}?id=...` (server sets `deletedAt`); AlertDialog confirm for delete
- Worklog appended at `/home/z/my-project/worklog.md`

## Verification
- `bun run lint` → exit 0, no errors
- `bunx tsc --noEmit` → all errors are about OTHER section files (health, diary, accounts, occasions, activity, recycle-bin, settings, suggestions, maps, ai-insights, budget, integrations, automation, scheduled-messages, waiting-list, contact-reminders, appearance, home-management, gamification, analytics, smart-notifications) and widgets (pomodoro, ai-assistant, smart-notifications) — all OUT of Task 4 scope. NONE of my 6 files have type errors.
- dev.log latest entries: only stale "Module not found" errors for widgets (out of scope); all 6 of my section files resolve cleanly when page.tsx imports them (page.tsx:12-17 imports + 58-63 usage all match my exports)

## Summary
6 production-ready Arabic RTL dashboard sections delivered, fully wired to existing API routes with CRUD dialogs, stats, filters, charts (expenses pie), and rich detail views (projects, meetings). All passes lint; all my files type-check clean. Remaining project errors are explicitly other agents' scope (other section files + 3 widgets).
