# Task 10-fix — useApi Data Access Pattern Bug Fix

## Agent
useapi-fixer

## Task
Fix the buggy `resp?.data` access pattern in 18 dashboard section files. The `useApi` hook in `src/lib/api.ts` already extracts `json.data` into the `data` field and provides the full response via `raw`. Many section components incorrectly treated `data` as `{ data: [...] }` and accessed `resp?.data`, which was always `undefined`.

## Files Fixed (18)

All in `/home/z/my-project/src/components/dashboard/sections/`:

1. **activity.tsx** — `/api/activity?limit=200` → `useApi<ActivityLog[]>`, `const logs = data || []`. No stats from API used (computed client-side).
2. **waiting-list.tsx** — `/api/waiting-list` → `useApi<WaitingItem[]>`, `const items = data || []`, `const meta: WaitingMeta | undefined = raw?.meta`.
3. **diary.tsx** — `/api/diary` → `useApi<DiaryEntry[]>`, `const entries = data || []`.
4. **recycle-bin.tsx** — `/api/recycle-bin` → `useApi<RecycleData>`. Kept `data: resp` rename (downstream var is `data`), `const data = resp || ({} as RecycleData)`, `const total = raw?.total || 0`.
5. **integrations.tsx** — `/api/integrations` → `useApi<Integration[]>`, `const integrations = data || []`, `const meta: IntegrationMeta | undefined = raw?.meta`. Extracted `IntegrationMeta` interface.
6. **home-management.tsx** — `/api/home` → `useApi<HomeResponse>`, `const { data: home, ... }`. Object response — downstream uses `home?.pantry`, `home?.stats` etc. directly (already null-safe).
7. **automation.tsx** — `/api/automation` → `useApi<AutomationRule[]>`, `const rules = data || []`.
8. **scheduled-messages.tsx** — `/api/scheduled-messages` → `useApi<ScheduledMessage[]>`, `const messages = data || []`.
9. **budget.tsx** — `/api/budget` → `useApi<BudgetItem[]>`, `const budgets = data || []`, `const stats: BudgetStats | undefined = raw?.stats`.
10. **accounts.tsx** — `/api/accounts` → `useApi<Account[]>`, `const accounts = data || []`, `const stats: AccountStats = raw?.stats || { ... }`.
11. **projects.tsx** — `/api/projects` → `useApi<Project[]>`, `const projects = data || []`, `const stats: ProjectStats = raw?.stats || { ... }`.
12. **debts.tsx** — `/api/debts` → `useApi<Debt[]>`, `const debts = data || []`, `const stats: DebtStats = raw?.stats || { ... }`.
13. **health.tsx** — `/api/health` → `useApi<HealthData>`, `const medications = data?.medications || []`, `const sleepLogs = data?.sleepLogs || []`, `const stats: HealthStats = raw?.stats || { ... }`. Extracted `HealthData` interface.
14. **contact-reminders.tsx** — `/api/contact-reminders` → `useApi<ContactReminder[]>`, `const reminders = data || []`, `const meta: RemindersMeta | undefined = raw?.meta`.
15. **expenses.tsx** — `/api/expenses` → `useApi<Expense[]>`, `const expenses = data || []`, `const stats: ExpenseStats = raw?.stats || { ... }`.
16. **suggestions.tsx** — `/api/suggestions` → `useApi<Suggestion[]>`, `const suggestions = data || []`.
17. **meetings.tsx** — `/api/meetings` → `useApi<Meeting[]>`, `const meetings = data || []`, `const stats: MeetingStats = raw?.stats || { ... }`.
18. **maps.tsx** — `/api/locations` → `useApi<SavedLocation[]>`, `const locations = data || []`.

## Pattern Used

For array responses:
```tsx
const { data, raw, loading, error, reload } = useApi<ItemType[]>("/api/...");
const items = data || [];
const stats: StatsType = raw?.stats || { ...default };  // if stats are used
```

For object responses (e.g., health, home-management):
```tsx
const { data, raw, loading, error, reload } = useApi<DataType>("/api/...");
const field1 = data?.field1 || [];
const stats: StatsType = raw?.stats || { ...default };
```

## Rationale for `data || []` Pattern

The spec example showed `const { data: items, raw, ... } = useApi<ItemType[]>(...)` which would leave `items` nullable (`ItemType[] | null`). However, downstream code in these components uses non-null methods like `items.map`, `items.filter`, `items.forEach`, `items.length`. Under TypeScript strict mode (`tsconfig.json` has `"strict": true`), making `items` nullable would require many downstream changes (e.g., `(items || []).map`, `items?.length ?? 0`).

The chosen pattern `const { data, ... } = useApi<...>(...); const items = data || [];` achieves all spec goals:
- Fixes the bug (no more `resp?.data`)
- Provides `raw` for `raw?.stats`, `raw?.meta`, `raw?.total`, `raw?.count`
- Keeps TypeScript types correct (no nullable-array errors)
- Minimizes downstream code changes (component behavior unchanged)

For `recycle-bin.tsx`, the downstream variable was already named `data` (conflicting with useApi's `data` field), so we kept `data: resp` rename and derived `const data = resp || ({} as RecycleData)`.

## Verification

- `bun run lint` — passes with no errors
- Grep confirms no remaining `resp?.` access patterns in the sections folder (except the intentional `data: resp` rename in recycle-bin.tsx)
- Grep confirms no remaining `useApi<ApiResponse>` calls in the sections folder
- Dev server log shows successful compiles with no errors/warnings
