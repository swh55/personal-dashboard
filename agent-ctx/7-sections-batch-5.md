# Task ID 7 — sections-batch-5

## Files created
All in `/home/z/my-project/src/components/dashboard/sections/`:

1. `scheduled-messages.tsx` — `ScheduledMessagesSection`
   - Calls `/api/scheduled-messages`
   - Stats: total / pending / sent
   - Tabs: all / pending / sent with live counts
   - Message cards: recipient + channel badge (whatsapp=emerald, sms=blue, telegram=cyan, email=violet, with Lucide icons MessageCircle/MessageSquare/Send/Mail), message preview (3-line clamp), scheduled date formatted + countdown ("بعد X يوم و Y س" if future, "متأخرة" if past & pending, "مُرسَلة [time]" badge if sent)
   - 30s interval re-render for countdown refresh
   - Mark-as-sent button → PUT {id, sent:true, sentAt:now}
   - Add/Edit Dialog (recipient, message textarea, channel select, datetime-local) — POST/PUT
   - Delete confirm AlertDialog (soft delete via DELETE ?id)
   - Loading Skeletons (5 rows), error Alert+retry, empty state with Inbox icon + CTA

2. `waiting-list.tsx` — `WaitingListSection`
   - Calls `/api/waiting-list` (uses `data` + `meta` from response)
   - Stats: total / ready / pending
   - Tabs: all / ready / pending with live counts
   - Items already sorted by priority (highest first) per API
   - Item cards: 5 stars (filled in priority color: rose for 4-5, amber for 3, blue for 3, emerald for 2, slate for 1), priority label badge, title (line-through when ready), description (2-line clamp), createdAt timeAgo
   - Switch for ready toggle → PUT {id, ready}
   - Add/Edit Dialog (title, description textarea, priority select 1-5 with star preview, ready switch) — POST/PUT
   - Delete confirm AlertDialog (hard delete via DELETE ?id)
   - Loading Skeletons (5 rows), error Alert+retry, empty state with ListChecks icon + CTA

3. `contact-reminders.tsx` — `ContactRemindersSection`
   - Calls `/api/contact-reminders` (uses `data` + `meta`)
   - Stats: total / overdue / active (computed client-side from data)
   - Tabs: all / due (overdue only) / active
   - Reminder cards: contact name + frequency badge (daily=emerald/weekly=blue/monthly=violet, with Calendar/CalendarDays/CalendarRange icons), active/inactive badge, last contacted (date + timeAgo), next reminder (date + days-until badge: rose if overdue, amber if ≤1 day, muted otherwise)
   - Active toggle Switch → PUT {id, active}
   - "تم التواصل" button → PUT {id, lastContacted: now} (recomputes nextReminder server-side)
   - Add/Edit Dialog (contactName, frequency select, lastContacted date, nextReminder date, active switch) — POST/PUT
   - Delete confirm AlertDialog (hard delete via DELETE ?id)
   - Loading Skeletons (4 cards), error Alert+retry, empty state with Bell icon + CTA

4. `appearance.tsx` — `AppearanceSection`
   - Uses `@/hooks/use-app-settings` (client store) + syncs to `/api/appearance` via PUT
   - Uses `next-themes` for theme application (mounted pattern)
   - Theme section: 2 big buttons (dark/light) with icon tiles (Moon/Sun), highlight current with emerald-glow border + check mark, calls setStoreTheme + setRenderedTheme + PUT
   - Accent color section: 6 swatches (emerald, amber, rose, blue, violet, slate) — grid 3 cols mobile / 6 cols desktop, current shows check + ring shadow, calls setAccent + PUT
   - Font preview section: shows Arabic sample text in Cairo (`font-arabic`), username input + save button (calls setUsername + PUT)
   - Live preview card: Card with title + sample body + primary button (inline `--primary` override) + outline/ghost buttons + custom badge + accent-colored progress bar at 62%
   - "Restore default" button in header (sets dark + emerald)
   - Toast feedback on every change
   - Card sections separated by Separator
   - Mounted-Skeleton loading state

5. `home-management.tsx` — `HomeManagementSection`
   - Calls `/api/home` (returns pantry + waitingList + lowStock + stats: {totalItems, lowStockCount, waitingReady, waitingPending, byCategory})
   - Stats: total pantry items, low stock count, waiting ready, waiting pending (4 cards, 2 cols mobile / 4 cols desktop)
   - Pantry section:
     - Filter Card: category Select (all + 8 categories) + low-stock-only Switch (Separator between)
     - Pantry grid: name + low-stock badge (rose) + category badge (color-coded by category), quantity display + unit, +/- quick buttons (decrement disabled when quantity=0), PUT {id, quantity} — uses busyId state to disable while saving
     - Add/Edit Dialog (name, quantity number, unit select [piece/kg/g/l/ml/pack], lowStock number, category select [8 categories]) — POST/PUT
     - Delete confirm AlertDialog (hard delete via DELETE ?id)
   - Waiting list preview: top 3 items with priority stars + ready/pending badge, click → setPanel('waitinglist') via useFloatingPanelStore
   - Empty states for both pantry (filtered) and waiting list preview
   - Loading Skeletons (filter card + 6 grid cards + waiting card)

## Pattern compliance
- All 5 files: `"use client"` at top
- Named exports matching spec: `ScheduledMessagesSection`, `WaitingListSection`, `ContactRemindersSection`, `AppearanceSection`, `HomeManagementSection`
- Flex h-full layout with header + ScrollArea (`custom-scroll`) for overflow
- Skeleton loaders, Alert + retry, icon+message+CTA empty states
- Toast feedback for every mutation
- Arabic throughout, RTL-aware (dir="ltr" for datetime-local / date inputs / numbers / star rows; dir="auto" for user content)
- Existing shadcn/ui only: Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Textarea, Badge, Skeleton, Alert, ScrollArea, Switch, Separator, Tabs, Select, Dialog, AlertDialog
- Lucide icons throughout
- Uses `useApi` + `reload()` for data fetching

## Lint & type-check
- `bun run lint` → exit 0, no errors
- `bunx tsc --noEmit` → no errors related to my 5 files (remaining errors are about other section/widget files outside Task 7 scope: gamification, analytics, smart-notifications, pomodoro widget, ai-assistant widget, smart-notifications widget)
- `dev.log` → only remaining errors are about widgets outside my scope
