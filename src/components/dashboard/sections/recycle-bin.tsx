"use client";

import * as React from "react";
import {
  RefreshCw,
  CircleAlert,
  Trash2,
  RotateCcw,
  Trash,
  User,
  StickyNote,
  CheckSquare,
  CalendarClock,
  Receipt,
  HandCoins,
  FolderKanban,
  Users,
  BookOpen,
  Pill,
  Inbox,
} from "lucide-react";
import { useApi, toast, timeAgo } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface RecycleItem {
  id: string;
  deletedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
  // type-specific
  name?: string;
  title?: string;
  content?: string;
  // contacts
  phone?: string;
  // generic fallback
  [key: string]: any;
}

interface RecycleData {
  contacts: RecycleItem[];
  notes: RecycleItem[];
  tasks: RecycleItem[];
  events: RecycleItem[];
  expenses: RecycleItem[];
  debts: RecycleItem[];
  projects: RecycleItem[];
  meetings: RecycleItem[];
  diary: RecycleItem[];
  medications: RecycleItem[];
}

const TYPE_META: Record<keyof RecycleData, { label: string; icon: React.ComponentType<{ className?: string }>; title: (i: RecycleItem) => string; subtitle?: (i: RecycleItem) => string }> = {
  contacts: { label: "جهات الاتصال", icon: User, title: (i) => i.name || "بدون اسم", subtitle: (i) => i.phone || "" },
  notes: { label: "الملاحظات", icon: StickyNote, title: (i) => i.title || "بدون عنوان", subtitle: (i) => i.content || "" },
  tasks: { label: "المهام", icon: CheckSquare, title: (i) => i.title || "بدون عنوان" },
  events: { label: "الأحداث", icon: CalendarClock, title: (i) => i.title || "بدون عنوان" },
  expenses: { label: "المصروفات", icon: Receipt, title: (i) => i.description || "مصروف" },
  debts: { label: "الديون", icon: HandCoins, title: (i) => i.personName || "دين" },
  projects: { label: "المشاريع", icon: FolderKanban, title: (i) => i.name || "مشروع" },
  meetings: { label: "الاجتماعات", icon: Users, title: (i) => i.title || "اجتماع" },
  diary: { label: "المذكرات", icon: BookOpen, title: (i) => i.title || "مذكرة", subtitle: (i) => i.content || "" },
  medications: { label: "الأدوية", icon: Pill, title: (i) => i.name || "دواء" },
};

const TYPE_ORDER: (keyof RecycleData)[] = [
  "contacts", "notes", "tasks", "events", "expenses", "debts", "projects", "meetings", "diary", "medications",
];

export function RecycleBinSection() {
  const { data: resp, raw, loading, error, reload } = useApi<RecycleData>("/api/recycle-bin");
  const data = resp || ({} as RecycleData);
  const total = raw?.total || 0;

  const [restoreTarget, setRestoreTarget] = React.useState<{ type: string; id: string } | null>(null);
  const [purgeTarget, setPurgeTarget] = React.useState<{ type: string; id: string } | null>(null);
  const [emptyOpen, setEmptyOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // restore all state
  const [restoringAll, setRestoringAll] = React.useState(false);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = {};
    TYPE_ORDER.forEach((t) => { map[t] = (data[t] || []).length; });
    return map;
  }, [data]);

  const activeTypes = TYPE_ORDER.filter((t) => counts[t] > 0);

  async function restoreItem(type: string, id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/recycle-bin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الاسترجاع");
      toast.success("تم استرجاع العنصر");
      setRestoreTarget(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function purgeItem(type: string, id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/recycle-bin?type=${type}&id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم الحذف النهائي");
      setPurgeTarget(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function restoreAll() {
    setRestoringAll(true);
    try {
      const items: Array<{ type: string; id: string }> = [];
      TYPE_ORDER.forEach((t) => {
        (data[t] || []).forEach((i) => items.push({ type: t, id: i.id }));
      });
      // Sequential to avoid race conditions
      for (const it of items) {
        await fetch("/api/recycle-bin", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(it),
        });
      }
      toast.success(`تم استرجاع ${items.length} عنصر`);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setRestoringAll(false);
    }
  }

  async function emptyBin() {
    setBusy(true);
    try {
      const items: Array<{ type: string; id: string }> = [];
      TYPE_ORDER.forEach((t) => {
        (data[t] || []).forEach((i) => items.push({ type: t, id: i.id }));
      });
      for (const it of items) {
        await fetch(`/api/recycle-bin?type=${it.type}&id=${it.id}`, { method: "DELETE" });
      }
      toast.success(`تم إفراغ السلة (${items.length} عنصر)`);
      setEmptyOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">سلة المحذوفات</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} عنصر محذوف — يمكن استرجاعه` : "السلة فارغة"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={restoreAll}
            disabled={total === 0 || restoringAll}
          >
            <RotateCcw className="size-4" />
            {restoringAll ? "جارٍ..." : "استرجاع الكل"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setEmptyOpen(true)}
            disabled={total === 0}
          >
            <Trash className="size-4" />
            إفراغ السلة
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل السلة</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <ScrollArea className="custom-scroll flex-1 min-h-0">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        </ScrollArea>
      ) : total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <Inbox className="size-9 text-muted-foreground/40" />
          <p className="text-sm font-medium">السلة فارغة</p>
          <p className="text-xs text-muted-foreground">لا توجد عناصر محذوفة لعرضها</p>
        </div>
      ) : (
        <Tabs defaultValue={activeTypes[0] || "contacts"} className="flex-1 min-h-0 flex flex-col gap-2">
          <ScrollArea className="custom-scroll w-full overflow-x-auto">
            <TabsList className="h-9">
              {TYPE_ORDER.map((t) => {
                const MIcon = TYPE_META[t].icon;
                const c = counts[t];
                return (
                  <TabsTrigger key={t} value={t} disabled={c === 0} className="gap-1.5">
                    <MIcon className="size-3.5" />
                    {TYPE_META[t].label}
                    {c > 0 ? <Badge variant="secondary" className="h-4 px-1 text-[10px]">{c}</Badge> : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </ScrollArea>

          {TYPE_ORDER.map((t) => {
            const meta = TYPE_META[t];
            const MIcon = meta.icon;
            const items = data[t] || [];
            if (items.length === 0) return null;
            return (
              <TabsContent key={t} value={t} className="flex-1 min-h-0 mt-0">
                <ScrollArea className="custom-scroll h-full max-h-[calc(100vh-280px)] -mx-1 px-1">
                  <div className="flex flex-col gap-2 pb-4">
                    {items.map((i) => {
                      const deletedAt = i.deletedAt || i.updatedAt || i.createdAt;
                      return (
                        <Card key={i.id} className="transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-2 p-2">
                            <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                              <MIcon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{meta.title(i)}</div>
                              {meta.subtitle ? (
                                <p className="text-xs text-muted-foreground truncate">{meta.subtitle(i)}</p>
                              ) : null}
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                {deletedAt ? `حُذف ${timeAgo(deletedAt)}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1"
                                onClick={() => setRestoreTarget({ type: t, id: i.id })}
                              >
                                <RotateCcw className="size-3.5" />
                                استرجاع
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-destructive"
                                onClick={() => setPurgeTarget({ type: t, id: i.id })}
                                aria-label="حذف نهائي"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* restore confirm */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>استرجاع العنصر</AlertDialogTitle>
            <AlertDialogDescription>سيتم إعادة العنصر إلى موقعه الأصلي.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (restoreTarget) restoreItem(restoreTarget.type, restoreTarget.id);
              }}
              disabled={busy}
            >
              {busy ? "جارٍ..." : "استرجاع"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* purge confirm */}
      <AlertDialog open={!!purgeTarget} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>الحذف النهائي</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف العنصر نهائياً ولا يمكن التراجع عن ذلك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (purgeTarget) purgeItem(purgeTarget.type, purgeTarget.id);
              }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? "جارٍ..." : "حذف نهائي"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* empty bin confirm */}
      <AlertDialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إفراغ السلة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع {total} عنصر نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); emptyBin(); }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? "جارٍ..." : "إفراغ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
