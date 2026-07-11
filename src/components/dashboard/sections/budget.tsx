"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Wallet,
  TrendingDown,
  TrendingUp,
  Calendar,
  Inbox,
  PiggyBank,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
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
import { EXPENSE_CATEGORIES, formatCurrency } from "@/lib/constants";

interface BudgetItem {
  id: string;
  category: string;
  limit: number;
  month: number;
  year: number;
  spent: number;
  remaining: number;
  percent: number;
  status: "ok" | "warning" | "exceeded";
  createdAt: string;
  updatedAt: string;
}

interface BudgetStats {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  percent: number;
  month: number;
  year: number;
}

const MONTH_NAMES = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];

function categoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function statusMeta(s: BudgetItem["status"]): {
  label: string;
  cls: string;
} {
  if (s === "exceeded") {
    return {
      label: "تجاوز",
      cls: "bg-rose-500/15 text-rose-500 border-rose-500/30",
    };
  }
  if (s === "warning") {
    return {
      label: "اقتراب",
      cls: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    };
  }
  return {
    label: "ضمن الحدود",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  };
}

const EMPTY_FORM = {
  category: "food",
  limit: "",
};

export function BudgetSection() {
  // Derive month/year on the client only to avoid SSR timezone mismatch.
  const [month, setMonth] = React.useState<number>(() => new Date().getMonth() + 1);
  const [year, setYear] = React.useState<number>(() => new Date().getFullYear());

  const { data, raw, loading, error, reload } = useApi<BudgetItem[]>(
    `/api/budget?month=${month}&year=${year}`
  );
  const budgets = data || [];
  const stats: BudgetStats | undefined = raw?.stats;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BudgetItem | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Year options: current year ± 2
  const yearOptions = React.useMemo(() => {
    const arr: number[] = [];
    for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
      arr.push(y);
    }
    return arr;
  }, [now.getFullYear()]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(b: BudgetItem) {
    setEditing(b);
    setForm({ category: b.category, limit: String(b.limit) });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.category) {
      toast.error("اختر فئة");
      return;
    }
    const limit = Number(form.limit);
    if (!Number.isFinite(limit) || limit <= 0) {
      toast.error("أدخل حدّاً صحيحاً");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        category: form.category,
        limit,
        month,
        year,
      };
      if (editing) payload.id = editing.id;
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث الميزانية" : "تمت إضافة الميزانية");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/budget?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الميزانية");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الحذف");
    }
  }

  // Filter categories for select: show categories not yet used (when adding) + current editing
  const availableCategories = React.useMemo(() => {
    const used = new Set(budgets.map((b) => b.category));
    if (editing) used.delete(editing.category);
    return EXPENSE_CATEGORIES.filter((c) => !used.has(c.value));
  }, [budgets, editing]);

  return (
    <div className="flex h-full flex-col gap-1">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">الميزانيات</h2>
          <p className="text-sm text-muted-foreground">
            حدّد سقف الإنفاق الشهري لكل فئة وتابع الالتزام
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            disabled={availableCategories.length === 0}
          >
            <Plus className="size-4" />
            <span>تحديد ميزانية</span>
          </Button>
        </div>
      </header>

      {/* Month/Year Selector */}
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-1 p-1">
          <Calendar className="size-4 text-emerald-glow" />
          <span className="text-sm font-medium">الفترة:</span>
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {month === now.getMonth() + 1 && year === now.getFullYear() && (
            <Badge className="bg-emerald-glow/15 text-emerald-glow border-emerald-glow/30">
              الشهر الحالي
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Body */}
      <ScrollArea className="flex-1 custom-scroll -mx-1 px-1">
        {loading ? (
          <div className="grid gap-1">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid gap-1 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertTitle>تعذّر تحميل الميزانيات</AlertTitle>
            <AlertDescription className="flex items-center gap-1">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Overall progress hero */}
            {stats && (
              <Card
                className={
                  "border-border/60 " +
                  (stats.totalBudget > 0 && stats.percent >= 100
                    ? "bg-rose-500/5"
                    : stats.percent >= 70
                    ? "bg-amber-glow/5"
                    : "bg-emerald-glow/5")
                }
              >
                <CardContent className="p-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <div
                        className={
                          "flex size-7 items-center justify-center rounded-xl " +
                          (stats.percent >= 100
                            ? "bg-rose-500/15 text-rose-500"
                            : stats.percent >= 70
                            ? "bg-amber-glow/15 text-amber-glow"
                            : "bg-emerald-glow/15 text-emerald-glow")
                        }
                      >
                        <Wallet className="size-6" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          الميزانية الإجمالية — {MONTH_NAMES[stats.month - 1]}{" "}
                          {stats.year}
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(stats.totalBudget, "syp")}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p
                        className={
                          "text-lg font-bold " +
                          (stats.percent >= 100
                            ? "text-rose-500"
                            : stats.percent >= 70
                            ? "text-amber-glow"
                            : "text-emerald-glow")
                        }
                      >
                        {stats.percent}%
                      </p>
                      <p className="text-xs text-muted-foreground">من الميزانية</p>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(stats.percent, 100)}
                    className={
                      "mt-2 h-2.5 " +
                      (stats.percent >= 100
                        ? "[&>[data-slot=progress-indicator]]:bg-rose-500"
                        : stats.percent >= 70
                        ? "[&>[data-slot=progress-indicator]]:bg-amber-glow"
                        : "[&>[data-slot=progress-indicator]]:bg-emerald-glow")
                    }
                  />
                  <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                    <div className="rounded-lg border border-border/60 p-2.5">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <TrendingDown className="size-3" />
                        المنفق
                      </div>
                      <div className="mt-1 font-bold text-rose-500">
                        {formatCurrency(stats.totalSpent, "syp")}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2.5">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <PiggyBank className="size-3" />
                        المتبقّي
                      </div>
                      <div
                        className={
                          "mt-1 font-bold " +
                          (stats.totalRemaining < 0
                            ? "text-rose-500"
                            : "text-emerald-glow")
                        }
                      >
                        {formatCurrency(stats.totalRemaining, "syp")}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2.5">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="size-3" />
                        الفئات
                      </div>
                      <div className="mt-1 font-bold">{budgets.length}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Budget list */}
            {budgets.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center gap-1 p-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
                    <Inbox className="size-7" />
                  </div>
                  <div>
                    <p className="font-medium">لا توجد ميزانيات محددة</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      ابدأ بتحديد حدّ إنفاق لكل فئة لمتابعة مصروفاتك
                    </p>
                  </div>
                  <Button size="sm" onClick={openAdd}>
                    <Plus className="size-4" />
                    تحديد ميزانية
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2">
                {budgets.map((b) => {
                  const st = statusMeta(b.status);
                  return (
                    <Card
                      key={b.id}
                      className="group border-border/60 transition-colors hover:border-emerald-glow/40"
                    >
                      <CardContent className="p-1">
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <h3 className="font-semibold">
                              {categoryLabel(b.category)}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              الحدّ: {formatCurrency(b.limit, "syp")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={st.cls}>
                              {st.label}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-emerald-glow opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => openEdit(b)}
                              aria-label="تعديل"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-rose-500 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => setDeleteId(b.id)}
                              aria-label="حذف"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              المنفق: {formatCurrency(b.spent, "syp")}
                            </span>
                            <span
                              className={
                                "font-medium " +
                                (b.percent >= 100
                                  ? "text-rose-500"
                                  : b.percent >= 80
                                  ? "text-amber-glow"
                                  : "text-emerald-glow")
                              }
                            >
                              {b.percent}%
                            </span>
                          </div>
                          <Progress
                            value={Math.min(b.percent, 100)}
                            className={
                              "h-2 " +
                              (b.percent >= 100
                                ? "[&>[data-slot=progress-indicator]]:bg-rose-500"
                                : b.percent >= 80
                                ? "[&>[data-slot=progress-indicator]]:bg-amber-glow"
                                : "[&>[data-slot=progress-indicator]]:bg-emerald-glow")
                            }
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            المتبقّي:{" "}
                            <span
                              className={
                                b.remaining < 0
                                  ? "font-medium text-rose-500"
                                  : "font-medium text-emerald-glow"
                              }
                            >
                              {formatCurrency(b.remaining, "syp")}
                            </span>
                          </span>
                          {b.remaining < 0 && (
                            <Badge
                              variant="outline"
                              className="bg-rose-500/10 text-rose-500 border-rose-500/30"
                            >
                              تجاوز بـ {formatCurrency(Math.abs(b.remaining), "syp")}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "تعديل الميزانية" : "تحديد ميزانية جديدة"}
            </DialogTitle>
            <DialogDescription>
              {MONTH_NAMES[month - 1]} {year}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 py-1">
            <div className="grid gap-1">
              <Label htmlFor="category">الفئة</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="اختر فئة" />
                </SelectTrigger>
                <SelectContent>
                  {(editing
                    ? EXPENSE_CATEGORIES
                    : availableCategories
                  ).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editing && availableCategories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  تم تحديد ميزانية لجميع الفئات في هذه الفترة
                </p>
              )}
            </div>
            <div className="grid gap-1">
              <Label htmlFor="limit">حدّ الإنفاق (ل.س) *</Label>
              <Input
                id="limit"
                inputMode="numeric"
                dir="ltr"
                value={form.limit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, limit: e.target.value }))
                }
                placeholder="مثال: 500000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الميزانية؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الحدّ المالي لهذه الفئة. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-500 hover:bg-rose-600"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
