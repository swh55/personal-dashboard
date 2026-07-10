# Task ID 3 — sections-batch-1

## Files created (all under /home/z/my-project/src/components/dashboard/sections/)
1. overview.tsx — OverviewSection
2. calendar-section.tsx — CalendarSection
3. callpad.tsx — CallPadSection
4. contacts.tsx — ContactsSection
5. tasks.tsx — TasksSection
6. notes.tsx — NotesSection
7. habits.tsx — HabitsSection

## Key conventions used
- "use client" at top of every file
- Named export matching filename (OverviewSection, CalendarSection, CallPadSection, ContactsSection, TasksSection, NotesSection, HabitsSection)
- useApi(url) for data fetching + reload() after mutations
- toast from "@/lib/api" for feedback
- Skeleton loaders, Alert with retry, EmptyState icon+message+CTA
- ScrollArea with custom-scroll for long lists
- RTL Arabic labels throughout
- Existing shadcn/ui components only (Card, Button, Input, Label, Textarea, Badge, Select, Dialog, AlertDialog, Skeleton, Alert, Avatar, Switch, ScrollArea)
- EVENT_COLORS, RELATION_TYPES, TASK_CATEGORIES from @/lib/constants
- useFloatingPanelStore for navigation in overview quick actions

## Lint status
- `bun run lint` passes with no errors

## Dev server log status
- Section imports for my 7 files now resolve cleanly (latest "Can't resolve" errors are only about widgets and other sections out of my scope)
