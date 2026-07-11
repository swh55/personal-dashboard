"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Wallet,
  Banknote,
  Landmark,
  PiggyBank,
  CreditCard,
  DollarSign,
  Coins,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import { CURRENCIES, USD_TO_SYP, formatCurrency } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Account {
  id: string;
  name: string;
  balance: number;
  currency: string;
  type: string;
  institution: string | null;
  createdAt: string;
}

interface AccountStats {
  totalSYP: number;
  totalUSD: number;
  count: number;
}

const ACCOUNT_TYPES = [
  { value: "bank", label: "بنك", icon: Landmark, color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "cash", label: "نقد", icon: Banknote, color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "savings", label: "توفير", icon: PiggyBank, color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { value: "credit", label: "ائتمان", icon: CreditCard, color: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
];

function typeMeta(t: string) {
  return ACCOUNT_TYPES.find((x) => x.value === t) || ACCOUNT_TYPES[0];
}

const EMPTY_FORM = {
  name: "",
  balance: "",
  currency: "syp",
  type: "bank",
  institution: "",
};

export function AccountsSection() {
  const { data, raw, loading, error, reload } = useApi<Account[]>("/api/accounts");
  const accounts = data || [];
  const stats: AccountStats = raw?.stats || { totalSYP: 0, totalUSD: 0, count: 0 };

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const totalSYPValue = stats.totalSYP + stats.totalUSD * USD_TO_SYP;

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({
      name: a.name,
      balance: String(a.balance),
      currency: a.currency,
      type: a.type,
      institution: a.institution || "",
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("اسم الحساب مطلوب");
      return;
    }
    const balance = Number(form.balance) || 0;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        balance,
        currency: form.currency,
        type: form.type,
        institution: form.institution.trim() || null,
      };
      const res = await fetch("/api/accounts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث الحساب" : "تمت إضافة الحساب");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/accounts?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الحساب");
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
          <h1 className="text-xl font-bold tracking-tight">الحسابات</h1>
          <p className="text-sm text-muted-foreground">{stats.count} حساب · إدارة الحسابات البنكية والنقدية</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            حساب جديد
          </Button>
        </div>
      </div>

      {/* hero + stats */}
      <div className="grid gap-2 lg:grid-cols-[2fr_1fr_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-0 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-glow/15 via-transparent to-amber-glow/15 pointer-events-none" />
            <div className="relative p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4" />
                إجمالي الرصيد (بما يعادل الليرة)
              </div>
              <div className="mt-1 text-xl font-bold tracking-tight text-emerald-glow">
                {formatCurrency(totalSYPValue, "syp")}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1">
                  <Coins className="size-3 text-emerald-glow" />
                  <span className="text-muted-foreground">بالليرة:</span>
                  <span className="font-semibold">{formatCurrency(stats.totalSYP, "syp")}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="size-3 text-amber-glow" />
                  <span className="text-muted-foreground">بالدولار:</span>
                  <span className="font-semibold">{formatCurrency(stats.totalUSD, "usd")}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 p-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-emerald-glow/10 text-emerald-glow shrink-0">
              <Coins className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">عدد الحسابات</div>
              <div className="text-lg font-bold">{stats.count}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-2 p-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-amber-glow/10 text-amber-glow shrink-0">
              <DollarSign className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">إجمالي بالدولار</div>
              <div className="text-lg font-bold truncate">{formatCurrency(stats.totalUSD, "usd")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل الحسابات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : accounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => {
              const t = typeMeta(a.type);
              const TIcon = t.icon;
              const isUSD = a.currency === "usd";
              const isNegative = a.balance < 0;
              return (
                <Card key={a.id} className="group transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-2 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`flex size-8 items-center justify-center rounded-md shrink-0 ${t.color}`}>
                          <TIcon className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{a.name}</div>
                          <Badge variant="outline" className={`text-[10px] ${t.color} border`}>{t.label}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(a)} aria-label="تعديل">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setDeleteId(a.id)} aria-label="حذف">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    {a.institution ? (
                      <div className="text-xs text-muted-foreground truncate">{a.institution}</div>
                    ) : null}
                    <div className="mt-1">
                      <div className={`text-lg font-bold ${isNegative ? "text-rose-500" : isUSD ? "text-amber-glow" : "text-emerald-glow"}`}>
                        {isNegative ? "-" : ""}{formatCurrency(Math.abs(a.balance), a.currency)}
                      </div>
                      {isUSD ? (
                        <div className="text-[10px] text-muted-foreground">≈ {formatCurrency(a.balance * USD_TO_SYP, "syp")}</div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Wallet className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا حسابات</p>
            <p className="text-xs text-muted-foreground">أضف أول حساب لمتابعة أرصدتك</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              حساب جديد
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل حساب" : "إضافة حساب"}</DialogTitle>
            <DialogDescription>أدخل تفاصيل الحساب المالي.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="a-name">اسم الحساب *</Label>
              <Input id="a-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="مثال: حساب البنك الرئيسي" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="a-balance">الرصيد</Label>
                <Input
                  id="a-balance"
                  type="number"
                  inputMode="decimal"
                  value={form.balance}
                  onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                  placeholder="0"
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
              <Label>نوع الحساب</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-institution">المؤسسة</Label>
              <Input id="a-institution" value={form.institution} onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))} placeholder="مثال: بنك سوريا الدولي الإسلامي" />
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
            <AlertDialogTitle>تأكيد حذف الحساب</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف الحساب نهائياً. لا يمكن التراجع.</AlertDialogDescription>
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
