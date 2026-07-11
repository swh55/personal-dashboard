"use client";

import * as React from "react";
import {
  RefreshCw,
  CircleAlert,
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Wallet,
  Receipt,
  Users,
  CalendarDays,
  PhoneCall,
  Smile,
  ListTodo,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useApi, toast } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCurrency, EXPENSE_CATEGORIES, TASK_CATEGORIES } from "@/lib/constants";

interface SpendingTrendPoint {
  date: string;
  total: number;
}
interface CategoryBreakdownPoint {
  category: string;
  total: number;
}
interface HappinessTrendPoint {
  date: string;
  score: number;
}
interface TaskStats {
  total: number;
  done: number;
  doing: number;
  todo: number;
  completionRate: number;
}
interface AnalyticsData {
  spendingTrend: SpendingTrendPoint[];
  categoryBreakdown: CategoryBreakdownPoint[];
  taskStats: TaskStats;
  taskByCategory: Record<string, { total: number; done: number }>;
  happinessTrend: HappinessTrendPoint[];
  overview: {
    totalExpenses: number;
    totalSpend: number;
    contacts: number;
    events: number;
    callLogs: number;
    diary: number;
    avgHappiness: number;
  };
}

const PIE_PALETTE = [
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#f97316",
  "#14b8a6",
  "#64748b",
];

function expenseCategoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;
}
function taskCategoryLabel(value: string): string {
  return TASK_CATEGORIES.find((c) => c.value === value)?.label || value;
}
function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-SY", { month: "short", day: "numeric" });
}

export function AnalyticsSection() {
  const [days, setDays] = React.useState(30);
  const { data, loading, error, reload } = useApi<AnalyticsData>(
    `/api/analytics?days=${days}`
  );

  const spendingData = React.useMemo(
    () =>
      (data?.spendingTrend || []).map((p) => ({
        date: shortDate(p.date),
        total: p.total,
      })),
    [data]
  );

  const categoryData = React.useMemo(
    () =>
      (data?.categoryBreakdown || []).map((p) => ({
        name: expenseCategoryLabel(p.category),
        value: p.total,
        category: p.category,
      })),
    [data]
  );

  const happinessData = React.useMemo(
    () =>
      (data?.happinessTrend || []).map((p) => ({
        date: shortDate(p.date),
        score: p.score,
      })),
    [data]
  );

  const taskByCatList = React.useMemo(() => {
    if (!data?.taskByCategory) return [];
    return Object.entries(data.taskByCategory)
      .map(([cat, v]) => ({
        category: cat,
        label: taskCategoryLabel(cat),
        total: v.total,
        done: v.done,
        pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <div className="flex h-full flex-col gap-1">
      <header className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">التحليلات</h2>
          <p className="text-sm text-muted-foreground">
            نظرة شاملة على الإنفاق والمهام والسعادة
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ToggleGroup
            type="single"
            value={String(days)}
            onValueChange={(v) => v && setDays(Number(v))}
            className="rounded-lg border border-border/60 p-0.5"
          >
            <ToggleGroupItem value="7" className="h-8 px-2 text-xs">
              7 أيام
            </ToggleGroupItem>
            <ToggleGroupItem value="30" className="h-8 px-2 text-xs">
              30 يوم
            </ToggleGroupItem>
            <ToggleGroupItem value="90" className="h-8 px-2 text-xs">
              90 يوم
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1 custom-scroll -mx-1 px-1">
        {loading ? (
          <div className="grid gap-1">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
            <div className="grid gap-1 lg:grid-cols-2">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertTitle>تعذّر تحميل التحليلات</AlertTitle>
            <AlertDescription className="flex items-center gap-1">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : !data ? (
          <Alert>
            <CircleAlert className="size-4" />
            <AlertTitle>لا توجد بيانات</AlertTitle>
            <AlertDescription>لم يتم العثور على بيانات تحليلية.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Overview stat cards */}
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
              <OverviewTile
                icon={Wallet}
                label="إجمالي الإنفاق"
                value={formatCurrency(data.overview.totalSpend, "syp")}
                accent="text-rose-400"
              />
              <OverviewTile
                icon={Receipt}
                label="عدد المصروفات"
                value={String(data.overview.totalExpenses)}
                accent="text-amber-glow"
              />
              <OverviewTile
                icon={Users}
                label="جهات الاتصال"
                value={String(data.overview.contacts)}
                accent="text-blue-400"
              />
              <OverviewTile
                icon={CalendarDays}
                label="الأحداث"
                value={String(data.overview.events)}
                accent="text-violet-400"
              />
              <OverviewTile
                icon={PhoneCall}
                label="سجلات المكالمات"
                value={String(data.overview.callLogs)}
                accent="text-cyan-400"
              />
              <OverviewTile
                icon={Smile}
                label="متوسط السعادة"
                value={`${data.overview.avgHappiness} / 10`}
                accent="text-emerald-glow"
              />
            </div>

            {/* Spending trend chart */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1 text-sm">
                  <LineIcon className="size-4 text-emerald-glow" />
                  اتجاه الإنفاق — آخر {days} يوماً
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {spendingData.length === 0 ? (
                  <EmptyChartState message="لا مصروفات في هذه الفترة" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={spendingData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                        <defs>
                          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          stroke="oklch(0.7 0 0)"
                          interval="preserveStartEnd"
                          minTickGap={20}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="oklch(0.7 0 0)"
                          tickFormatter={(v: number) =>
                            v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                          }
                        />
                        <Tooltip
                          formatter={(v: number) => [formatCurrency(v, "syp"), "الإنفاق"]}
                          contentStyle={{ direction: "rtl", fontSize: "12px", borderRadius: "8px" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="total"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#spendGradient)"
                          dot={false}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-1 lg:grid-cols-2">
              {/* Category breakdown */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1 text-sm">
                    <PieIcon className="size-4 text-amber-glow" />
                    توزيع الإنفاق حسب الفئة
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {categoryData.length === 0 ? (
                    <EmptyChartState message="لا بيانات للتصنيف" />
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {categoryData.map((_, i) => (
                              <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number, _n: string, item: any) => [
                              formatCurrency(v, "syp"),
                              item.payload.name,
                            ]}
                            contentStyle={{ direction: "rtl", fontSize: "12px", borderRadius: "8px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Task stats + completion */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1 text-sm">
                    <ListTodo className="size-4 text-violet-400" />
                    إحصاءات المهام
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <StatPill label="الإجمالي" value={data.taskStats.total} />
                    <StatPill label="منجزة" value={data.taskStats.done} tone="emerald" />
                    <StatPill label="قيد التنفيذ" value={data.taskStats.doing} tone="amber" />
                    <StatPill label="معلّقة" value={data.taskStats.todo} tone="muted" />
                  </div>
                  <div className="mt-2">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">نسبة الإنجاز</span>
                      <span className="font-semibold text-emerald-glow">
                        {data.taskStats.completionRate}%
                      </span>
                    </div>
                    <Progress
                      value={data.taskStats.completionRate}
                      className="h-2.5 [&>[data-slot=progress-indicator]]:bg-emerald-glow"
                    />
                  </div>
                  {taskByCatList.length === 0 ? (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      لا توجد مهام مصنّفة
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-1">
                      {taskByCatList.map((c) => (
                        <div key={c.category} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{c.label}</span>
                            <span className="text-muted-foreground">
                              {c.done} / {c.total}{" "}
                              <span className="text-emerald-glow">({c.pct}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-glow to-amber-glow transition-all"
                              style={{ width: `${c.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Happiness trend */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1 text-sm">
                  <Smile className="size-4 text-amber-glow" />
                  مؤشر السعادة اليومي
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {happinessData.length === 0 ? (
                  <EmptyChartState message="لا سجلات سعادة في هذه الفترة" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={happinessData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          stroke="oklch(0.7 0 0)"
                          interval="preserveStartEnd"
                          minTickGap={20}
                        />
                        <YAxis
                          domain={[0, 10]}
                          ticks={[0, 2, 4, 6, 8, 10]}
                          tick={{ fontSize: 10 }}
                          stroke="oklch(0.7 0 0)"
                        />
                        <Tooltip
                          formatter={(v: number) => [`${v} / 10`, "السعادة"]}
                          contentStyle={{ direction: "rtl", fontSize: "12px", borderRadius: "8px" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "#f59e0b" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function OverviewTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col gap-1 p-1">
        <div className="flex items-center justify-between">
          <Icon className={`size-4 ${accent}`} />
        </div>
        <span className="text-base font-bold leading-tight">{value}</span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "emerald" | "amber" | "muted";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-glow"
      : tone === "amber"
      ? "text-amber-glow"
      : tone === "muted"
      ? "text-muted-foreground"
      : "";
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
      <div className={"text-base font-bold leading-none " + toneCls}>
        {value.toLocaleString("en-US")}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-1 text-center">
      <BarChart3 className="size-6 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
