# Task ID 2 — shell-builder

## Deliverables
- `src/components/dashboard/single-screen-shell.tsx` — `SingleScreenShell({ children })`
- `src/components/dashboard/pin-lock.tsx` — `PinLockScreen({ pinCode, onUnlock })`

## Key decisions
- Used **Sheet** (not Drawer) for the mobile sidebar per the explicit "Use shadcn/ui Button, ScrollArea, Sheet (for mobile sidebar)" instruction; `side="right"` matches the RTL desktop sidebar location.
- Desktop sidebar is `sticky top-0 h-screen` so it stays in view while the page scrolls; the inner `ScrollArea` handles nav overflow.
- Outer wrapper: `flex min-h-screen w-full`. Main column: `flex flex-1 flex-col`. Footer uses `mt-auto` so it sits at viewport bottom on short content and is pushed down naturally when content overflows (per layout rules).
- Nav structure: 36 items across 5 sections (رئيسية / أعمال / مالية / شخصي / نظام), each with a Lucide icon and Arabic label. A flat `ALL_ITEMS` lookup derives the current panel name + icon for the header.
- Quick actions in header: Pomodoro, AI Assistant, Smart Notifications (call `setPanel`).
- PinLockScreen uses refs (`entryRef`, `errorRef`, `pinRef`, `unlockRef`) behind a stable `press` callback so the global keydown listener and rapid taps never see stale state. Wrong PIN triggers a CSS `pin-shake` animation (keyframes injected via `<style dangerouslySetInnerHTML>`), with the dots row remounted via `key={shakeKey}` so the animation replays on each retry.
- Keypad and dots use `dir="ltr"` so 1-9 read left-to-right (universal PIN convention) even though the app is RTL.

## Lint / build status
- `bun run lint` → clean (no errors).
- Dev log only shows pre-existing `page.tsx` Module-not-found errors for section/widget files that other agents will create. My two imports resolve fine.

## Out-of-scope note for the main agent
`src/app/page.tsx` currently does `const { settings, unlocked, unlock } = useAppSettings()` but the actual store (`src/hooks/use-app-settings.ts`) exposes a **flat** shape (`{ loaded, pinEnabled, pinCode, unlocked, unlock, ... }`). page.tsx should be updated to destructure the flat fields; otherwise `settings` is `undefined` and the PIN lock / loading gate won't work. Not part of Task 2.
