"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Flame,
  CheckCircle2,
  Circle,
  Activity,
  Target,
  TrendingUp,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  value: number;
}

interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  target: number;
  color: string;
  icon: string;
  active: boolean;
  createdAt: string;
  logs: HabitLog[];
  todayDone: boolean;
  todayValue: number;
  streak: number;
  last7Days: number;
}

interface HabitStats {
  total: number;
  active: number;
  doneToday: number;
  bestStreak: number;
}

const HABIT_COLORS = [
  { value: "emerald", label: "أخضر", class: "bg-emerald-500", soft: "bg-emerald-500/15 text-emerald-glow" },
  { value: "amber", label: "كهرماني", class: "bg-amber-500", soft: "bg-amber-500/15 text-amber-glow" },
  { value: "rose", label: "وردي", class: "bg-rose-500", soft: "bg-rose-500/15 text-rose-500" },
  { value: "blue", label: "أزرق", class: "bg-blue-500", soft: "bg-blue-500/15 text-blue-500" },
  { value: "violet", label: "بنفسجي", class: "bg-violet-500", soft: "bg-violet-500/15 text-violet-500" },
];

const HABIT_ICONS = [
  { value: "Activity", label: "نشاط" },
  { value: "Target", label: "هدف" },
  { value: "Flame", label: "لهب" },
  { value: "TrendingUp", label: "تقدم" },
  { value: "CheckCircle2", label: "إنجاز" },
  { value: "Circle", label: "دائرة" },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  Target,
  Flame,
  TrendingUp,
  CheckCircle2,
  Circle,
};

function colorClass(color: string): string {
  return HABIT_COLORS.find((c) => c.value === color)?.class || HABIT_COLORS[0].class;
}
function softClass(color: string): string {
  return HABIT_COLORS.find((c) => c.value === color)?.soft || HABIT_COLORS[0].soft;
}

/** Build last-7-days cells: returns array of { date, label, done } oldest → newest */
function last7DaysCells(habit: Habit): Array<{ date: Date; label: string; done: boolean }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells: Array<{ date: Date; label: string; done: boolean }> = [];
  const doneDates = new Set(habit.logs.map((l) => {
    const d = new Date(l.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }));
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    cells.push({
      date: d,
      label: dayNames[d.getDay()],
      done: doneDates.has(d.getTime()),
    });
  }
  return cells;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  frequency: "daily",
  target: "1",
  color: "emerald",
  icon: "CheckCircle2",
};

export function HabitsSection() {
  const { data, loading, error, reload } = useApi<Habit[]>("/api/habits");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Habit | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const stats: HabitStats = React.useMemo<HabitStats>(() => {
    const list = data || [];
    return {
      total: list.length,
      active: list.filter((h) => h.active).length,
      doneToday: list.filter((h) => h.todayDone).length,
      bestStreak: list.reduce((m, h) => Math.max(m, h.streak), 0),
    };
  }, [data]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(h: Habit) {
    setEditing(h);
    setForm({
      name: h.name,
      description: h.description || "",
      frequency: h.frequency,
      target: String(h.target),
      color: h.color,
      icon: h.icon,
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        frequency: form.frequency,
        target: Number(form.target) || 1,
        color: form.color,
        icon: form.icon,
      };
      const res = await fetch("/api/habits", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث العادة" : "تمت إضافة العادة");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleToday(h: Habit) {
    setTogglingId(h.id);
    try {
      const res = await fetch("/api/habits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: h.id, log: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(h.todayDone ? "تم إلغاء التسجيل" : "تم تسجيل الإنجاز اليوم");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/habits?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف العادة");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">متعقب العادات</h1>
          <p className="text-sm text-muted-foreground">تابع تقدمك اليومي</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            عادة جديدة
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox icon={Activity} label="إجمالي العادات" value={stats.total} accent="emerald" />
        <StatBox icon={CheckCircle2} label="منجزة اليوم" value={stats.doneToday} accent="amber" />
        <StatBox icon={Flame} label="أطول سلسلة" value={stats.bestStreak} accent="emerald" />
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل العادات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : (data || []).length > 0 ? (
          <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2">
            {data!.map((h) => {
              const Icon = ICON_MAP[h.icon] || CheckCircle2;
              const cells = last7DaysCells(h);
              return (
                <Card key={h.id} className="group overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${softClass(h.color)}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate">{h.name}</h3>
                          {h.streak >= 3 ? (
                            <Badge variant="secondary" className="shrink-0 gap-0.5 bg-amber-glow/15 text-amber-glow text-[10px]">
                              <Flame className="size-3" />
                              {h.streak}
                            </Badge>
                          ) : null}
                        </div>
                        {h.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{h.description}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{h.frequency === "daily" ? "يومية" : "أسبوعية"}</Badge>
                          <span>الهدف: {h.target}</span>
                          {h.streak > 0 ? <span className="flex items-center gap-0.5 text-amber-glow"><Flame className="size-3" />سلسلة {h.streak} يوم</span> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(h)} aria-label="تعديل">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setDeleteId(h.id)} aria-label="حذف">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* last 7 days grid */}
                    <div className="mt-3 grid grid-cols-7 gap-1">
                      {cells.map((c, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-0.5">
                          <div
                            className={`size-7 rounded-md flex items-center justify-center text-[10px] font-medium ${
                              c.done ? `${colorClass(h.color)} text-white` : "bg-muted text-muted-foreground"
                            }`}
                            title={`${c.label} — ${c.done ? "منجز" : "غير منجز"}`}
                          >
                            {c.date.getDate()}
                          </div>
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{c.label.charAt(0)}</span>
                        </div>
                      ))}
                    </div>

                    {/* toggle today */}
                    <Button
                      variant={h.todayDone ? "default" : "outline"}
                      className={`mt-3 w-full ${h.todayDone ? "bg-emerald-glow text-emerald-glow-foreground hover:bg-emerald-glow/90" : ""}`}
                      onClick={() => toggleToday(h)}
                      disabled={togglingId === h.id}
                    >
                      {togglingId === h.id ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : h.todayDone ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                      {h.todayDone ? "تم إنجازها اليوم — إلغاء" : "تسجيل الإنجاز اليوم"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Activity className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا عادات بعد</p>
            <p className="text-xs text-muted-foreground">ابدأ ببناء عادة جديدة اليوم</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              إضافة عادة
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل عادة" : "إضافة عادة جديدة"}</DialogTitle>
            <DialogDescription>حدد اسم العادة وتكرارها.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="h-name">اسم العادة *</Label>
              <Input id="h-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="مثال: شرب 8 أكواب ماء" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-desc">الوصف</Label>
              <Textarea id="h-desc" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>التكرار</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">يومي</SelectItem>
                    <SelectItem value="weekly">أسبوعي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="h-target">الهدف اليومي</Label>
                <Input id="h-target" type="number" min={1} value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>اللون</Label>
              <div className="flex flex-wrap gap-1.5">
                {HABIT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.label}
                    onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                    className={`size-7 rounded-full ${c.class} ring-offset-2 transition ${form.color === c.value ? "ring-2 ring-ring" : ""}`}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>الأيقونة</Label>
              <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HABIT_ICONS.map((i) => {
                    const I = ICON_MAP[i.value] || Circle;
                    return (
                      <SelectItem key={i.value} value={i.value}>
                        <span className="flex items-center gap-2"><I className="size-4" /> {i.label}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف العادة وسجلاتها نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "amber";
}) {
  const accentClass = accent === "emerald" ? "text-emerald-glow bg-emerald-glow/10" : "text-amber-glow bg-amber-glow/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
