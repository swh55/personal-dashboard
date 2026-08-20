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
} from "lucide-react";
import { useApi } from "@/lib/api";
import {
  formatCurrency,
  USD_TO_SYP,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface ApiResponse {
  data: FinancesData;
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

function toSYP(amount: number, currency: string): number {
  return currency === "usd" ? amount * USD_TO_SYP : amount;
}

export function FinancesSection() {
  const { data: fin, loading, error, reload } = useApi<FinancesData>("/api/finances");

  return (
    <div className="flex h-full flex-col gap-1">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight">الوضع المالي</h1>
          <p className="text-sm text-muted-foreground">نظرة شاملة على الأصول والحسابات والديون</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="size-4" />
          تحديث
        </Button>
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
                    <div className="flex flex-col gap-1 max-h-72 overflow-y-auto custom-scroll">
                      {fin.accounts.map((a) => (
                        <div key={a.id} className="flex items-center gap-1 rounded-lg border p-2.5">
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
                          <div className="text-left shrink-0">
                            <div className={`text-sm font-bold ${a.balance >= 0 ? "text-emerald-glow" : "text-rose-500"}`}>
                              {formatCurrency(a.balance, a.currency)}
                            </div>
                            {a.currency === "usd" ? (
                              <div className="text-[10px] text-muted-foreground">≈ {formatCurrency(toSYP(a.balance, a.currency), "syp")}</div>
                            ) : null}
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
