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
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  useFloatingPanelStore,
  type PanelId,
} from "@/store/use-floating-panel";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Navigation config                                                  */
/* ------------------------------------------------------------------ */

interface NavItem {
  id: PanelId;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "رئيسية",
    items: [
      { id: "overview", label: "الرئيسية", icon: Home },
      { id: "calendar", label: "التقويم", icon: Calendar },
    ],
  },
  {
    title: "أعمال",
    items: [
      { id: "tasks", label: "المهام", icon: ListTodo },
      { id: "contacts", label: "جهات الاتصال", icon: Users },
      { id: "callpad", label: "لوحة الاتصال", icon: Phone },
      { id: "notes", label: "الملاحظات", icon: StickyNote },
      { id: "projects", label: "المشاريع", icon: FolderKanban },
      { id: "meetings", label: "الاجتماعات", icon: Users2 },
      { id: "waitinglist", label: "قائمة الانتظار", icon: Hourglass },
      { id: "reminders", label: "تذكيرات التواصل", icon: Bell },
    ],
  },
  {
    title: "مالية",
    items: [
      { id: "expenses", label: "المصروفات", icon: Wallet },
      { id: "finances", label: "المالية", icon: Coins },
      { id: "accounts", label: "الحسابات", icon: Landmark },
      { id: "budget", label: "الميزانية", icon: PieChart },
      { id: "debts", label: "الديون", icon: CreditCard },
    ],
  },
  {
    title: "شخصي",
    items: [
      { id: "habits", label: "العادات", icon: Repeat },
      { id: "islamic", label: "الإسلامية", icon: Moon },
      { id: "health", label: "الصحة", icon: HeartPulse },
      { id: "diary", label: "اليوميات", icon: BookOpen },
      { id: "occasions", label: "المناسبات", icon: Gift },
      { id: "maps", label: "الأماكن", icon: MapPin },
      { id: "home", label: "إدارة المنزل", icon: House },
    ],
  },
  {
    title: "نظام",
    items: [
      { id: "recyclebin", label: "سلة المحذوفات", icon: Trash2 },
      { id: "scheduledmsgs", label: "الرسائل المجدولة", icon: Send },
      { id: "automation", label: "الأتمتة", icon: Zap },
      { id: "integrations", label: "التكاملات", icon: Plug },
      { id: "analytics", label: "التحليلات", icon: BarChart3 },
      { id: "gamification", label: "التحفيز", icon: Trophy },
      { id: "aiinsights", label: "التحليلات الذكية", icon: Brain },
      { id: "smartnotifs", label: "الإشعارات الذكية", icon: BellRing },
      { id: "suggestions", label: "الاقتراحات", icon: Lightbulb },
      { id: "pomodoro", label: "بومودورو", icon: Timer },
      { id: "ai", label: "المساعد الذكي", icon: Bot },
      { id: "activity", label: "النشاط", icon: Activity },
      { id: "settings", label: "الإعدادات", icon: Settings },
      { id: "appearance", label: "المظهر", icon: Palette },
    ],
  },
];

const ALL_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

// Quick-access items shown directly in the bottom bar (max 5 + "More" button)
const BOTTOM_BAR_ITEMS: NavItem[] = [
  { id: "overview", label: "الرئيسية", icon: Home },
  { id: "tasks", label: "المهام", icon: ListTodo },
  { id: "calendar", label: "التقويم", icon: Calendar },
  { id: "contacts", label: "الاتصال", icon: Users },
  { id: "notes", label: "الملاحظات", icon: StickyNote },
];

/* ------------------------------------------------------------------ */
/*  Bottom drawer content (grid of all sections)                       */
/* ------------------------------------------------------------------ */

function DrawerContent({ onSelect }: { onSelect: () => void }) {
  const { activePanel, setPanel } = useFloatingPanelStore();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SheetHeader className="border-b border-border/60 pb-3">
        <SheetTitle className="text-lg font-bold">جميع الأقسام</SheetTitle>
        <SheetDescription className="text-xs">
          اختر القسم الذي تريد فتحه
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="custom-scroll min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4 pb-8">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-2">
              <h3 className="px-1 text-[11px] font-bold tracking-wider text-muted-foreground/70">
                {section.title}
              </h3>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setPanel(item.id);
                        onSelect();
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                        isActive
                          ? "border-emerald-glow/40 bg-emerald-glow/10 text-emerald-glow"
                          : "border-border/50 bg-card/40 text-muted-foreground hover:border-border hover:bg-accent/40 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-5 shrink-0",
                          isActive ? "text-emerald-glow" : "text-muted-foreground",
                        )}
                      />
                      <span className="line-clamp-1 text-[10px] font-medium leading-tight">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bottom navigation bar                                              */
/* ------------------------------------------------------------------ */

function BottomNavBar({ onMore }: { onMore: () => void }) {
  const { activePanel, setPanel } = useFloatingPanelStore();

  return (
    <nav
      className="sticky bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-lg"
      aria-label="التنقل السريع"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-1">
        {BOTTOM_BAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPanel(item.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors",
                isActive
                  ? "text-emerald-glow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl transition-all",
                  isActive
                    ? "bg-emerald-glow/15 shadow-[0_0_12px_-2px_var(--emerald-glow)]"
                    : "",
                )}
              >
                <Icon className="size-5" />
              </div>
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More button */}
        <button
          onClick={onMore}
          aria-label="عرض كل الأقسام"
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent/40">
            <LayoutGrid className="size-5" />
          </div>
          <span className="text-[10px] font-medium leading-none">المزيد</span>
        </button>
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
  const { activePanel, setPanel } = useFloatingPanelStore();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const currentItem = ALL_ITEMS.find((i) => i.id === activePanel);
  const panelLabel = currentItem?.label ?? "الرئيسية";
  const PanelIcon = currentItem?.icon ?? Home;

  // Scroll to top whenever the active panel changes.
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activePanel]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md md:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-emerald-glow/30 blur-md" />
            <div className="relative flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-glow to-amber-glow text-base font-bold text-background">
              ع
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PanelIcon className="size-5 text-emerald-glow" />
          <h1 className="text-base font-bold md:text-lg">{panelLabel}</h1>
        </div>

        {/* Quick actions */}
        <div className="ms-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanel("pomodoro")}
            aria-label="بومودورو"
            className={cn(
              "gap-1.5 rounded-lg",
              activePanel === "pomodoro"
                ? "bg-emerald-glow text-background hover:bg-emerald-glow/90"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Timer className="size-4" />
            <span className="hidden sm:inline">بومودورو</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanel("ai")}
            aria-label="المساعد الذكي"
            className={cn(
              "gap-1.5 rounded-lg",
              activePanel === "ai"
                ? "bg-emerald-glow text-background hover:bg-emerald-glow/90"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Bot className="size-4" />
            <span className="hidden sm:inline">المساعد</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanel("smartnotifs")}
            aria-label="الإشعارات"
            className={cn(
              "gap-1.5 rounded-lg",
              activePanel === "smartnotifs"
                ? "bg-emerald-glow text-background hover:bg-emerald-glow/90"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BellRing className="size-4" />
            <span className="hidden sm:inline">الإشعارات</span>
          </Button>
        </div>
      </header>

      {/* Scrollable content area */}
      <main className="flex-1 p-4 md:p-6">{children}</main>

      {/* Bottom navigation bar (replaces sidebar) */}
      <BottomNavBar onMore={() => setDrawerOpen(true)} />

      {/* Bottom drawer with ALL sections */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] max-h-[85vh] gap-0 overflow-hidden p-0"
        >
          <DrawerContent onSelect={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
