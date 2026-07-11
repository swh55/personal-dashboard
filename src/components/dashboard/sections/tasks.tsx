"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  ListTodo,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Filter,
  Flag,
} from "lucide-react";
import { useApi, toast, formatDate, daysUntil } from "@/lib/api";
import { TASK_CATEGORIES } from "@/lib/constants";
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

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  dueDate: string | null;
  projectId: string | null;
  project: { id: string; name: string; color: string } | null;
  createdAt: string;
}

interface TaskStats {
  total: number;
  todo: number;
  doing: number;
  done: number;
  high: number;
  overdue: number;
}

const STATUSES = [
  { value: "todo", label: "مطلوب", icon: ListTodo, accent: "text-amber-glow bg-amber-glow/10" },
  { value: "doing", label: "قيد التنفيذ", icon: Loader2, accent: "text-blue-500 bg-blue-500/10" },
  { value: "done", label: "منجزة", icon: CheckCircle2, accent: "text-emerald-glow bg-emerald-glow/10" },
];

const PRIORITIES = [
  { value: "low", label: "منخفضة", badge: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  { value: "medium", label: "متوسطة", badge: "bg-amber-glow/15 text-amber-glow" },
  { value: "high", label: "عالية", badge: "bg-rose-500/15 text-rose-500" },
];

function priorityBadgeClass(p: string): string {
  return PRIORITIES.find((x) => x.value === p)?.badge || PRIORITIES[1].badge;
}
function priorityLabel(p: string): string {
  return PRIORITIES.find((x) => x.value === p)?.label || p;
}
function categoryLabel(c: string): string {
  return TASK_CATEGORIES.find((x) => x.value === c)?.label || c;
}

function toLocalInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  category: "general",
  dueDate: "",
  projectId: "",
};

export function TasksSection() {
  const { data, loading, error, reload } = useApi<Task[]>("/api/tasks");
  const [filterCategory, setFilterCategory] = React.useState<string>("all");
  const [filterPriority, setFilterPriority] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Task | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  // stats are computed client-side from the tasks array (server also returns them but useApi exposes only `data`)
  const stats: TaskStats = React.useMemo<TaskStats>(() => {
    const list = data || [];
    return {
      total: list.length,
      todo: list.filter((t) => t.status === "todo").length,
      doing: list.filter((t) => t.status === "doing").length,
      done: list.filter((t) => t.status === "done").length,
      high: list.filter((t) => t.priority === "high").length,
      overdue: list.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()).length,
    };
  }, [data]);

  const filtered = React.useMemo(() => {
    let list = (data || []).slice();
    if (filterCategory !== "all") list = list.filter((t) => t.category === filterCategory);
    if (filterPriority !== "all") list = list.filter((t) => t.priority === filterPriority);
    return list;
  }, [data, filterCategory, filterPriority]);

  const columns = STATUSES.map((s) => ({
    ...s,
    items: filtered.filter((t) => t.status === s.value),
  }));

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || "",
      status: t.status,
      priority: t.priority,
      category: t.category,
      dueDate: t.dueDate ? toLocalInputDate(new Date(t.dueDate)) : "",
      projectId: t.projectId || "",
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        category: form.category,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        projectId: form.projectId || null,
      };
      const res = await fetch("/api/tasks", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث المهمة" : "تمت إضافة المهمة");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  async function moveStatus(t: Task, dir: "next" | "prev") {
    const order = ["todo", "doing", "done"];
    const idx = order.indexOf(t.status);
    const newIdx = dir === "next" ? Math.min(order.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (newIdx === idx) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, status: order[newIdx] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success("تم تحديث الحالة");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/tasks?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف المهمة");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">المهام</h1>
          <p className="text-sm text-muted-foreground">{stats.total} مهمة · {stats.overdue} متأخرة · {stats.high} ذات أولوية عالية</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            مهمة جديدة
          </Button>
        </div>
      </div>

      {/* stats bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox label="الإجمالي" value={stats.total} icon={ListTodo} accent="emerald" />
        <StatBox label="مطلوب" value={stats.todo} icon={ListTodo} accent="amber" />
        <StatBox label="قيد التنفيذ" value={stats.doing} icon={Loader2} accent="emerald" />
        <StatBox label="منجزة" value={stats.done} icon={CheckCircle2} accent="emerald" />
        <StatBox label="أولوية عالية" value={stats.high} icon={Flag} accent="amber" />
        <StatBox label="متأخرة" value={stats.overdue} icon={AlertTriangle} accent="rose" />
      </div>

      {/* filters */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">تصفية:</span>
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="التصنيف" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التصنيفات</SelectItem>
              {TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="الأولوية" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأولويات</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل المهام</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* kanban columns */}
      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        <div className="grid grid-cols-1 gap-2 pb-4 md:grid-cols-3">
          {columns.map((col) => (
            <Card key={col.value} className="flex flex-col overflow-hidden">
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className={`flex size-6 items-center justify-center rounded-md ${col.accent}`}>
                      <col.icon className="size-3.5" />
                    </div>
                    {col.label}
                  </CardTitle>
                  <Badge variant="secondary">{col.items.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-2 space-y-2 min-h-[8rem]">
                {loading ? (
                  [0, 1].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
                ) : col.items.length > 0 ? (
                  col.items.map((t) => {
                    const overdue = t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date();
                    const dUntil = t.dueDate ? daysUntil(t.dueDate) : null;
                    return (
                      <div
                        key={t.id}
                        className="group rounded-lg border bg-card p-2 cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => openEdit(t)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium leading-snug flex-1">{t.title}</span>
                          <Badge variant="secondary" className={`shrink-0 text-[10px] ${priorityBadgeClass(t.priority)}`}>
                            {priorityLabel(t.priority)}
                          </Badge>
                        </div>
                        {t.description ? (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{categoryLabel(t.category)}</Badge>
                          {t.project ? (
                            <Badge variant="secondary" className="text-[10px]">{t.project.name}</Badge>
                          ) : null}
                          {t.dueDate ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              <Calendar className="size-3" />
                              {formatDate(t.dueDate, { month: "short", day: "numeric" })}
                              {dUntil !== null && dUntil < 0 && t.status !== "done" ? ` (${Math.abs(dUntil)}ي تأخير)` : null}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="size-7" disabled={t.status === "todo"} onClick={() => moveStatus(t, "prev")} aria-label="للخلف">
                              <ArrowRight className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7" disabled={t.status === "done"} onClick={() => moveStatus(t, "next")} aria-label="للأمام">
                              <ArrowLeft className="size-3.5" />
                            </Button>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(t)} aria-label="تعديل">
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setDeleteId(t.id)} aria-label="حذف">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                    <col.icon className="size-6 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">لا مهام</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل مهمة" : "إضافة مهمة جديدة"}</DialogTitle>
            <DialogDescription>أدخل تفاصيل المهمة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="t-title">العنوان *</Label>
              <Input id="t-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="ماذا تريد أن تنجز؟" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-desc">الوصف</Label>
              <Textarea id="t-desc" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>التصنيف</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="t-due">تاريخ الاستحقاق</Label>
                <Input id="t-due" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-proj">معرّف المشروع (اختياري)</Label>
              <Input id="t-proj" value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} placeholder="cuid..." />
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
            <AlertDialogDescription>سيتم نقل المهمة إلى سلة المحذوفات.</AlertDialogDescription>
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
  accent: "emerald" | "amber" | "rose";
}) {
  const accentClass = accent === "emerald"
    ? "text-emerald-glow bg-emerald-glow/10"
    : accent === "amber"
    ? "text-amber-glow bg-amber-glow/10"
    : "text-rose-500 bg-rose-500/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-2">
        <div className={`flex size-8 items-center justify-center rounded-md ${accentClass}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
