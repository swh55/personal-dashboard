"use client";

import * as React from "react";
import {
  Sun,
  Cloud,
  CloudSun,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudLightning,
  PartyPopper,
  CheckCircle2,
  ListTodo,
  Users,
  Wallet,
  CalendarDays,
  Phone,
  Bell,
  ArrowLeft,
  Sparkles,
  PhoneCall,
  Calendar,
  StickyNote,
  AlertTriangle,
  Info,
  CircleAlert,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useApi, toast, formatDate, formatTime, timeAgo } from "@/lib/api";
import {
  USER_PROFILE,
  formatCurrency,
  formatNumber,
} from "@/lib/constants";
import { useFloatingPanelStore } from "@/store/use-floating-panel";
import { PermissionsManager } from "@/components/dashboard/permissions-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ---------------- weather icon helper ---------------- */
const WEATHER_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sun,
  Cloud,
  CloudSun,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudLightning,
};

function WeatherIcon({ name, className }: { name?: string; className?: string }) {
  const Comp = (name && WEATHER_ICON_MAP[name]) || Cloud;
  return <Comp className={className} />;
}

/* ---------------- types ---------------- */
interface DashboardData {
  todayEvents: Array<{ id: string; title: string; startDate: string; endDate: string | null; allDay: boolean; color: string; type: string; location: string | null }>;
  taskStats: { pending: number; done: number; total: number; byCategory: Array<{ category: string; _count: number }> };
  contactStats: { total: number; favorites: number };
  assets: Array<{ id: string; name: string; amount: number; currency: string; type: string }>;
  totalAssetsValue: number;
  occasions: Array<{ id: string; title: string; date: string; type: string }>;
  upcomingHolidays: Array<{ date: string; name: string; type: string }>;
  todayHoliday: { date: string; name: string; type: string } | null;
  recentCalls: Array<{ id: string; name: string; phone: string; type: string; direction: string; createdAt: string }>;
}

interface WeatherData {
  current: {
    temperature: number;
    apparentTemperature?: number;
    humidity?: number;
    windSpeed?: number;
    weatherCode?: number;
    weatherDescription: string;
    weatherIcon: string;
  };
  forecast: Array<{ date: string; maxTemp: number; minTemp: number; weatherCode: number; weather: { ar: string; icon: string } }>;
  city: string;
}

interface SmartNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}

/* ---------------- component ---------------- */
export function OverviewSection() {
  const { data, loading, error, reload } = useApi<DashboardData>("/api/dashboard");
  const { data: weather } = useApi<WeatherData>("/api/weather");
  const { data: notifications } = useApi<SmartNotification[]>("/api/smart-notifications");
  const setPanel = useFloatingPanelStore((s) => s.setPanel);

  // Compute date/greeting only on the client to avoid SSR hydration mismatch
  // (server timezone may differ from the user's browser timezone).
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
  }, []);

  const hour = now?.getHours() ?? 0;
  const greeting = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء الخير";
  const dateLabel = now
    ? formatDate(now, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "—";

  const recentNotifs = (notifications || []).slice(0, 3);
  const nextOccasions = (data?.occasions || []).slice(0, 3);

  const quickActions = [
    { id: "tasks" as const, label: "المهام", icon: ListTodo },
    { id: "calendar" as const, label: "التقويم", icon: Calendar },
    { id: "contacts" as const, label: "الاتصالات", icon: Users },
    { id: "notes" as const, label: "الملاحظات", icon: StickyNote },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">نظرة عامة</h1>
          <p className="text-sm text-muted-foreground">ملخص يومك ونشاطك</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPanel("device")}>
          <Smartphone className="size-4" />
          <span className="hidden sm:inline">الجهاز</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="size-4" />
          تحديث
        </Button>
      </div>

      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-4 pb-4">
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>تعذر تحميل البيانات</AlertTitle>
              <AlertDescription>
                {error}
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => reload()}>
                    إعادة المحاولة
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Permissions manager (native only) */}
          <PermissionsManager />

          {/* hero greeting + weather + holiday */}
          <Card className="overflow-hidden border-none bg-gradient-to-l from-emerald-glow/15 via-emerald-glow/5 to-transparent">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="size-4 text-emerald-glow" />
                  {dateLabel}
                </div>
                <h2 className="text-2xl font-bold">
                  {greeting}، {USER_PROFILE.name} 👋
                </h2>
                {data?.todayHoliday ? (
                  <div className="flex items-center gap-2 text-sm text-amber-glow">
                    <PartyPopper className="size-4" />
                    عطلة اليوم: {data.todayHoliday.name}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-background/60 p-3 backdrop-blur">
                {weather ? (
                  <>
                    <WeatherIcon name={weather.current.weatherIcon} className="size-10 text-amber-glow" />
                    <div className="space-y-0.5">
                      <div className="text-2xl font-bold">{weather.current.temperature}°</div>
                      <div className="text-xs text-muted-foreground">
                        {weather.current.weatherDescription} · {weather.city}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-6 w-12" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* stat cards row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              title="مهام معلقة"
              value={loading ? null : data?.taskStats.pending ?? 0}
              icon={ListTodo}
              accent="emerald"
              onClick={() => setPanel("tasks")}
            />
            <StatCard
              title="مهام منجزة"
              value={loading ? null : data?.taskStats.done ?? 0}
              icon={CheckCircle2}
              accent="amber"
              onClick={() => setPanel("tasks")}
            />
            <StatCard
              title="جهات الاتصال"
              value={loading ? null : data?.contactStats.total ?? 0}
              icon={Users}
              accent="emerald"
              onClick={() => setPanel("contacts")}
            />
            <StatCard
              title="إجمالي الأصول"
              value={loading ? null : data?.totalAssetsValue ?? 0}
              valueIsCurrency
              icon={Wallet}
              accent="amber"
              onClick={() => setPanel("finances")}
            />
          </div>

          {/* main grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* today events */}
            <Card className="lg:col-span-2">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="size-4 text-emerald-glow" />
                    أحداث اليوم
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setPanel("calendar")}>
                    الكل
                    <ArrowLeft className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : data && data.todayEvents.length > 0 ? (
                  <ul className="divide-y">
                    {data.todayEvents.map((ev) => (
                      <li key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs font-mono text-muted-foreground min-w-[3.5rem]">
                          {ev.allDay ? "طوال اليوم" : formatTime(ev.startDate)}
                        </span>
                        <span className={`size-2.5 rounded-full ${colorClass(ev.color)}`} />
                        <span className="flex-1 text-sm font-medium">{ev.title}</span>
                        {ev.location ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[7rem]">{ev.location}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="لا أحداث اليوم"
                    desc="استمتع بيومك!"
                    actionLabel="إضافة حدث"
                    onAction={() => setPanel("calendar")}
                  />
                )}
              </CardContent>
            </Card>

            {/* smart notifications preview */}
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="size-4 text-amber-glow" />
                    تنبيهات ذكية
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setPanel("smartnotifs")}>
                    الكل
                    <ArrowLeft className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {[0, 1].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : recentNotifs.length > 0 ? (
                  <ul className="divide-y max-h-72 overflow-y-auto custom-scroll">
                    {recentNotifs.map((n) => (
                      <li key={n.id} className="flex items-start gap-3 px-4 py-2.5">
                        <NotifIcon severity={n.severity} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{n.title}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.createdAt)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={Bell} title="لا تنبيهات" desc="كل شيء تحت السيطرة" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* secondary grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* occasions */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PartyPopper className="size-4 text-amber-glow" />
                  مناسبات قادمة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {[0, 1].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : nextOccasions.length > 0 ? (
                  <ul className="divide-y">
                    {nextOccasions.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{o.title}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(o.date, { month: "long", day: "numeric" })}</div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{occasionTypeLabel(o.type)}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={PartyPopper} title="لا مناسبات" desc="أضف مناسبات قادمة" />
                )}
              </CardContent>
            </Card>

            {/* recent calls */}
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PhoneCall className="size-4 text-emerald-glow" />
                    آخر المكالمات
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setPanel("callpad")}>
                    الكل
                    <ArrowLeft className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : data && data.recentCalls.length > 0 ? (
                  <ul className="divide-y">
                    {data.recentCalls.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`text-xs ${c.direction === "missed" ? "text-destructive" : "text-muted-foreground"}`}>
                          <Phone className={`size-4 inline ${c.direction === "incoming" ? "rotate-180" : ""}`} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</div>
                        </div>
                        {c.type !== "call" ? <Badge variant="outline" className="shrink-0">{c.type}</Badge> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={Phone} title="لا مكالمات" desc="لم تسجَّل أي مكالمة بعد" />
                )}
              </CardContent>
            </Card>

            {/* quick actions */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-emerald-glow" />
                  إجراءات سريعة
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 p-4">
                {quickActions.map((qa) => (
                  <Button
                    key={qa.id}
                    variant="outline"
                    className="h-auto flex-col gap-1.5 py-3"
                    onClick={() => setPanel(qa.id)}
                  >
                    <qa.icon className="size-5 text-emerald-glow" />
                    <span className="text-xs">{qa.label}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ---------------- subcomponents ---------------- */
function StatCard({
  title,
  value,
  icon: Icon,
  accent,
  valueIsCurrency,
  onClick,
}: {
  title: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "amber";
  valueIsCurrency?: boolean;
  onClick?: () => void;
}) {
  const accentClass = accent === "emerald" ? "text-emerald-glow bg-emerald-glow/10" : "text-amber-glow bg-amber-glow/10";
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{title}</div>
          {value === null ? (
            <Skeleton className="mt-1 h-6 w-16" />
          ) : (
            <div className="text-xl font-bold truncate">
              {valueIsCurrency ? formatCurrency(value) : formatNumber(value)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NotifIcon({ severity }: { severity: "info" | "warning" | "critical" }) {
  if (severity === "critical") return <AlertTriangle className="size-4 mt-0.5 text-destructive shrink-0" />;
  if (severity === "warning") return <CircleAlert className="size-4 mt-0.5 text-amber-glow shrink-0" />;
  return <Info className="size-4 mt-0.5 text-emerald-glow shrink-0" />;
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Icon className="size-8 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {actionLabel && onAction ? (
        <Button size="sm" variant="outline" className="mt-1" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/* ---------------- helpers ---------------- */
function colorClass(color: string): string {
  const map: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    slate: "bg-slate-500",
  };
  return map[color] || "bg-primary";
}

function occasionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    birthday: "عيد ميلاد",
    anniversary: "ذكرى سنوية",
    holiday: "عطلة",
    other: "أخرى",
  };
  return map[type] || type;
}

// silence unused import warnings for icons referenced by WEATHER_ICON_MAP only
void CloudRainWind;
void CloudDrizzle;
