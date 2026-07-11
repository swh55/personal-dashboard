"use client";

import * as React from "react";
import {
  Home,
  Calendar,
  ListTodo,
  Users,
  Phone,
  StickyNote,
  Repeat,
  Wallet,
  Coins,
  Landmark,
  PieChart,
  CreditCard,
  FolderKanban,
  Users2,
  Moon,
  HeartPulse,
  BookOpen,
  Gift,
  MapPin,
  House,
  Trash2,
  Hourglass,
  Bell,
  Send,
  Zap,
  Plug,
  BarChart3,
  Trophy,
  Brain,
  BellRing,
  Lightbulb,
  Timer,
  Bot,
  Activity,
  Settings,
  Palette,
  Smartphone,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useFloatingPanelStore,
  type PanelId,
} from "@/store/use-floating-panel";
import { cn } from "@/lib/utils";
import { isNative } from "@/lib/native/bridge";
import AppDrawer from "@/lib/native/app-drawer";

/* ------------------------------------------------------------------ */
/*  Navigation config                                                  */
/* ------------------------------------------------------------------ */

interface NavItem {
  id: PanelId;
  label: string;
  icon: LucideIcon;
}

// ALL sections in the order they appear in the bottom dock.
// The dock shows ~8 at a time and scrolls horizontally for the rest.
const ALL_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "الرئيسية", icon: Home },
  { id: "tasks", label: "المهام", icon: ListTodo },
  { id: "calendar", label: "التقويم", icon: Calendar },
  { id: "contacts", label: "الاتصالات", icon: Users },
  { id: "callpad", label: "الهاتف", icon: Phone },
  { id: "notes", label: "الملاحظات", icon: StickyNote },
  { id: "expenses", label: "المصروفات", icon: Wallet },
  { id: "finances", label: "المالية", icon: Coins },
  { id: "accounts", label: "الحسابات", icon: Landmark },
  { id: "budget", label: "الميزانية", icon: PieChart },
  { id: "debts", label: "الديون", icon: CreditCard },
  { id: "projects", label: "المشاريع", icon: FolderKanban },
  { id: "meetings", label: "الاجتماعات", icon: Users2 },
  { id: "habits", label: "العادات", icon: Repeat },
  { id: "islamic", label: "الإسلامية", icon: Moon },
  { id: "health", label: "الصحة", icon: HeartPulse },
  { id: "diary", label: "اليوميات", icon: BookOpen },
  { id: "occasions", label: "المناسبات", icon: Gift },
  { id: "maps", label: "الأماكن", icon: MapPin },
  { id: "home", label: "المنزل", icon: House },
  { id: "waitinglist", label: "الانتظار", icon: Hourglass },
  { id: "reminders", label: "التذكيرات", icon: Bell },
  { id: "scheduledmsgs", label: "الرسائل", icon: Send },
  { id: "automation", label: "الأتمتة", icon: Zap },
  { id: "integrations", label: "التكاملات", icon: Plug },
  { id: "analytics", label: "التحليلات", icon: BarChart3 },
  { id: "gamification", label: "التحفيز", icon: Trophy },
  { id: "aiinsights", label: "رؤى ذكية", icon: Brain },
  { id: "smartnotifs", label: "الإشعارات", icon: BellRing },
  { id: "suggestions", label: "الاقتراحات", icon: Lightbulb },
  { id: "pomodoro", label: "بومودورو", icon: Timer },
  { id: "ai", label: "المساعد", icon: Bot },
  { id: "activity", label: "النشاط", icon: Activity },
  { id: "recyclebin", label: "السلة", icon: Trash2 },
  { id: "settings", label: "الإعدادات", icon: Settings },
  { id: "appearance", label: "المظهر", icon: Palette },
  { id: "device", label: "الجهاز", icon: Smartphone },
];

/* ------------------------------------------------------------------ */
/*  Swipe-up gesture hook                                               */
/* ------------------------------------------------------------------ */

function useSwipeUpToOpenApps() {
  React.useEffect(() => {
    if (!isNative()) return;

    let startY: number | null = null;
    let startX: number | null = null;
    let startTime: number = 0;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Only detect swipes starting from the bottom 40px of the screen
      if (touch.clientY > window.innerHeight - 40) {
        startY = touch.clientY;
        startX = touch.clientX;
        startTime = Date.now();
      } else {
        startY = null;
        startX = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY === null) return;
      const touch = e.touches[0];
      const deltaY = startY - touch.clientY; // positive = upward
      // If user swiped up more than 60px within 500ms, trigger
      if (deltaY > 60 && Date.now() - startTime < 500) {
        // Prevent default to avoid scrolling
        e.preventDefault();
        // Open the app drawer
        AppDrawer.openAppDrawer().catch(() => {});
        // Reset to avoid repeated triggers
        startY = null;
        startX = null;
      }
    };

    const onTouchEnd = () => {
      startY = null;
      startX = null;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);
}

/* ------------------------------------------------------------------ */
/*  Permanent bottom dock (horizontal scrollable, 8 icons visible)     */
/* ------------------------------------------------------------------ */

function BottomDock() {
  const { activePanel, setPanel } = useFloatingPanelStore();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLButtonElement>(null);

  // Scroll active item into view when panel changes
  React.useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const item = activeRef.current;
      const itemLeft = item.offsetLeft;
      const itemWidth = item.offsetWidth;
      const containerWidth = container.clientWidth;
      // Center the active item
      container.scrollTo({
        left: itemLeft - containerWidth / 2 + itemWidth / 2,
        behavior: "smooth",
      });
    }
  }, [activePanel]);

  return (
    <nav
      className="sticky bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-lg"
      aria-label="التنقل بين الأقسام"
    >
      {/* Swipe-up handle indicator */}
      {isNative() && (
        <div className="flex justify-center pt-1">
          <div className="h-0.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>
      )}

      {/* Horizontal scrollable icons */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scroll-smooth scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {ALL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              ref={isActive ? activeRef : null}
              onClick={() => setPanel(item.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "flex shrink-0 flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                isActive
                  ? "text-emerald-glow"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={{ width: "calc(100% / 8)", minWidth: 44, height: 48 }}
            >
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-all",
                  isActive
                    ? "bg-emerald-glow/15 shadow-[0_0_10px_-2px_var(--emerald-glow)]"
                    : "",
                )}
              >
                <Icon className="size-4" />
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell                                                              */
/* ------------------------------------------------------------------ */

export function SingleScreenShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activePanel } = useFloatingPanelStore();

  const currentItem = ALL_NAV_ITEMS.find((i) => i.id === activePanel);
  const panelLabel = currentItem?.label ?? "الرئيسية";
  const PanelIcon = currentItem?.icon ?? Home;

  // Install swipe-up gesture handler
  useSwipeUpToOpenApps();

  // Scroll to top whenever the active panel changes.
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activePanel]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Compact top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 rounded-md bg-emerald-glow/30 blur-sm" />
            <div className="relative flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-glow to-amber-glow text-sm font-bold text-background">
              ع
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <PanelIcon className="size-4 text-emerald-glow" />
          <h1 className="text-sm font-bold">{panelLabel}</h1>
        </div>

        {/* Quick actions */}
        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            onClick={() => useFloatingPanelStore.getState().setPanel("pomodoro")}
            aria-label="بومودورو"
          >
            <Timer className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            onClick={() => useFloatingPanelStore.getState().setPanel("ai")}
            aria-label="المساعد الذكي"
          >
            <Bot className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            onClick={() => useFloatingPanelStore.getState().setPanel("smartnotifs")}
            aria-label="الإشعارات"
          >
            <BellRing className="size-4" />
          </Button>
        </div>
      </header>

      {/* Scrollable content area */}
      <main className="flex-1 p-2 md:p-3">{children}</main>

      {/* Permanent bottom dock — replaces sidebar + More drawer */}
      <BottomDock />
    </div>
  );
}
