"use client";

import * as React from "react";
import {
  RefreshCw,
  CircleAlert,
  History,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  RefreshCcw,
  Download,
  Search,
  Filter,
  CalendarX,
} from "lucide-react";
import { useApi, toast, timeAgo } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface ActivityLog {
  id: string;
  action: string;
  entity: string;
  message: string;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  create: { label: "إنشاء", icon: Plus, color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  update: { label: "تعديل", icon: Pencil, color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  delete: { label: "حذف", icon: Trash2, color: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  toggle: { label: "تبديل", icon: ToggleLeft, color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  sync: { label: "مزامنة", icon: RefreshCcw, color: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  export: { label: "تصدير", icon: Download, color: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  import: { label: "استيراد", icon: Download, color: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
};

const ENTITY_LABELS: Record<string, string> = {
  contact: "جهة اتصال",
  note: "ملاحظة",
  task: "مهمة",
  event: "حدث",
  expense: "مصروف",
  debt: "دين",
  project: "مشروع",
  meeting: "اجتماع",
  diary: "مذكرة",
  medication: "دواء",
  account: "حساب",
  occasion: "مناسبة",
  habit: "عادة",
  budget: "ميزانية",
  sync: "مزامنة",
  automation: "أتمتة",
};

function actionMeta(a: string) {
  return ACTION_META[a] || { label: a, icon: History, color: "bg-slate-500/15 text-slate-500 border-slate-500/30" };
}

function entityLabel(e: string): string {
  return ENTITY_LABELS[e] || e;
}

export function ActivitySection() {
  const { data, loading, error, reload } = useApi<ActivityLog[]>("/api/activity?limit=200");
  const logs = data || [];

  const [entityFilter, setEntityFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  const entityOptions = React.useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.entity));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = React.useMemo(() => {
    let list = logs.slice();
    if (entityFilter !== "all") list = list.filter((l) => l.entity === entityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) => l.message.toLowerCase().includes(q));
    }
    return list;
  }, [logs, entityFilter, search]);

  const stats = React.useMemo(() => {
    const byAction: Record<string, number> = {};
    for (const l of logs) byAction[l.action] = (byAction[l.action] || 0) + 1;
    return {
      total: logs.length,
      byAction,
    };
  }, [logs]);

  async function clearOld() {
    setClearing(true);
    try {
      const before = new Date();
      before.setDate(before.getDate() - 30);
      const res = await fetch(`/api/activity?before=${before.toISOString()}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف السجلات الأقدم من 30 يوماً");
      setClearOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-1">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight">سجل النشاط</h1>
          <p className="text-sm text-muted-foreground">{stats.total} نشاط · آخر 200 سجل</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => setClearOpen(true)} disabled={stats.total === 0}>
            <CalendarX className="size-4" />
            مسح الأقدم من 30 يوماً
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-6">
        <StatCard label="إجمالي" value={stats.total} accent="emerald" />
        {Object.entries(ACTION_META).slice(0, 5).map(([key, m]) => (
          <StatCard
            key={key}
            label={m.label}
            value={stats.byAction[key] || 0}
            accent={key === "delete" ? "rose" : key === "create" ? "emerald" : key === "update" ? "blue" : key === "toggle" ? "amber" : "violet"}
          />
        ))}
      </div>

      {/* filters */}
      <Card>
        <CardContent className="flex flex-col gap-1 p-1 md:flex-row md:items-center">
          <div className="flex items-center gap-1 flex-1">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الرسالة"
              className="border-0 shadow-none focus-visible:ring-0 p-0 h-7"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {entityOptions.map((e) => (
                  <SelectItem key={e} value={e}>{entityLabel(e)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل السجل</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        {loading ? (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="flex flex-col gap-1 pb-4">
            {filtered.map((l) => {
              const m = actionMeta(l.action);
              const MIcon = m.icon;
              return (
                <div
                  key={l.id}
                  className="flex items-center gap-1 rounded-lg border p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className={`flex size-6 items-center justify-center rounded-md shrink-0 border ${m.color}`}>
                    <MIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${m.color} border`}>{m.label}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{entityLabel(l.entity)}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs truncate">{l.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {timeAgo(l.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <History className="size-6 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا سجلات</p>
            <p className="text-xs text-muted-foreground">
              {search || entityFilter !== "all" ? "لا نتائج مطابقة" : "ستظهر هنا كل الأنشطة في النظام"}
            </p>
          </div>
        )}
      </ScrollArea>

      {/* clear old confirm */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مسح السجلات القديمة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع سجلات النشاط الأقدم من 30 يوماً نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); clearOld(); }}
              disabled={clearing}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {clearing ? "جارٍ المسح..." : "مسح"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "emerald" | "rose" | "blue" | "amber" | "violet";
}) {
  const accentClass: Record<typeof accent, string> = {
    emerald: "text-emerald-glow bg-emerald-glow/10",
    rose: "text-rose-500 bg-rose-500/10",
    blue: "text-blue-500 bg-blue-500/10",
    amber: "text-amber-glow bg-amber-glow/10",
    violet: "text-violet-500 bg-violet-500/10",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-1 p-1">
        <div className={`flex size-7 items-center justify-center rounded-md shrink-0 ${accentClass[accent]}`}>
          <span className="text-xs font-bold">{value}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
      </CardContent>
    </Card>
  );
}
