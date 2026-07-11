"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  HandCoins,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Users,
} from "lucide-react";
import { useApi, toast, formatDate, daysUntil } from "@/lib/api";
import {
  CURRENCIES,
  USD_TO_SYP,
  formatCurrency,
} from "@/lib/constants";
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

interface Debt {
  id: string;
  personName: string;
  amount: number;
  currency: string;
  type: string; // owed / owe
  description: string | null;
  dueDate: string | null;
  settled: boolean;
  settledAt: string | null;
  createdAt: string;
}

interface DebtStats {
  totalOwed: number;
  totalOwe: number;
  count: number;
}

function toSYP(amount: number, currency: string): number {
  return currency === "usd" ? amount * USD_TO_SYP : amount;
}

const EMPTY_FORM = {
  personName: "",
  amount: "",
  currency: "syp",
  type: "owed",
  description: "",
  dueDate: "",
};

type ViewFilter = "all" | "owed" | "owe";

export function DebtsSection() {
  const { data, raw, loading, error, reload } = useApi<Debt[]>("/api/debts");
  const debts = data || [];
  const stats: DebtStats = raw?.stats || { totalOwed: 0, totalOwe: 0, count: 0 };

  const [filter, setFilter] = React.useState<ViewFilter>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Debt | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const owedToMe = debts.filter((d) => d.type === "owed");
  const iOwe = debts.filter((d) => d.type === "owe");

  function openAdd(presetType: string = "owed") {
    setEditing(null);
    setForm({ ...EMPTY_FORM, type: presetType });
    setDialogOpen(true);
  }

  function openEdit(d: Debt) {
    setEditing(d);
    setForm({
      personName: d.personName,
      amount: String(d.amount),
      currency: d.currency,
      type: d.type,
      description: d.description || "",
      dueDate: d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : "",
    });
    setDialogOpen(true);
  }

  async function submit() {
    const amount = Number(form.amount);
    if (!form.personName.trim() || !amount || amount <= 0) {
      toast.error("الاسم والمبلغ مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        personName: form.personName.trim(),
        amount,
        currency: form.currency,
        type: form.type,
        description: form.description.trim() || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      };
      const res = await fetch("/api/debts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث الدين" : "تمت إضافة الدين");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function settleDebt(d: Debt) {
    try {
      const res = await fetch("/api/debts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, settled: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success("تم تسوية الدين");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/debts?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الدين");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  function renderDebtCard(d: Debt, accent: "emerald" | "rose") {
    const isUSD = d.currency === "usd";
    const sypEq = toSYP(d.amount, d.currency);
    const dueDays = d.dueDate ? daysUntil(d.dueDate) : null;
    const overdue = dueDays !== null && dueDays < 0;
    const accentBg = accent === "emerald" ? "bg-emerald-glow/10 text-emerald-glow" : "bg-rose-500/10 text-rose-500";
    return (
      <Card key={d.id} className="group">
        <CardContent className="flex items-start gap-2 p-2">
          <div className={`flex size-8 items-center justify-center rounded-md shrink-0 ${accentBg}`}>
            {accent === "emerald" ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{d.personName}</span>
              <Badge variant="outline" className="text-[10px]">{isUSD ? "دولار" : "ليرة"}</Badge>
              {d.dueDate ? (
                <Badge
                  variant={overdue ? "destructive" : "secondary"}
                  className="text-[10px] gap-1"
                >
                  <Clock className="size-2.5" />
                  {overdue ? `متأخر ${Math.abs(dueDays!)} يوم` : formatDate(d.dueDate, { day: "numeric", month: "short" })}
                </Badge>
              ) : null}
            </div>
            {d.description ? (
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{d.description}</div>
            ) : null}
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-bold ${accent === "emerald" ? "text-emerald-glow" : "text-rose-500"}`}>
                {formatCurrency(d.amount, d.currency)}
              </span>
              {isUSD ? (
                <span className="text-[10px] text-muted-foreground">≈ {formatCurrency(sypEq, "syp")}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon" className="size-7 text-emerald-glow" title="تسوية" onClick={() => settleDebt(d)}>
              <CheckCircle2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" title="تعديل" onClick={() => openEdit(d)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-destructive" title="حذف" onClick={() => setDeleteId(d.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">الديون</h1>
          <p className="text-sm text-muted-foreground">{stats.count} دين نشط</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="size-4" />
            دين جديد
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCard
          icon={ArrowUpRight}
          label="إجمالي الديون لي"
          value={formatCurrency(stats.totalOwed, "syp")}
          accent="emerald"
        />
        <StatCard
          icon={ArrowDownRight}
          label="إجمالي الديون عليّ"
          value={formatCurrency(stats.totalOwe, "syp")}
          accent="rose"
        />
        <StatCard
          icon={HandCoins}
          label="الفرق الصافي"
          value={formatCurrency(stats.totalOwed - stats.totalOwe, "syp")}
          accent={stats.totalOwed - stats.totalOwe >= 0 ? "emerald" : "rose"}
        />
      </div>

      {/* filter */}
      <Card>
        <CardContent className="flex items-center gap-2 p-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as ViewFilter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="owed">ديون لي</SelectItem>
              <SelectItem value="owe">ديون عليّ</SelectItem>
            </SelectContent>
          </Select>
          <div className="mr-auto text-xs text-muted-foreground">
            الديون المسوّاة لا تُعرض
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل الديون</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : debts.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 pb-4 md:grid-cols-2">
            {/* owed to me */}
            {(filter === "all" || filter === "owed") && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-glow">
                  <ArrowUpRight className="size-4" />
                  ديون لي
                  <Badge variant="secondary" className="text-[10px]">{owedToMe.length}</Badge>
                </div>
                {owedToMe.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {owedToMe.map((d) => renderDebtCard(d, "emerald"))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                      <ArrowUpRight className="size-8 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">لا ديون لك حالياً</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* i owe */}
            {(filter === "all" || filter === "owe") && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-500">
                  <ArrowDownRight className="size-4" />
                  ديون عليّ
                  <Badge variant="secondary" className="text-[10px]">{iOwe.length}</Badge>
                </div>
                {iOwe.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {iOwe.map((d) => renderDebtCard(d, "rose"))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                      <ArrowDownRight className="size-8 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">لا ديون عليك حالياً</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <HandCoins className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا ديون مسجّلة</p>
            <p className="text-xs text-muted-foreground">أضف ديناً جديداً لمتابعة مستحقاتك</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={() => openAdd()}>
              <Plus className="size-4" />
              إضافة دين
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الدين" : "إضافة دين"}</DialogTitle>
            <DialogDescription>أدخل تفاصيل الدين.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="d-person">الاسم *</Label>
              <Input
                id="d-person"
                value={form.personName}
                onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
                placeholder="اسم الشخص"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="d-amount">المبلغ *</Label>
                <Input
                  id="d-amount"
                  type="number"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>العملة</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owed">دين لي (مستحق عليهم)</SelectItem>
                  <SelectItem value="owe">دين عليّ (مستحق لي عليهم)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-due">تاريخ الاستحقاق</Label>
              <Input
                id="d-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-desc">ملاحظة</Label>
              <Textarea
                id="d-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="سبب الدين أو تفاصيل إضافية"
              />
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
            <AlertDialogDescription>سيتم نقل الدين إلى سلة المحذوفات.</AlertDialogDescription>
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

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "emerald" | "amber" | "rose";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-glow bg-emerald-glow/10"
      : accent === "amber"
        ? "text-amber-glow bg-amber-glow/10"
        : "text-rose-500 bg-rose-500/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-2">
        <div className={`flex size-9 items-center justify-center rounded-md shrink-0 ${accentClass}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-sm font-bold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
