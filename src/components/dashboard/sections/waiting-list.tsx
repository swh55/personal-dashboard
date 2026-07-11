"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Clock,
  CheckCircle2,
  ListChecks,
  Star,
  Hourglass,
} from "lucide-react";
import { useApi, toast, timeAgo } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface WaitingItem {
  id: string;
  title: string;
  description: string | null;
  priority: number; // 1-5
  ready: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WaitingMeta {
  count: number;
  ready: number;
  pending: number;
}

const PRIORITY_META: Record<number, { label: string; cls: string; star: string }> = {
  5: { label: "أعلى", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30", star: "text-rose-500" },
  4: { label: "عالية", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", star: "text-amber-500" },
  3: { label: "متوسطة", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30", star: "text-blue-500" },
  2: { label: "منخفضة", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", star: "text-emerald-500" },
  1: { label: "أدنى", cls: "bg-slate-500/15 text-slate-500 border-slate-500/30", star: "text-slate-500" },
};

function priorityMeta(p: number) {
  return PRIORITY_META[p] || PRIORITY_META[3];
}

const EMPTY_FORM = {
  title: "",
  description: "",
  priority: 3,
  ready: false,
};

type TabValue = "all" | "ready" | "pending";

export function WaitingListSection() {
  const { data, raw, loading, error, reload } = useApi<WaitingItem[]>("/api/waiting-list");
  const items = data || [];
  const meta: WaitingMeta | undefined = raw?.meta;

  const [tab, setTab] = React.useState<TabValue>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WaitingItem | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const stats = React.useMemo(() => ({
    total: meta?.count ?? items.length,
    ready: meta?.ready ?? items.filter((i) => i.ready).length,
    pending: meta?.pending ?? items.filter((i) => !i.ready).length,
  }), [meta, items]);

  const filtered = React.useMemo(() => {
    if (tab === "ready") return items.filter((i) => i.ready);
    if (tab === "pending") return items.filter((i) => !i.ready);
    return items;
  }, [items, tab]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(it: WaitingItem) {
    setEditing(it);
    setForm({
      title: it.title,
      description: it.description || "",
      priority: it.priority,
      ready: it.ready,
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
        priority: Number(form.priority),
        ready: Boolean(form.ready),
      };
      const res = await fetch("/api/waiting-list", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث العنصر" : "تمت إضافة العنصر");
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
      const res = await fetch(`/api/waiting-list?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف العنصر");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function toggleReady(it: WaitingItem, next: boolean) {
    setTogglingId(it.id);
    try {
      const res = await fetch("/api/waiting-list", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id, ready: next }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(next ? "تم تمييز العنصر كجاهز" : "تم تمييز العنصر كغير جاهز");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setTogglingId(null);
    }
  }

  const statCards = [
    { label: "الإجمالي", value: stats.total, icon: ListChecks, cls: "bg-emerald-glow/15 text-emerald-glow" },
    { label: "جاهز", value: stats.ready, icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-500" },
    { label: "بانتظار", value: stats.pending, icon: Hourglass, cls: "bg-amber-500/15 text-amber-500" },
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">قائمة الانتظار</h2>
          <p className="text-sm text-muted-foreground">
            العناصر والأفكار في انتظار تنفيذها — مرتّبة حسب الأولوية
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>عنصر جديد</span>
          </Button>
        </div>
      </header>

      {/* stats */}
      <div className="grid grid-cols-3 gap-2">
        {statCards.map((s) => {
          const I = s.icon;
          return (
            <Card key={s.label} className="border-border/60">
              <CardContent className="flex items-center gap-2 p-2">
                <div className={`flex size-9 items-center justify-center rounded-md shrink-0 ${s.cls}`}>
                  <I className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold leading-none">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="all">
            الكل
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{stats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="ready">
            جاهز
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{stats.ready}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            بانتظار
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{stats.pending}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل القائمة</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={reload}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="flex flex-col gap-2 pb-4">
            {filtered.map((it) => {
              const pm = priorityMeta(it.priority);
              return (
                <Card
                  key={it.id}
                  className={`group transition-shadow hover:shadow-md ${it.ready ? "border-emerald-glow/30 bg-emerald-glow/5" : ""}`}
                >
                  <CardContent className="flex items-start gap-2 p-2">
                    {/* priority stars */}
                    <div className="flex flex-col items-center gap-1 pt-0.5 w-14 shrink-0">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`size-3 ${idx < it.priority ? pm.star + " fill-current" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      <Badge variant="outline" className={`h-5 text-[10px] ${pm.cls}`}>
                        {pm.label}
                      </Badge>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold truncate ${it.ready ? "line-through text-muted-foreground" : ""}`}>
                          {it.title}
                        </span>
                        {it.ready ? (
                          <Badge className="h-5 gap-1 text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            <CheckCircle2 className="size-3" />
                            جاهز
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-5 gap-1 text-[10px] text-amber-500 border-amber-500/30">
                            <Hourglass className="size-3" />
                            بانتظار
                          </Badge>
                        )}
                      </div>
                      {it.description ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2" dir="auto">{it.description}</p>
                      ) : null}
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        أُضيف {timeAgo(it.createdAt)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Switch
                        checked={it.ready}
                        disabled={togglingId === it.id}
                        onCheckedChange={(v) => toggleReady(it, v)}
                        aria-label="تمييز كجاهز"
                      />
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(it)} aria-label="تعديل">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setDeleteId(it.id)} aria-label="حذف">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ListChecks className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">قائمة فارغة</p>
            <p className="text-xs text-muted-foreground">أضف أفكاراً أو مهاماً تنتظر التنفيذ</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              عنصر جديد
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل عنصر" : "إضافة عنصر"}</DialogTitle>
            <DialogDescription>سجّل فكرة أو مهمة بانتظار وقت تنفيذها.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="wl-title">العنوان *</Label>
              <Input
                id="wl-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثال: دراسة دورة تسويق"
                dir="auto"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wl-desc">الوصف</Label>
              <Textarea
                id="wl-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="تفاصيل إضافية"
                dir="auto"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>الأولوية</Label>
              <Select value={String(form.priority)} onValueChange={(v) => setForm((f) => ({ ...f, priority: Number(v) }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((p) => {
                    const pm = priorityMeta(p);
                    return (
                      <SelectItem key={p} value={String(p)}>
                        <span className="inline-flex items-center gap-2">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star key={idx} className={`size-3 ${idx < p ? pm.star + " fill-current" : "text-muted-foreground/30"}`} />
                          ))}
                          <span className="mr-1">{pm.label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2.5">
              <div>
                <Label htmlFor="wl-ready" className="text-sm font-medium cursor-pointer">جاهز للتنفيذ</Label>
                <p className="text-[11px] text-muted-foreground">حدّد إذا كان العنصر جاهزاً للعمل عليه</p>
              </div>
              <Switch
                id="wl-ready"
                checked={form.ready}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ready: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العنصر</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف العنصر نهائياً.</AlertDialogDescription>
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
