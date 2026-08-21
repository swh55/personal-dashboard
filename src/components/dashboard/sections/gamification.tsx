"use client";

import * as React from "react";
import {
  RefreshCw,
  CircleAlert,
  Trophy,
  Flame,
  Star,
  Sparkles,
  CheckCircle2,
  ListTodo,
  Calendar,
  NotebookPen,
  Users,
  Lock,
  Award,
  TrendingUp,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  max?: number;
}

interface HabitStreak {
  habitId: string;
  name: string;
  streak: number;
}

interface GamificationStats {
  doneTasks: number;
  totalTasks: number;
  habitLogs: number;
  contacts: number;
  events: number;
  notes: number;
}

interface GamificationData {
  points: number;
  level: number;
  pointsInLevel: number;
  pointsToNext: number;
  achievements: Achievement[];
  habitStreaks: HabitStreak[];
  stats: GamificationStats;
}

const ACHIEVEMENT_MAX: Record<string, number> = {
  "first-task": 1,
  "task-master-10": 10,
  "task-master-50": 50,
  "habit-7": 7,
  "habit-30": 30,
  connector: 10,
  organizer: 5,
  writer: 10,
};

const STAT_TILES = [
  { key: "doneTasks", label: "مهام منجزة", icon: CheckCircle2, color: "text-emerald-glow" },
  { key: "totalTasks", label: "إجمالي المهام", icon: ListTodo, color: "text-amber-glow" },
  { key: "habitLogs", label: "سجلات العادات", icon: Flame, color: "text-rose-400" },
  { key: "contacts", label: "جهات الاتصال", icon: Users, color: "text-blue-400" },
  { key: "events", label: "الأحداث", icon: Calendar, color: "text-violet-400" },
  { key: "notes", label: "الملاحظات", icon: NotebookPen, color: "text-cyan-400" },
] as const;

export function GamificationSection() {
  const { data, loading, error, reload } = useApi<GamificationData>("/api/gamification");

  const prevLevel = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (data && prevLevel.current !== null && data.level > prevLevel.current) {
      toast.success(`🎉 تهانينا! وصلت إلى المستوى ${data.level}`);
    }
    if (data) prevLevel.current = data.level;
  }, [data]);

  const levelProgress = data ? data.pointsInLevel : 0;
  const levelPct = levelProgress; // pointsInLevel is out of 100

  return (
    <div className="flex h-full flex-col gap-1">
      <header className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">التحفيز والإنجاز</h2>
          <p className="text-sm text-muted-foreground">
            تابع نقاطك ومستواك وإنجازاتك في رحلة التنظيم
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          <span className="hidden sm:inline">تحديث</span>
        </Button>
      </header>

      <ScrollArea className="flex-1 custom-scroll -mx-1 px-1">
        {loading ? (
          <div className="grid gap-1">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertTitle>تعذّر تحميل بيانات التحفيز</AlertTitle>
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
            <AlertDescription>لم يتم العثور على بيانات تحفيزية.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Hero level card */}
            <Card className="relative overflow-hidden border-emerald-glow/30 bg-gradient-to-br from-emerald-glow/10 via-transparent to-amber-glow/10">
              <div className="pointer-events-none absolute -start-12 -top-12 size-48 rounded-full bg-emerald-glow/10 blur-3xl" />
              <div className="pointer-events-none absolute -end-12 -bottom-12 size-48 rounded-full bg-amber-glow/10 blur-3xl" />
              <CardContent className="relative p-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  {/* Level badge */}
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-glow to-amber-glow blur-md opacity-60" />
                      <div className="relative flex size-20 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-glow to-amber-glow text-background">
                        <span className="text-[10px] font-medium opacity-80">مستوى</span>
                        <span className="text-lg font-bold leading-none">{data.level}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <Sparkles className="size-4 text-emerald-glow" />
                        <span className="text-sm text-muted-foreground">نقاطك الحالية</span>
                      </div>
                      <p className="text-lg font-bold tracking-tight">
                        {data.points.toLocaleString("en-US")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        تبقّى {data.pointsToNext} نقطة للمستوى التالي
                      </p>
                    </div>
                  </div>

                  {/* Progress to next level */}
                  <div className="min-w-[200px] flex-1">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="size-3" />
                        التقدّم نحو المستوى {data.level + 1}
                      </span>
                      <span className="font-semibold text-emerald-glow">{levelPct}%</span>
                    </div>
                    <Progress
                      value={levelPct}
                      className="h-3 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-emerald-glow [&>[data-slot=progress-indicator]]:to-amber-glow"
                    />
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{data.pointsInLevel} / 100</span>
                      <Badge
                        variant="outline"
                        className="border-emerald-glow/30 bg-emerald-glow/10 text-emerald-glow"
                      >
                        <Award className="size-3" />
                        مستوى {data.level}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
              {STAT_TILES.map((t) => {
                const value = (data.stats as unknown as Record<string, number>)[t.key];
                const Icon = t.icon;
                return (
                  <Card key={t.key} className="border-border/60">
                    <CardContent className="flex flex-col items-center gap-1 p-1 text-center">
                      <Icon className={`size-5 ${t.color}`} />
                      <span className="text-lg font-bold leading-none">
                        {value.toLocaleString("en-US")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{t.label}</span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Achievements grid */}
            <Card className="border-border/60">
              <CardContent className="p-1">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Trophy className="size-5 text-amber-glow" />
                    <h3 className="font-semibold">الإنجازات</h3>
                  </div>
                  <Badge variant="outline" className="bg-amber-glow/10 text-amber-glow border-amber-glow/30">
                    {data.achievements.filter((a) => a.unlocked).length} / {data.achievements.length} مفتوحة
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
                  {data.achievements.map((a) => {
                    const max = ACHIEVEMENT_MAX[a.id] ?? a.max ?? 0;
                    const pct = max > 0 ? Math.min(100, Math.round((a.progress / max) * 100)) : 0;
                    return (
                      <div
                        key={a.id}
                        className={
                          "relative flex flex-col gap-1 rounded-xl border p-2 transition-colors " +
                          (a.unlocked
                            ? "border-amber-glow/40 bg-amber-glow/5"
                            : "border-border/60 bg-muted/30")
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className={
                              "flex size-11 items-center justify-center rounded-xl text-lg " +
                              (a.unlocked ? "bg-amber-glow/15" : "bg-muted/60 grayscale")
                            }
                          >
                            {a.icon}
                          </div>
                          {a.unlocked ? (
                            <Badge className="bg-emerald-glow/15 text-emerald-glow border-emerald-glow/30" variant="outline">
                              <Star className="size-3" />
                              مفتوح
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <Lock className="size-3" />
                              مغلق
                            </Badge>
                          )}
                        </div>
                        <div>
                          <p className={"text-sm font-semibold " + (a.unlocked ? "" : "text-muted-foreground")}>
                            {a.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{a.description}</p>
                        </div>
                        {!a.unlocked && max > 0 && (
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>التقدّم</span>
                              <span>
                                {a.progress} / {max}
                              </span>
                            </div>
                            <Progress
                              value={pct}
                              className="h-1.5 [&>[data-slot=progress-indicator]]:bg-amber-glow"
                            />
                          </div>
                        )}
                        {a.unlocked && max > 0 && (
                          <p className="text-[10px] text-emerald-glow">
                            أتممت {a.progress} / {max}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Habit streaks leaderboard */}
            <Card className="border-border/60">
              <CardContent className="p-1">
                <div className="mb-2 flex items-center gap-1">
                  <Flame className="size-5 text-rose-400" />
                  <h3 className="font-semibold">لوحة الصدارة — السلاسل اليومية</h3>
                </div>
                {data.habitStreaks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
                      <Flame className="size-5" />
                    </div>
                    <p className="text-sm font-medium">لا توجد سلاسل عادات بعد</p>
                    <p className="text-xs text-muted-foreground">
                      سجّل عاداتك يومياً لبناء سلسلة التزام
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {data.habitStreaks.map((s, i) => {
                      const medal =
                        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                      const isHot = s.streak >= 3;
                      return (
                        <div
                          key={s.habitId}
                          className="flex items-center justify-between gap-1 rounded-xl border border-border/60 bg-muted/20 px-2 py-3"
                        >
                          <div className="flex items-center gap-1">
                            <span className="flex size-6 items-center justify-center text-base font-bold">
                              {medal || (
                                <span className="text-muted-foreground">{i + 1}</span>
                              )}
                            </span>
                            <div>
                              <p className="font-medium">{s.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {s.streak > 0 ? "سلسلة مستمرة" : "لا سلسلة حالياً"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {isHot && (
                              <span className="text-base" title="سلسلة نشطة">
                                🔥
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={
                                isHot
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                  : "text-muted-foreground"
                              }
                            >
                              {s.streak} يوم
                            </Badge>
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
