"use client";

import * as React from "react";
import {
  RefreshCw,
  CircleAlert,
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCheck,
  Inbox,
  CalendarClock,
  CheckSquare,
  Banknote,
  Phone,
  Package,
  PartyPopper,
  Palmtree,
  StickyNote,
} from "lucide-react";
import { useApi, toast, timeAgo } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface SmartNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}

interface SmartNotificationsResponse {
  data: SmartNotification[];
  stats: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

type SeverityFilter = "all" | "critical" | "warning" | "info";

const SEVERITY_META: Record<
  SmartNotification["severity"],
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    borderCls: string;
    iconCls: string;
    badgeCls: string;
  }
> = {
  critical: {
    label: "حرجة",
    icon: AlertTriangle,
    borderCls: "border-r-rose-500",
    iconCls: "bg-rose-500/15 text-rose-500",
    badgeCls: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  },
  warning: {
    label: "تحذير",
    icon: AlertCircle,
    borderCls: "border-r-amber-glow",
    iconCls: "bg-amber-glow/15 text-amber-glow",
    badgeCls: "bg-amber-glow/15 text-amber-glow border-amber-glow/30",
  },
  info: {
    label: "معلومة",
    icon: Info,
    borderCls: "border-r-blue-400",
    iconCls: "bg-blue-400/15 text-blue-400",
    badgeCls: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  },
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  event: CalendarClock,
  "task-overdue": AlertTriangle,
  "task-soon": CheckSquare,
  debt: Banknote,
  reminder: Phone,
  pantry: Package,
  occasion: PartyPopper,
  holiday: Palmtree,
};

function NotifTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPE_ICON[type] || StickyNote;
  return <Icon className={className} />;
}

export function SmartNotificationsSection() {
  const { data, loading, error, reload } = useApi<SmartNotificationsResponse>(
    "/api/smart-notifications"
  );
  const [filter, setFilter] = React.useState<SeverityFilter>("all");
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  // Auto-refresh every 60s
  React.useEffect(() => {
    const id = setInterval(() => {
      reload();
    }, 60000);
    return () => clearInterval(id);
  }, [reload]);

  const notifications = (data?.data || []).filter((n) => !dismissed.has(n.id));
  const stats = data?.stats || { total: 0, critical: 0, warning: 0, info: 0 };

  const filtered = React.useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.severity === filter);
  }, [notifications, filter]);

  function markAllRead() {
    setDismissed(new Set(notifications.map((n) => n.id)));
    toast.success("تم تعليم جميع الإشعارات كمقروءة");
  }

  function dismissOne(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bell className="size-6 text-emerald-glow" />
            الإشعارات الذكية
          </h2>
          <p className="text-sm text-muted-foreground">
            تنبيهات مجمّعة من جميع أجزاء النظام
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={notifications.length === 0}
          >
            <CheckCheck className="size-4" />
            <span className="hidden sm:inline">تعليم الكل كمقروء</span>
          </Button>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="الإجمالي" value={stats.total} icon={Bell} cls="text-foreground" />
        <StatCard
          label="حرجة"
          value={stats.critical}
          icon={AlertTriangle}
          cls="text-rose-500"
        />
        <StatCard
          label="تحذيرات"
          value={stats.warning}
          icon={AlertCircle}
          cls="text-amber-glow"
        />
        <StatCard label="معلومات" value={stats.info} icon={Info} cls="text-blue-400" />
      </div>

      {/* Filter */}
      <ToggleGroup
        type="single"
        value={filter}
        onValueChange={(v) => v && setFilter(v as SeverityFilter)}
        className="w-fit rounded-lg border border-border/60 p-0.5"
      >
        <ToggleGroupItem value="all" className="h-8 px-3 text-xs">
          الكل ({stats.total})
        </ToggleGroupItem>
        <ToggleGroupItem value="critical" className="h-8 px-3 text-xs">
          حرجة ({stats.critical})
        </ToggleGroupItem>
        <ToggleGroupItem value="warning" className="h-8 px-3 text-xs">
          تحذير ({stats.warning})
        </ToggleGroupItem>
        <ToggleGroupItem value="info" className="h-8 px-3 text-xs">
          معلومات ({stats.info})
        </ToggleGroupItem>
      </ToggleGroup>

      <ScrollArea className="flex-1 custom-scroll -mx-1 px-1">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertTitle>تعذّر تحميل الإشعارات</AlertTitle>
            <AlertDescription className="flex items-center gap-2">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
                <Inbox className="size-7" />
              </div>
              <div>
                <p className="font-medium">
                  {filter === "all" ? "لا توجد إشعارات" : "لا توجد إشعارات بهذه الأهمية"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filter === "all"
                    ? "أنت على اطلاع — لا توجد تنبيهات حالياً"
                    : "جرّب فلتراً آخر لعرض الإشعارات"}
                </p>
              </div>
              {filter !== "all" && (
                <Button size="sm" variant="outline" onClick={() => setFilter("all")}>
                  عرض الكل
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((n) => {
              const meta = SEVERITY_META[n.severity];
              const SevIcon = meta.icon;
              return (
                <Card
                  key={n.id}
                  className={
                    "group border-border/60 border-r-4 " + meta.borderCls +
                    " transition-colors hover:border-border"
                  }
                >
                  <CardContent className="flex items-start gap-3 p-3">
                    <div
                      className={
                        "flex size-10 shrink-0 items-center justify-center rounded-xl " +
                        meta.iconCls
                      }
                    >
                      <NotifTypeIcon type={n.type} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold leading-tight">{n.title}</p>
                        <Badge variant="outline" className={meta.badgeCls}>
                          <SevIcon className="size-3" />
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      onClick={() => dismissOne(n.id)}
                      aria-label="إخفاء"
                    >
                      <CheckCheck className="size-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  cls,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  cls: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className={"size-5 " + cls} />
        <div>
          <div className={"text-xl font-bold leading-none " + cls}>
            {value.toLocaleString("en-US")}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
