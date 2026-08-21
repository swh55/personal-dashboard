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
  BarChart3,
  Trophy,
  Brain,
  BellRing,
  Timer,
  Bot,
  Activity,
  Settings,
  Palette,
  Smartphone,
  Plus,
  ChevronUp,
  ChevronDown,
  CalendarPlus,
  ClipboardList,
  UsersRound,
  DollarSign,
  BookHeart,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useFloatingPanelStore,
  type PanelId,
} from "@/store/use-floating-panel";
import { cn } from "@/lib/utils";
import { isNative } from "@/lib/native/bridge";
import { AuthButton } from "@/components/dashboard/auth-button";
import AppDrawer from "@/lib/native/app-drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Navigation config                                                  */
/* ------------------------------------------------------------------ */

interface NavItem {
  id: PanelId;
  label: string;
  icon: LucideIcon;
}

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
  { id: "analytics", label: "التحليلات", icon: BarChart3 },
  { id: "gamification", label: "التحفيز", icon: Trophy },
  { id: "aiinsights", label: "رؤى ذكية", icon: Brain },
  { id: "smartnotifs", label: "الإشعارات", icon: BellRing },
  { id: "pomodoro", label: "بومودورو", icon: Timer },
  { id: "ai", label: "المساعد", icon: Bot },
  { id: "activity", label: "النشاط", icon: Activity },
  { id: "recyclebin", label: "السلة", icon: Trash2 },
  { id: "settings", label: "الإعدادات", icon: Settings },
  { id: "appearance", label: "المظهر", icon: Palette },
  { id: "device", label: "الجهاز", icon: Smartphone },
];

// Quick-add actions
const QUICK_ACTIONS: { label: string; icon: LucideIcon; panel: PanelId; color: string }[] = [
  { label: "موعد", icon: CalendarPlus, panel: "calendar", color: "text-emerald-500" },
  { label: "مهمة", icon: ClipboardList, panel: "tasks", color: "text-blue-500" },
  { label: "اجتماع", icon: UsersRound, panel: "meetings", color: "text-violet-500" },
  { label: "مصروف", icon: DollarSign, panel: "expenses", color: "text-amber-500" },
  { label: "ملاحظة", icon: StickyNote, panel: "notes", color: "text-rose-500" },
  { label: "مناسبة", icon: Gift, panel: "occasions", color: "text-pink-500" },
  { label: "تذكير", icon: Bell, panel: "reminders", color: "text-cyan-500" },
  { label: "قراءة", icon: BookHeart, panel: "islamic", color: "text-teal-500" },
];

/* ------------------------------------------------------------------ */
/*  Swipe-up gesture hook                                               */
/* ------------------------------------------------------------------ */

function useSwipeUpToOpenApps() {
  React.useEffect(() => {
    if (!isNative()) return;
    let startY: number | null = null;
    let startTime: number = 0;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientY > window.innerHeight - 20) {
        startY = touch.clientY;
        startTime = Date.now();
      } else {
        startY = null;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY === null) return;
      const touch = e.touches[0];
      const deltaY = startY - touch.clientY;
      if (deltaY > 50 && Date.now() - startTime < 500) {
        e.preventDefault();
        AppDrawer.openAppDrawer().catch(() => {});
        startY = null;
      }
    };
    const onTouchEnd = () => { startY = null; };

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
/*  Collapsible bottom dock — 8 columns, all icons when expanded        */
/* ------------------------------------------------------------------ */

function BottomDock() {
  const { activePanel, setPanel } = useFloatingPanelStore();
  const [expanded, setExpanded] = React.useState(false);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  // When collapsed, show first 7 items + expand button
  const collapsedItems = ALL_NAV_ITEMS.slice(0, 7);

  return (
    <>
      <nav
        className="sticky bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-lg"
        aria-label="التنقل بين الأقسام"
      >
        {isNative() && (
          <div className="flex justify-center pt-0.5">
            <div className="h-0.5 w-8 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {expanded ? (
          /* Expanded: full 8-column grid with all icons */
          <div className="px-1 pb-1">
            <div className="grid grid-cols-8 gap-0.5">
              {ALL_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePanel === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setPanel(item.id); setExpanded(false); }}
                    aria-label={item.label}
                    title={item.label}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors",
                      isActive
                        ? "bg-emerald-glow/15 text-emerald-glow"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    )}
                    style={{ height: 48 }}
                  >
                    <Icon className="size-4" />
                    <span className="text-[9px] font-medium leading-tight line-clamp-1 max-w-full text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setQuickAddOpen(true)}
              >
                <Plus className="size-3.5" />
                إضافة سريعة
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setExpanded(false)}
              >
                <ChevronDown className="size-3.5" />
                طي
              </Button>
            </div>
          </div>
        ) : (
          /* Collapsed: 7 icons + expand toggle + quick-add */
          <div className="flex items-center px-0.5 pb-0.5">
            {collapsedItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPanel(item.id)}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                    isActive ? "text-emerald-glow" : "text-muted-foreground hover:text-foreground",
                  )}
                  style={{ height: 52 }}
                >
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg transition-all",
                      isActive ? "bg-emerald-glow/15 shadow-[0_0_8px_-2px_var(--emerald-glow)]" : "",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </button>
              );
            })}
            {/* Expand toggle */}
            <button
              onClick={() => setExpanded(true)}
              aria-label="عرض كل الأقسام"
              className="flex flex-col items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              style={{ width: 44, height: 52 }}
            >
              <ChevronUp className="size-4" />
              <span className="text-[10px] font-medium leading-none">الكل</span>
            </button>
            {/* Quick-add floating button */}
            <button
              onClick={() => setQuickAddOpen(true)}
              aria-label="إضافة سريعة"
              className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-glow to-amber-glow text-background shadow-lg transition-transform hover:scale-110"
            >
              <Plus className="size-5" />
            </button>
          </div>
        )}
      </nav>

      {/* Quick-add dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-emerald-glow" />
              إضافة سريعة
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => {
                    setPanel(action.panel);
                    setQuickAddOpen(false);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 p-2 transition-all hover:border-border hover:bg-accent/40"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent/30">
                    <Icon className={cn("size-4", action.color)} />
                  </div>
                  <span className="text-[10px] font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
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

  useSwipeUpToOpenApps();

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activePanel]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md">
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
        <div className="ms-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => useFloatingPanelStore.getState().setPanel("pomodoro")} aria-label="بومودورو">
            <Timer className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => useFloatingPanelStore.getState().setPanel("ai")} aria-label="المساعد الذكي">
            <Bot className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => useFloatingPanelStore.getState().setPanel("smartnotifs")} aria-label="الإشعارات">
            <BellRing className="size-4" />
          </Button>
          {/* Home button — opens the Android app drawer (list of all apps) */}
          {isNative() && (
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              onClick={() => AppDrawer.openAppDrawer().catch(() => {})}
              aria-label="تطبيقات الهاتف"
            >
              <LayoutGrid className="size-4" />
            </Button>
          )}
          <AuthButton />
        </div>
      </header>

      <main className="flex-1 p-2 md:p-3">{children}</main>

      <BottomDock />
    </div>
  );
}
