"use client";

import * as React from "react";
import {
  RefreshCw,
  CircleAlert,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Clock,
  Calendar,
  Lightbulb,
  Brain,
  Minus,
  Sparkles,
  Activity,
  ListTodo,
  BarChart3,
} from "lucide-react";
import { useApi, formatDate, formatDateTime, toast } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/constants";

interface SpendingPattern {
  category: string;
  total: number;
  count: number;
  average: number;
  budget: number | null;
  percentOfBudget: number | null;
  trend: "up" | "down" | "stable";
  insight: string;
}

interface TaskSuggestion {
  type: string;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  relatedTaskId?: string;
}

interface BestTime {
  type: "hour" | "day";
  label: string;
  value: number;
  count: number;
  recommendation: string;
}

interface PredictiveAlert {
  severity: "critical" | "warning" | "info";
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

interface AiInsightsData {
  spendingPatterns: SpendingPattern[];
  taskSuggestions: TaskSuggestion[];
  bestTimes: BestTime[];
  predictiveAlerts: PredictiveAlert[];
}

interface AiInsightsResponse {
  data: AiInsightsData;
  meta: {
    generatedAt: string;
    dataRange: { expensesFrom: string; expensesTo: string };
    counts: { expenses: number; tasks: number; budgets: number };
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  food: "طعام",
  transport: "مواصلات",
  bills: "فواتير",
  health: "صحة",
  shopping: "تسوق",
  education: "تعليم",
  entertainment: "ترفيه",
  charity: "صدقة",
  general: "عام",
  work: "عمل",
  personal: "شخصي",
  family: "عائلي",
  finance: "مالية",
};

function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] || value;
}

const TASK_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  overdue: { label: "متأخرة", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  high_priority: { label: "أولوية عالية", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  due_soon: { label: "موعد قريب", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  stuck: { label: "معلّقة", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  batch: { label: "دفعة", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
};

const PRIORITY_META: Record<
  TaskSuggestion["priority"],
  { label: string; cls: string; dot: string }
> = {
  high: { label: "عالية", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30", dot: "bg-rose-500" },
  medium: { label: "متوسطة", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", dot: "bg-amber-500" },
  low: { label: "منخفضة", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", dot: "bg-emerald-500" },
};

const ALERT_META: Record<
  PredictiveAlert["severity"],
  { cls: string; icon: React.ComponentType<{ className?: string }> }
> = {
  critical: { cls: "bg-rose-500/15 text-rose-500 border-rose-500/30", icon: AlertTriangle },
  warning: { cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: AlertTriangle },
  info: { cls: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: Info },
};

export function AiInsightsSection() {
  const { data: insights, raw, loading, error, reload } = useApi<AiInsightsData>(
    "/api/ai-insights"
  );
  const meta = raw?.meta;

  return (
    <div className="flex h-full flex-col gap-1">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h2 className="flex items-center gap-1 text-lg font-bold tracking-tight">
            <Brain className="size-6 text-emerald-glow" />
            التحليلات الذكية
          </h2>
          <p className="text-sm text-muted-foreground">
            رؤى تلقائية مستخرجة من بياناتك
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          <span className="hidden sm:inline">إعادة التحليل</span>
        </Button>
      </header>

      {/* Meta info */}
      {meta && !loading && !error && (
        <Card className="border-emerald-glow/30 bg-emerald-glow/5">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-1 text-xs">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-emerald-glow" />
              <span className="text-muted-foreground">توليد:</span>
              <span className="font-medium">{formatDateTime(meta.generatedAt)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-amber-glow" />
              <span className="text-muted-foreground">الفترة:</span>
              <span>{formatDate(meta.dataRange.expensesFrom)}</span>
              <span className="text-muted-foreground">←</span>
              <span>{formatDate(meta.dataRange.expensesTo)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-blue-500" />
              <span className="text-muted-foreground">المصروفات:</span>
              <span className="font-medium">{meta.counts.expenses}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ListTodo className="size-3.5 text-violet-500" />
              <span className="text-muted-foreground">المهام:</span>
              <span className="font-medium">{meta.counts.tasks}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart3 className="size-3.5 text-rose-500" />
              <span className="text-muted-foreground">الميزانيات:</span>
              <span className="font-medium">{meta.counts.budgets}</span>
            </span>
          </CardContent>
        </Card>
      )}

      {/* Body */}
      <ScrollArea className="flex-1 custom-scroll -mx-1 px-1">
        {loading ? (
          <div className="grid gap-1 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertTitle>تعذّر توليد التحليلات</AlertTitle>
            <AlertDescription className="flex items-center gap-1">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : !insights ? (
          <EmptyState />
        ) : (
          <div className="grid gap-1 lg:grid-cols-2">
            {/* Spending Patterns */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1 text-base">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-glow/15 text-emerald-glow">
                    <TrendingUp className="size-4" />
                  </div>
                  أنماط الإنفاق
                  <Badge variant="secondary" className="ml-auto">
                    {insights.spendingPatterns.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.spendingPatterns.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    لا توجد بيانات إنفاق في آخر 30 يوماً
                  </p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-80 overflow-y-auto custom-scroll pr-1">
                    {insights.spendingPatterns.map((p) => (
                      <div
                        key={p.category}
                        className="rounded-lg border border-border/60 p-2"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium">
                            {categoryLabel(p.category)}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {p.count} عملية
                            </span>
                            <TrendIcon trend={p.trend} />
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-end justify-between gap-1">
                          <span className="text-base font-bold text-emerald-glow">
                            {formatCurrency(p.total, "syp")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            المتوسط: {formatCurrency(p.average, "syp")}
                          </span>
                        </div>
                        {p.percentOfBudget !== null && (
                          <div className="mt-2">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                من الميزانية
                              </span>
                              <span
                                className={
                                  "font-medium " +
                                  (p.percentOfBudget >= 100
                                    ? "text-rose-500"
                                    : p.percentOfBudget >= 80
                                    ? "text-amber-glow"
                                    : "text-emerald-glow")
                                }
                              >
                                {p.percentOfBudget}%
                              </span>
                            </div>
                            <Progress
                              value={Math.min(p.percentOfBudget, 100)}
                              className={
                                "h-1.5 " +
                                (p.percentOfBudget >= 100
                                  ? "[&>[data-slot=progress-indicator]]:bg-rose-500"
                                  : p.percentOfBudget >= 80
                                  ? "[&>[data-slot=progress-indicator]]:bg-amber-glow"
                                  : "[&>[data-slot=progress-indicator]]:bg-emerald-glow")
                              }
                            />
                          </div>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {p.insight}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Task Suggestions */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1 text-base">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-amber-glow/15 text-amber-glow">
                    <Lightbulb className="size-4" />
                  </div>
                  اقتراحات المهام
                  <Badge variant="secondary" className="ml-auto">
                    {insights.taskSuggestions.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.taskSuggestions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    لا توجد اقتراحات حالياً
                  </p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-80 overflow-y-auto custom-scroll pr-1">
                    {insights.taskSuggestions.map((s, i) => {
                      const pr = PRIORITY_META[s.priority];
                      const tm =
                        TASK_TYPE_LABELS[s.type] || {
                          label: s.type,
                          cls: "bg-muted text-muted-foreground",
                        };
                      return (
                        <div
                          key={i}
                          className="rounded-lg border border-border/60 p-2"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className={tm.cls}>
                                  {tm.label}
                                </Badge>
                                <Badge variant="outline" className={pr.cls}>
                                  <span className={"size-1.5 rounded-full " + pr.dot} />
                                  {pr.label}
                                </Badge>
                              </div>
                              <p className="mt-1.5 text-sm font-medium leading-snug">
                                {s.title}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {s.reason}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Best Times */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1 text-base">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500">
                    <Clock className="size-4" />
                  </div>
                  أفضل الأوقات للإنتاجية
                  <Badge variant="secondary" className="ml-auto">
                    {insights.bestTimes.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.bestTimes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    لا توجد بيانات كافية
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {insights.bestTimes.map((b, i) => {
                      const Icon = b.type === "hour" ? Clock : Calendar;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-1 rounded-lg border border-border/60 p-2"
                        >
                          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500">
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-medium">{b.label}</span>
                              {b.count > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {b.count} مهمة
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {b.recommendation}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Predictive Alerts */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1 text-base">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500">
                    <AlertTriangle className="size-4" />
                  </div>
                  التنبيهات التنبؤية
                  <Badge variant="secondary" className="ml-auto">
                    {insights.predictiveAlerts.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.predictiveAlerts.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 py-6 text-center">
                    <div className="flex size-6 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
                      <Info className="size-5" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      لا توجد تنبيهات — كل شيء على ما يرام
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 max-h-80 overflow-y-auto custom-scroll pr-1">
                    {insights.predictiveAlerts.map((a, i) => {
                      const am = ALERT_META[a.severity];
                      const Icon = am.icon;
                      return (
                        <div
                          key={i}
                          className={
                            "rounded-lg border p-2 " + am.cls
                          }
                        >
                          <div className="flex items-start gap-1">
                            <Icon className="size-4 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{a.title}</p>
                              <p className="mt-0.5 text-xs opacity-90">
                                {a.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <TrendingUp className="size-3.5 text-rose-500" aria-label="ارتفاع" />;
  }
  if (trend === "down") {
    return <TrendingDown className="size-3.5 text-emerald-glow" aria-label="انخفاض" />;
  }
  return <Minus className="size-3.5 text-muted-foreground" aria-label="مستقر" />;
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-1 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
          <Brain className="size-7" />
        </div>
        <div>
          <p className="font-medium">لا توجد تحليلات متاحة</p>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف بيانات كافية (مصروفات، مهام، ميزانيات) لتوليد رؤى ذكية
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
