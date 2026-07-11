"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Receipt,
  Filter,
  PieChart as PieIcon,
  DollarSign,
  Banknote,
  Tag,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useApi, toast, formatDate } from "@/lib/api";
import {
  EXPENSE_CATEGORIES,
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
import { Switch } from "@/components/ui/switch";
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

interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  date: string;
  createdAt: string;
}

interface ExpenseStats {
  totalSYP: number;
  totalUSD: number;
  count: number;
  byCategory: Record<string, { syp: number; usd: number; count: number }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  food: "#10b981",
  transport: "#f59e0b",
  bills: "#ef4444",
  health: "#8b5cf6",
  shopping: "#ec4899",
  education: "#0ea5e9",
  entertainment: "#f97316",
  charity: "#14b8a6",
  general: "#64748b",
};

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

function categoryLabel(c: string): string {
  return EXPENSE_CATEGORIES.find((x) => x.value === c)?.label || c;
}

function toSYP(amount: number, currency: string): number {
  return currency === "usd" ? amount * USD_TO_SYP : amount;
}

const EMPTY_FORM = {
  amount: "",
  currency: "syp",
  category: "general",
  description: "",
  date: new Date().toISOString().slice(0, 10),
};

type DateRange = "all" | "week" | "month";

export function ExpensesSection() {
  const { data, raw, loading, error, reload } = useApi<Expense[]>("/api/expenses");
  const expenses = data || [];
  const stats: ExpenseStats = raw?.stats || { totalSYP: 0, totalUSD: 0, count: 0, byCategory: {} };

  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [dateRange, setDateRange] = React.useState<DateRange>("month");
  const [convertAll, setConvertAll] = React.useState(false);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Expense | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const filtered = React.useMemo(() => {
    let list = expenses.slice();
    if (categoryFilter !== "all") list = list.filter((e) => e.category === categoryFilter);
    if (dateRange !== "all") {
      const now = new Date();
      let from: Date;
      if (dateRange === "week") {
        const day = now.getDay();
        const diff = (day === 6 ? 0 : day + 1); // Saturday start (RTL week)
        from = new Date(now);
        from.setDate(now.getDate() - diff);
        from.setHours(0, 0, 0, 0);
      } else {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      list = list.filter((e) => new Date(e.date) >= from);
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, categoryFilter, dateRange]);

  // Compute filtered stats client-side (since server stats reflect all data)
  const viewStats = React.useMemo(() => {
    const totalSYP = filtered.filter((e) => e.currency === "syp").reduce((s, e) => s + e.amount, 0);
    const totalUSD = filtered.filter((e) => e.currency === "usd").reduce((s, e) => s + e.amount, 0);
    const byCat: Record<string, { value: number; count: number }> = {};
    for (const e of filtered) {
      const sypEq = toSYP(e.amount, e.currency);
      if (!byCat[e.category]) byCat[e.category] = { value: 0, count: 0 };
      byCat[e.category].value += sypEq;
      byCat[e.category].count += 1;
    }
    const topCat = Object.entries(byCat).sort((a, b) => b[1].value - a[1].value)[0];
    return {
      totalSYP,
      totalUSD,
      count: filtered.length,
      byCategory: byCat,
      topCategory: topCat ? topCat[0] : null,
      topCategoryValue: topCat ? topCat[1].value : 0,
    };
  }, [filtered]);

  const pieData = React.useMemo(() => {
    return Object.entries(viewStats.byCategory).map(([cat, v]) => ({
      name: categoryLabel(cat),
      value: Math.round(v.value),
      count: v.count,
    }));
  }, [viewStats]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      amount: String(e.amount),
      currency: e.currency,
      category: e.category,
      description: e.description || "",
      date: new Date(e.date).toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  }

  async function submit() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        amount,
        currency: form.currency,
        category: form.category,
        description: form.description.trim() || null,
        date: new Date(form.date).toISOString(),
      };
      const res = await fetch("/api/expenses", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث المصروف" : "تمت إضافة المصروف");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/expenses?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف المصروف");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحذف");
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">المصروفات</h1>
          <p className="text-sm text-muted-foreground">
            {viewStats.count} مصروف · لهذا {dateRange === "week" ? "الأسبوع" : dateRange === "month" ? "الشهر" : "الكل"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            مصروف جديد
          </Button>
        </div>
      </div>

      {/* stats cards */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          icon={Banknote}
          label="مصروفات بالليرة"
          value={formatCurrency(viewStats.totalSYP, "syp")}
          accent="emerald"
        />
        <StatCard
          icon={DollarSign}
          label="مصروفات بالدولار"
          value={formatCurrency(viewStats.totalUSD, "usd")}
          accent="amber"
        />
        <StatCard
          icon={Receipt}
          label="عدد المصروفات"
          value={String(viewStats.count)}
          accent="emerald"
        />
        <StatCard
          icon={Tag}
          label="أعلى تصنيف"
          value={viewStats.topCategory ? `${categoryLabel(viewStats.topCategory)} (${formatCurrency(viewStats.topCategoryValue, "syp")})` : "—"}
          accent="amber"
          small
        />
      </div>

      {/* filters */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-2 md:flex-row md:items-center md:flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="all">الكل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 mr-auto">
            <Label htmlFor="convert-all" className="text-sm text-muted-foreground">عرض القيمة بالليرة</Label>
            <Switch id="convert-all" checked={convertAll} onCheckedChange={setConvertAll} />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل المصروفات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid flex-1 min-h-0 gap-2 lg:grid-cols-[1fr_300px]">
        {/* expense list */}
        <ScrollArea className="custom-scroll -mx-1 px-1 min-h-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="flex flex-col gap-2 pb-4">
              {filtered.map((e) => {
                const isUSD = e.currency === "usd";
                const sypEq = toSYP(e.amount, e.currency);
                return (
                  <Card key={e.id} className="group transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center gap-2 p-2">
                      <div
                        className="flex size-8 items-center justify-center rounded-md text-white shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[e.category] || "#64748b" }}
                      >
                        <Receipt className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{categoryLabel(e.category)}</Badge>
                          <Badge variant="outline" className="text-[10px]">{isUSD ? "دولار" : "ليرة"}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(e.date, { day: "numeric", month: "short" })}</span>
                        </div>
                        <div className="text-sm font-medium truncate mt-0.5">{e.description || "بدون وصف"}</div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className={`text-sm font-bold ${isUSD ? "text-amber-glow" : "text-emerald-glow"}`}>
                          {formatCurrency(e.amount, e.currency)}
                        </div>
                        {convertAll && !isUSD ? (
                          <div className="text-[10px] text-muted-foreground">≈ {formatCurrency(sypEq, "syp")}</div>
                        ) : null}
                        {convertAll && isUSD ? (
                          <div className="text-[10px] text-muted-foreground">≈ {formatCurrency(sypEq, "syp")}</div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(e)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteId(e.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Receipt className="size-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">لا مصروفات</p>
              <p className="text-xs text-muted-foreground">لم تُسجَّل مصروفات ضمن الفلتر الحالي</p>
              <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
                <Plus className="size-4" />
                إضافة مصروف
              </Button>
            </div>
          )}
        </ScrollArea>

        {/* pie chart */}
        <Card className="hidden lg:flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieIcon className="size-4 text-emerald-glow" />
              توزيع حسب التصنيف
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            {loading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : pieData.length > 0 ? (
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, _n: string, item: any) => [
                        `${formatCurrency(v, "syp")} (${item.payload.count} مصروف)`,
                        item.payload.name,
                      ]}
                      contentStyle={{ direction: "rtl", fontSize: "12px", borderRadius: "8px" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", direction: "rtl" }}
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                لا بيانات للعرض
              </div>
            )}
            <div className="mt-2 text-center">
              <div className="text-[11px] text-muted-foreground">الإجمالي بالليرة</div>
              <div className="text-sm font-bold text-emerald-glow">
                {formatCurrency(viewStats.totalSYP + viewStats.totalUSD * USD_TO_SYP, "syp")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل المصروف" : "إضافة مصروف"}</DialogTitle>
            <DialogDescription>سجّل تفاصيل المصروف.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="e-amount">المبلغ *</Label>
                <Input
                  id="e-amount"
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
              <Label>التصنيف</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-date">التاريخ</Label>
              <Input
                id="e-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-desc">الوصف</Label>
              <Textarea
                id="e-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="مثال: فاتورة كهرباء"
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
            <AlertDialogDescription>سيتم نقل المصروف إلى سلة المحذوفات.</AlertDialogDescription>
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
  small,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "emerald" | "amber";
  small?: boolean;
}) {
  const accentClass = accent === "emerald" ? "text-emerald-glow bg-emerald-glow/10" : "text-amber-glow bg-amber-glow/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-2">
        <div className={`flex size-9 items-center justify-center rounded-md shrink-0 ${accentClass}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className={`font-bold truncate ${small ? "text-sm" : "text-base"}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
