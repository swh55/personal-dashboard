"use client";

import * as React from "react";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronLeft,
  Inbox,
  CalendarClock,
  CheckSquare,
  Banknote,
  Phone,
  Package,
  PartyPopper,
  Palmtree,
  StickyNote,
  RefreshCw,
} from "lucide-react";
import { useApi, timeAgo } from "@/lib/api";
import { useFloatingPanelStore } from "@/store/use-floating-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const SEVERITY_META: Record<
  SmartNotification["severity"],
  {
    Icon: React.ComponentType<{ className?: string }>;
    iconCls: string;
    borderCls: string;
    dotCls: string;
  }
> = {
  critical: {
    Icon: AlertTriangle,
    iconCls: "bg-rose-500/15 text-rose-500",
    borderCls: "border-r-rose-500",
    dotCls: "bg-rose-500",
  },
  warning: {
    Icon: AlertCircle,
    iconCls: "bg-amber-glow/15 text-amber-glow",
    borderCls: "border-r-amber-glow",
    dotCls: "bg-amber-glow",
  },
  info: {
    Icon: Info,
    iconCls: "bg-blue-400/15 text-blue-400",
    borderCls: "border-r-blue-400",
    dotCls: "bg-blue-400",
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

export function SmartNotificationsWidget() {
  const { data, loading, error, reload } = useApi<SmartNotificationsResponse>(
    "/api/smart-notifications"
  );
  const setPanel = useFloatingPanelStore((s) => s.setPanel);

  // Auto-refresh every 60s
  React.useEffect(() => {
    const id = setInterval(() => {
      reload();
    }, 60000);
    return () => clearInterval(id);
  }, [reload]);

  const notifications = data?.data || [];
  const stats = data?.stats || { total: 0, critical: 0, warning: 0, info: 0 };
  const unreadCount = stats.total;

  return (
    <div className="flex h-full flex-col gap-1">
      <header className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <div className="relative">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-glow/15 text-emerald-glow">
              <Bell className="size-5" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">الإشعارات</h2>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0
                ? `${stats.critical} حرجة · ${stats.warning} تحذير · ${stats.info} معلومة`
                : "لا إشعارات حالياً"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPanel("smartnotifs")}
          >
            عرض الكل
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </header>

      <Card className="flex min-h-0 flex-1 flex-col border-border/60">
        <CardContent className="flex min-h-0 flex-1 flex-col p-1">
          <ScrollArea className="custom-scroll min-h-0 flex-1">
            {loading ? (
              <div className="flex flex-col gap-1 p-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <Alert variant="destructive" className="m-1">
                <AlertTriangle className="size-4" />
                <AlertDescription className="flex items-center gap-1">
                  <span className="text-xs">{error}</span>
                  <Button size="sm" variant="outline" onClick={reload}>
                    إعادة
                  </Button>
                </AlertDescription>
              </Alert>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 p-8 text-center">
                <div className="flex size-7 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
                  <Inbox className="size-6" />
                </div>
                <p className="text-sm font-medium">لا إشعارات</p>
                <p className="text-xs text-muted-foreground">
                  أنت على اطلاع بكل شيء
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 p-1">
                {notifications.map((n) => {
                  const meta = SEVERITY_META[n.severity];
                  const TypeIcon = TYPE_ICON[n.type] || StickyNote;
                  return (
                    <div
                      key={n.id}
                      className={
                        "group flex items-start gap-1 rounded-lg border border-border/60 border-r-4 bg-card p-2.5 transition-colors hover:bg-muted/30 " +
                        meta.borderCls
                      }
                    >
                      <div
                        className={
                          "flex size-6 shrink-0 items-center justify-center rounded-lg " +
                          meta.iconCls
                        }
                      >
                        <TypeIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold leading-tight">
                            {n.title}
                          </p>
                          {n.severity === "critical" && (
                            <span className={"size-1.5 shrink-0 rounded-full " + meta.dotCls} />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
