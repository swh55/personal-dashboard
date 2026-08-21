"use client";

import * as React from "react";
import {
  RefreshCw,
  CircleAlert,
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  Banknote,
  Coins,
  PiggyBank,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Plus,
  ArrowLeftRight,
  ArrowDownToLine,
  Loader2,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import {
  formatCurrency,
  USD_TO_SYP,
  CURRENCIES,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Asset {
  id: string;
  name: string;
  amount: number;
  currency: string;
  type: string;
  description: string | null;
}

interface Account {
  id: string;
  name: string;
  balance: number;
  currency: string;
  type: string;
  institution: string | null;
}

interface Debt {
  id: string;
  personName: string;
  amount: number;
  currency: string;
  type: string; // owed / owe
  description: string | null;
  dueDate: string | null;
}

interface FinancesData {
  assets: Asset[];
  accounts: Account[];
  debts: Debt[];
  budgets: any[];
  totalAssets: number;
  totalAccounts: number;
  totalOwed: number;
  totalOwe: number;
  netWorth: number;
  monthSpend: number;
  monthExpenseCount: number;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  cash: "نقد",
  bank: "مصرف",
  "real-estate": "عقارات",
  gold: "ذهب",
  stocks: "أسهم",
  other: "أخرى",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "مصرفي",
  cash: "نقدي",
  savings: "توفير",
  credit: "ائتماني",
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: "bank", label: "مصرفي" },
  { value: "cash", label: "نقدي" },
  { value: "savings", label: "توفير" },
  { value: "credit", label: "ائتماني" },
];

function toSYP(amount: number, currency: string): number {
  return currency === "usd" ? amount * USD_TO_SYP : amount;
}

const EMPTY_ACCOUNT_FORM = {
  name: "",
  balance: "",
  currency: "syp",
  type: "bank",
  institution: "",
};

const EMPTY_TRANSFER_FORM = {
  fromAccountId: "",
  toAccountId: "",
  amount: "",
  currency: "syp",
  note: "",
};

const EMPTY_INCOME_FORM = {
  accountId: "",
  amount: "",
  currency: "syp",
  note: "",
};

export function FinancesSection() {
  const { data: fin, loading, error, reload } = useApi<FinancesData>("/api/finances");
  const accounts = fin?.accounts ?? [];

  // --- Add Account dialog ---
  const [addOpen, setAddOpen] = React.useState(false);
  const [addForm, setAddForm] = React.useState(EMPTY_ACCOUNT_FORM);
  const [addSubmitting, setAddSubmitting] = React.useState(false);

  // --- Transfer dialog ---
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferForm, setTransferForm] = React.useState(EMPTY_TRANSFER_FORM);
  const [transferSubmitting, setTransferSubmitting] = React.useState(false);

  // --- Income dialog ---
  const [incomeOpen, setIncomeOpen] = React.useState(false);
  const [incomeForm, setIncomeForm] = React.useState(EMPTY_INCOME_FORM);
  const [incomeSubmitting, setIncomeSubmitting] = React.useState(false);

  // Auto-sync currency from the selected source account in the transfer dialog
  React.useEffect(() => {
    if (!transferForm.fromAccountId) return;
    const src = accounts.find((a) => a.id === transferForm.fromAccountId);
    if (src && transferForm.currency !== src.currency) {
      setTransferForm((f) => ({ ...f, currency: src.currency }));
    }
  }, [transferForm.fromAccountId, accounts, transferForm.currency]);

  // Auto-sync currency from the selected account in the income dialog
  React.useEffect(() => {
    if (!incomeForm.accountId) return;
    const acc = accounts.find((a) => a.id === incomeForm.accountId);
    if (acc && incomeForm.currency !== acc.currency) {
      setIncomeForm((f) => ({ ...f, currency: acc.currency }));
    }
  }, [incomeForm.accountId, accounts, incomeForm.currency]);

  function openAddDialog() {
    setAddForm(EMPTY_ACCOUNT_FORM);
    setAddOpen(true);
  }

  function openTransferDialog() {
    if (accounts.length < 2) {
      toast.error("يلزم وجود حسابان على الأقل لإجراء تحويل");
      return;
    }
    setTransferForm({
      ...EMPTY_TRANSFER_FORM,
      fromAccountId: accounts[0]?.id ?? "",
      toAccountId: accounts[1]?.id ?? "",
      currency: accounts[0]?.currency ?? "syp",
    });
    setTransferOpen(true);
  }

  function openIncomeDialog(account: Account) {
    setIncomeForm({
      ...EMPTY_INCOME_FORM,
      accountId: account.id,
      currency: account.currency,
    });
    setIncomeOpen(true);
  }

  async function submitAdd() {
    if (!addForm.name.trim()) {
      toast.error("اسم الحساب مطلوب");
      return;
    }
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          balance: Number(addForm.balance) || 0,
          currency: addForm.currency,
          type: addForm.type,
          institution: addForm.institution.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success("تمت إضافة الحساب");
      setAddOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function submitTransfer() {
    if (!transferForm.fromAccountId || !transferForm.toAccountId) {
      toast.error("يلزم اختيار الحسابين");
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      toast.error("لا يمكن التحويل من حساب إلى نفسه");
      return;
    }
    const amt = Number(transferForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("المبلغ غير صالح");
      return;
    }
    setTransferSubmitting(true);
    try {
      const res = await fetch("/api/accounts/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: transferForm.fromAccountId,
          toAccountId: transferForm.toAccountId,
          amount: amt,
          currency: transferForm.currency,
          note: transferForm.note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحويل");
      toast.success("تم التحويل بنجاح");
      setTransferOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setTransferSubmitting(false);
    }
  }

  async function submitIncome() {
    if (!incomeForm.accountId) {
      toast.error("يلزم اختيار الحساب");
      return;
    }
    const amt = Number(incomeForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("المبلغ غير صالح");
      return;
    }
    setIncomeSubmitting(true);
    try {
      const res = await fetch("/api/accounts/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: incomeForm.accountId,
          amount: amt,
          currency: incomeForm.currency,
          note: incomeForm.note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل تسجيل الوارد");
      toast.success("تم تسجيل الوارد");
      setIncomeOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setIncomeSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-1">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight">الوضع المالي</h1>
          <p className="text-sm text-muted-foreground">نظرة شاملة على الأصول والحسابات والديون</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openTransferDialog}
            disabled={loading}
            title="تحويل بين الحسابات"
          >
            <ArrowLeftRight className="size-4" />
            تحويل
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="size-4" />
            حساب جديد
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل البيانات المالية</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        {loading || !fin ? (
          <div className="flex flex-col gap-1">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 pb-4">
            {/* net worth hero */}
            <Card className="overflow-hidden border-emerald-glow/30">
              <div className="bg-gradient-to-l from-emerald-glow/15 to-amber-glow/10 p-3">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Scale className="size-4" />
                      صافي الثروة
                    </div>
                    <div
                      className={`text-lg font-bold mt-1 ${
                        fin.netWorth >= 0 ? "text-emerald-glow" : "text-rose-500"
                      }`}
                    >
                      {formatCurrency(fin.netWorth, "syp")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      الأصول + الحسابات + ديون لي − ديون عليّ
                    </div>
                  </div>
                  <div className="flex size-14 items-center justify-center rounded-full bg-emerald-glow/15 text-emerald-glow shrink-0">
                    <Wallet className="size-7" />
                  </div>
                </div>
              </div>
            </Card>

            {/* 4 stat cards */}
            <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
              <StatCard
                icon={Coins}
                label="إجمالي الأصول"
                value={formatCurrency(fin.totalAssets, "syp")}
                accent="emerald"
              />
              <StatCard
                icon={Landmark}
                label="إجمالي الحسابات"
                value={formatCurrency(fin.totalAccounts, "syp")}
                accent="emerald"
              />
              <StatCard
                icon={ArrowUpRight}
                label="ديون لي"
                value={formatCurrency(fin.totalOwed, "syp")}
                accent="emerald"
              />
              <StatCard
                icon={ArrowDownRight}
                label="ديون عليّ"
                value={formatCurrency(fin.totalOwe, "syp")}
                accent="rose"
              />
            </div>

            {/* monthly spend */}
            <Card>
              <CardContent className="flex items-center justify-between gap-1 p-1">
                <div className="flex items-center gap-1">
                  <div className="flex size-6 items-center justify-center rounded-md bg-amber-glow/10 text-amber-glow">
                    <TrendingDown className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">مصروفات هذا الشهر</div>
                    <div className="text-base font-bold">{formatCurrency(fin.monthSpend, "syp")}</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{fin.monthExpenseCount} مصروف</Badge>
              </CardContent>
            </Card>

            {/* assets + accounts grid */}
            <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {/* assets */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1 text-base">
                    <Coins className="size-4 text-emerald-glow" />
                    الأصول
                    <Badge variant="secondary" className="text-[10px] me-auto">{fin.assets.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                  {fin.assets.length > 0 ? (
                    <div className="flex flex-col gap-1 max-h-72 overflow-y-auto custom-scroll">
                      {fin.assets.map((a) => (
                        <div key={a.id} className="flex items-center gap-1 rounded-lg border p-2.5">
                          <div className="flex size-7 items-center justify-center rounded-md bg-emerald-glow/10 text-emerald-glow shrink-0">
                            <PiggyBank className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-semibold truncate">{a.name}</span>
                              <Badge variant="outline" className="text-[10px]">{ASSET_TYPE_LABELS[a.type] || a.type}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(a.amount, a.currency)}
                              {a.currency === "usd" ? (
                                <span className="me-1">· ≈ {formatCurrency(toSYP(a.amount, a.currency), "syp")}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyMini text="لا أصول مسجّلة" icon={Coins} />
                  )}
                </CardContent>
              </Card>

              {/* accounts */}
              <Card className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1 text-base">
                    <Landmark className="size-4 text-amber-glow" />
                    الحسابات
                    <Badge variant="secondary" className="text-[10px] me-auto">{fin.accounts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                  {fin.accounts.length > 0 ? (
                    <div className="flex flex-col gap-1 max-h-80 overflow-y-auto custom-scroll">
                      {fin.accounts.map((a) => (
                        <div
                          key={a.id}
                          className="group rounded-lg border p-2 transition-colors hover:border-emerald-glow/40"
                        >
                          <div className="flex items-center gap-1">
                            <div className="flex size-7 items-center justify-center rounded-md bg-amber-glow/10 text-amber-glow shrink-0">
                              <CreditCard className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-semibold truncate">{a.name}</span>
                                <Badge variant="outline" className="text-[10px]">{ACCOUNT_TYPE_LABELS[a.type] || a.type}</Badge>
                              </div>
                              {a.institution ? (
                                <div className="text-xs text-muted-foreground truncate">{a.institution}</div>
                              ) : null}
                            </div>
                            {/* balance — prominent */}
                            <div className="text-end shrink-0">
                              <div className={`text-sm font-bold ${a.balance >= 0 ? "text-emerald-glow" : "text-rose-500"}`}>
                                {formatCurrency(a.balance, a.currency)}
                              </div>
                              {a.currency === "usd" ? (
                                <div className="text-[10px] text-muted-foreground">≈ {formatCurrency(toSYP(a.balance, a.currency), "syp")}</div>
                              ) : null}
                            </div>
                          </div>
                          {/* per-account action: add income */}
                          <div className="mt-1 flex justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 gap-1 px-2 text-[11px] text-emerald-glow hover:bg-emerald-glow/10 hover:text-emerald-glow"
                              onClick={() => openIncomeDialog(a)}
                            >
                              <ArrowDownToLine className="size-3" />
                              وارد
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyMini text="لا حسابات مسجّلة" icon={Landmark} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* debts overview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1 text-base">
                  <Scale className="size-4 text-emerald-glow" />
                  نظرة على الديون
                  <Badge variant="secondary" className="text-[10px] me-auto">{fin.debts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fin.debts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                    {/* owed to me */}
                    <div className="rounded-lg border border-emerald-glow/20 bg-emerald-glow/5 p-2">
                      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-glow mb-2">
                        <TrendingUp className="size-4" />
                        ديون لي ({fin.debts.filter((d) => d.type === "owed").length})
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto custom-scroll">
                        {fin.debts.filter((d) => d.type === "owed").map((d) => (
                          <div key={d.id} className="flex items-center justify-between gap-1 text-sm">
                            <span className="truncate">{d.personName}</span>
                            <span className="font-medium text-emerald-glow shrink-0">{formatCurrency(d.amount, d.currency)}</span>
                          </div>
                        ))}
                        {fin.debts.filter((d) => d.type === "owed").length === 0 ? (
                          <div className="text-xs text-muted-foreground py-1 text-center">لا ديون لك</div>
                        ) : null}
                      </div>
                    </div>
                    {/* owe */}
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2">
                      <div className="flex items-center gap-1 text-xs font-semibold text-rose-500 mb-2">
                        <TrendingDown className="size-4" />
                        ديون عليّ ({fin.debts.filter((d) => d.type === "owe").length})
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto custom-scroll">
                        {fin.debts.filter((d) => d.type === "owe").map((d) => (
                          <div key={d.id} className="flex items-center justify-between gap-1 text-sm">
                            <span className="truncate">{d.personName}</span>
                            <span className="font-medium text-rose-500 shrink-0">{formatCurrency(d.amount, d.currency)}</span>
                          </div>
                        ))}
                        {fin.debts.filter((d) => d.type === "owe").length === 0 ? (
                          <div className="text-xs text-muted-foreground py-1 text-center">لا ديون عليك</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyMini text="لا ديون مسجّلة" icon={Scale} />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </ScrollArea>

      {/* Add Account Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة حساب</DialogTitle>
            <DialogDescription>أدخل تفاصيل الحساب المالي.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="f-name">اسم الحساب *</Label>
              <Input
                id="f-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثال: حساب البنك الرئيسي"
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="grid gap-1.5">
                <Label htmlFor="f-balance">الرصيد الابتدائي</Label>
                <Input
                  id="f-balance"
                  type="number"
                  inputMode="decimal"
                  value={addForm.balance}
                  onChange={(e) => setAddForm((f) => ({ ...f, balance: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>العملة</Label>
                <Select
                  value={addForm.currency}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, currency: v }))}
                >
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
              <Select
                value={addForm.type}
                onValueChange={(v) => setAddForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-institution">المؤسسة (اختياري)</Label>
              <Input
                id="f-institution"
                value={addForm.institution}
                onChange={(e) => setAddForm((f) => ({ ...f, institution: e.target.value }))}
                placeholder="مثال: بنك سوريا الدولي الإسلامي"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={submitAdd} disabled={addSubmitting}>
              {addSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تحويل بين الحسابات</DialogTitle>
            <DialogDescription>انقل مبلغاً من حساب إلى آخر لديك.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 py-1">
            <div className="grid gap-1.5">
              <Label>من حساب *</Label>
              <Select
                value={transferForm.fromAccountId}
                onValueChange={(v) => setTransferForm((f) => ({ ...f, fromAccountId: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر الحساب المصدري" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {formatCurrency(a.balance, a.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>إلى حساب *</Label>
              <Select
                value={transferForm.toAccountId}
                onValueChange={(v) => setTransferForm((f) => ({ ...f, toAccountId: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر حساب الوجهة" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id}
                      disabled={a.id === transferForm.fromAccountId}
                    >
                      {a.name} · {formatCurrency(a.balance, a.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="grid gap-1.5">
                <Label htmlFor="t-amount">المبلغ *</Label>
                <Input
                  id="t-amount"
                  type="number"
                  inputMode="decimal"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>العملة</Label>
                <Select
                  value={transferForm.currency}
                  onValueChange={(v) => setTransferForm((f) => ({ ...f, currency: v }))}
                >
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
              <Label htmlFor="t-note">ملاحظة (اختياري)</Label>
              <Input
                id="t-note"
                value={transferForm.note}
                onChange={(e) => setTransferForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="مثال: رواتب، مصاريف بيت..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>إلغاء</Button>
            <Button onClick={submitTransfer} disabled={transferSubmitting}>
              {transferSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جارٍ التحويل...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="size-4" />
                  تحويل
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Income Dialog */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل وارد</DialogTitle>
            <DialogDescription>أضف دخلاً إلى حساب معيّن.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 py-1">
            <div className="grid gap-1.5">
              <Label>الحساب *</Label>
              <Select
                value={incomeForm.accountId}
                onValueChange={(v) => setIncomeForm((f) => ({ ...f, accountId: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {formatCurrency(a.balance, a.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="grid gap-1.5">
                <Label htmlFor="i-amount">المبلغ *</Label>
                <Input
                  id="i-amount"
                  type="number"
                  inputMode="decimal"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>العملة</Label>
                <Select
                  value={incomeForm.currency}
                  onValueChange={(v) => setIncomeForm((f) => ({ ...f, currency: v }))}
                >
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
              <Label htmlFor="i-note">ملاحظة / المصدر (اختياري)</Label>
              <Input
                id="i-note"
                value={incomeForm.note}
                onChange={(e) => setIncomeForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="مثال: راتب، مبيعات..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncomeOpen(false)}>إلغاء</Button>
            <Button onClick={submitIncome} disabled={incomeSubmitting}>
              {incomeSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : (
                <>
                  <ArrowDownToLine className="size-4" />
                  تسجيل الوارد
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <CardContent className="flex items-center gap-1 p-1">
        <div className={`flex size-7 items-center justify-center rounded-md shrink-0 ${accentClass}`}>
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

function EmptyMini({ text, icon: Icon }: { text: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <Icon className="size-6 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
