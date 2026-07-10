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
  Menu,
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

const QUICK_ACTIONS: { id: PanelId; label: string; icon: LucideIcon }[] = [
  { id: "pomodoro", label: "بومودورو", icon: Timer },
  { id: "ai", label: "المساعد الذكي", icon: Bot },
  { id: "smartnotifs", label: "الإشعارات", icon: BellRing },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-emerald-glow/15 text-emerald-glow shadow-[inset_0_0_0_1px_var(--emerald-glow)] hover:bg-emerald-glow/20 hover:text-emerald-glow"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-emerald-glow" : "text-muted-foreground",
        )}
      />
      <span className="truncate">{item.label}</span>
      {active && (
        <span className="ms-auto size-1.5 rounded-full bg-emerald-glow shadow-[0_0_8px_var(--emerald-glow)]" />
      )}
    </Button>
  );
}

function SidebarContent() {
  const { activePanel, setPanel } = useFloatingPanelStore();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-emerald-glow/30 blur-md" />
          <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-glow to-amber-glow text-lg font-bold text-background">
            ع
          </div>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold">لوحة التحكم</span>
          <span className="text-xs text-muted-foreground">الشخصية</span>
        </div>
      </div>

      {/* Nav sections */}
      <ScrollArea className="custom-scroll flex-1 px-2 py-3">
        <nav className="flex flex-col gap-5 px-1 pb-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <h3 className="px-3 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground/70">
                {section.title}
              </h3>
              {section.items.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activePanel === item.id}
                  onClick={() => setPanel(item.id)}
                />
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
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
  const { activePanel, sidebarOpen, setSidebarOpen, setPanel } =
    useFloatingPanelStore();

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
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar (right side in RTL) */}
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 border-s border-border/60 bg-card/30 backdrop-blur md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="right"
          className="w-[280px] gap-0 p-0 sm:max-w-[280px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>القائمة الرئيسية</SheetTitle>
            <SheetDescription>
              اختر القسم الذي تريد فتحه من لوحة التحكم
            </SheetDescription>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu className="size-5" />
          </Button>

          <div className="flex items-center gap-2">
            <PanelIcon className="size-5 text-emerald-glow" />
            <h1 className="text-base font-bold md:text-lg">{panelLabel}</h1>
          </div>

          {/* Quick actions */}
          <div className="ms-auto flex items-center gap-1.5">
            {QUICK_ACTIONS.map((qa) => {
              const Icon = qa.icon;
              const isActive = activePanel === qa.id;
              return (
                <Button
                  key={qa.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setPanel(qa.id)}
                  aria-label={qa.label}
                  className={cn(
                    "gap-1.5 rounded-lg",
                    isActive
                      ? "bg-emerald-glow text-background hover:bg-emerald-glow/90"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden lg:inline">{qa.label}</span>
                </Button>
              );
            })}
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 p-4 md:p-6">{children}</main>

        {/* Sticky footer */}
        <footer className="mt-auto border-t border-border/60 bg-background/60 px-4 py-3 md:px-6">
          <p className="text-center text-xs text-muted-foreground">
            © 2025 لوحة التحكم الشخصية
          </p>
        </footer>
      </div>
    </div>
  );
}
