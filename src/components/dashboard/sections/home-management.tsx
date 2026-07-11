"use client";

import * as React from "react";
import {
  Plus,
  Minus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Package,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  ListChecks,
  ShoppingCart,
  ArrowLeft,
  Home,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import { useFloatingPanelStore } from "@/store/use-floating-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Star } from "lucide-react";
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

interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  lowStock: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface WaitingItem {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  ready: boolean;
}

interface HomeStats {
  totalItems: number;
  lowStockCount: number;
  waitingReady: number;
  waitingPending: number;
  byCategory: Record<string, number>;
}

interface HomeResponse {
  pantry: PantryItem[];
  waitingList: WaitingItem[];
  lowStock: PantryItem[];
  stats: HomeStats;
}

const UNITS = [
  { value: "piece", label: "قطعة" },
  { value: "kg", label: "كغ" },
  { value: "g", label: "غرام" },
  { value: "l", label: "ليتر" },
  { value: "ml", label: "مل" },
  { value: "pack", label: "علبة" },
] as const;

const CATEGORIES = [
  { value: "grains", label: "حبوب", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { value: "dairy", label: "ألبان", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "meat", label: "لحوم", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  { value: "vegetables", label: "خضار", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "fruits", label: "فواكه", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "beverages", label: "مشروبات", cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  { value: "cleaning", label: "تنظيف", cls: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30" },
  { value: "other", label: "أخرى", cls: "bg-slate-500/15 text-slate-500 border-slate-500/30" },
] as const;

function unitLabel(u: string) {
  return UNITS.find((x) => x.value === u)?.label || u;
}

function categoryMeta(c: string) {
  return CATEGORIES.find((x) => x.value === c) || CATEGORIES[CATEGORIES.length - 1];
}

function priorityStars(p: number, cls = "text-amber-500") {
  return Array.from({ length: 5 }).map((_, idx) => (
    <Star key={idx} className={`size-3 ${idx < p ? cls + " fill-current" : "text-muted-foreground/30"}`} />
  ));
}

const EMPTY_FORM = {
  name: "",
  quantity: "1",
  unit: "piece",
  lowStock: "1",
  category: "other",
};

export function HomeManagementSection() {
  const setPanel = useFloatingPanelStore((s) => s.setPanel);
  const { data: home, loading, error, reload } = useApi<HomeResponse>("/api/home");

  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [lowOnly, setLowOnly] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PantryItem | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const pantry = home?.pantry || [];
  const waitingList = home?.waitingList || [];
  const stats = home?.stats;

  const filteredPantry = React.useMemo(() => {
    return pantry.filter((it) => {
      if (categoryFilter !== "all" && it.category !== categoryFilter) return false;
      if (lowOnly && it.quantity > it.lowStock) return false;
      return true;
    });
  }, [pantry, categoryFilter, lowOnly]);

  const statsView = React.useMemo(() => ({
    totalItems: stats?.totalItems ?? pantry.length,
    lowStockCount: stats?.lowStockCount ?? pantry.filter((p) => p.quantity <= p.lowStock).length,
    waitingReady: stats?.waitingReady ?? waitingList.filter((w) => w.ready).length,
    waitingPending: stats?.waitingPending ?? waitingList.filter((w) => !w.ready).length,
  }), [stats, pantry, waitingList]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(it: PantryItem) {
    setEditing(it);
    setForm({
      name: it.name,
      quantity: String(it.quantity),
      unit: it.unit,
      lowStock: String(it.lowStock),
      category: it.category,
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    const quantity = Number(form.quantity);
    const lowStock = Number(form.lowStock);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error("أدخل كمية صحيحة");
      return;
    }
    if (!Number.isFinite(lowStock) || lowStock < 0) {
      toast.error("أدخل حدّاً صحيحاً للمخزون المنخفض");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        quantity,
        unit: form.unit,
        lowStock,
        category: form.category,
      };
      const res = await fetch("/api/pantry", {
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
      const res = await fetch(`/api/pantry?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف العنصر");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function adjustQuantity(it: PantryItem, delta: number) {
    const next = Math.max(0, it.quantity + delta);
    if (next === it.quantity) return;
    setBusyId(it.id);
    try {
      const res = await fetch("/api/pantry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id, quantity: next }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setBusyId(null);
    }
  }

  const statCards = [
    { label: "إجمالي العناصر", value: statsView.totalItems, icon: Package, cls: "bg-emerald-glow/15 text-emerald-glow" },
    { label: "مخزون منخفض", value: statsView.lowStockCount, icon: AlertTriangle, cls: "bg-rose-500/15 text-rose-500" },
    { label: "جاهزة", value: statsView.waitingReady, icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-500" },
    { label: "بانتظار", value: statsView.waitingPending, icon: Hourglass, cls: "bg-amber-500/15 text-amber-500" },
  ];

  const topWaiting = React.useMemo(() => waitingList.slice(0, 3), [waitingList]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">إدارة المنزل</h2>
          <p className="text-sm text-muted-foreground">
            مخزون المطبخ وقائمة الانتظار — كل ما يخص البيت في مكان واحد
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statCards.map((s) => {
          const I = s.icon;
          return (
            <Card key={s.label} className="border-border/60">
              <CardContent className="flex items-center gap-3 p-3">
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

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل البيانات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={reload}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        {loading ? (
          <div className="flex flex-col gap-4 pb-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">

            {/* Pantry section */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="size-4 text-emerald-glow" />
                  <h3 className="text-sm font-semibold">مخزون المطبخ</h3>
                  <Badge variant="secondary" className="text-[10px]">{pantry.length}</Badge>
                </div>
              </div>

              {/* filter card */}
              <Card className="border-border/60 mb-2">
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="size-3.5" />
                    تصفية:
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الفئات</SelectItem>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Separator orientation="vertical" className="h-5" />
                  <div className="flex items-center gap-2">
                    <Switch checked={lowOnly} onCheckedChange={setLowOnly} aria-label="المخزون المنخفض فقط" />
                    <Label className="text-xs cursor-pointer" onClick={() => setLowOnly((v) => !v)}>
                      المخزون المنخفض فقط
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {filteredPantry.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredPantry.map((it) => {
                    const cat = categoryMeta(it.category);
                    const isLow = it.quantity <= it.lowStock;
                    return (
                      <Card
                        key={it.id}
                        className={`group transition-shadow hover:shadow-md ${isLow ? "border-rose-500/40 bg-rose-500/5" : ""}`}
                      >
                        <CardContent className="flex flex-col gap-2 p-3">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold truncate" dir="auto">{it.name}</span>
                                {isLow ? (
                                  <Badge variant="outline" className="h-5 gap-1 text-[10px] text-rose-500 border-rose-500/30 bg-rose-500/10">
                                    <AlertTriangle className="size-3" />
                                    منخفض
                                  </Badge>
                                ) : null}
                              </div>
                              <Badge variant="outline" className={`mt-1 h-5 text-[10px] ${cat.cls}`}>
                                {cat.label}
                              </Badge>
                            </div>
                            <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="size-6" onClick={() => openEdit(it)} aria-label="تعديل">
                                <Pencil className="size-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-6 text-destructive" onClick={() => setDeleteId(it.id)} aria-label="حذف">
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-7"
                                disabled={busyId === it.id || it.quantity === 0}
                                onClick={() => adjustQuantity(it, -1)}
                                aria-label="إنقاص"
                              >
                                <Minus className="size-3" />
                              </Button>
                              <div className="min-w-[60px] text-center">
                                <div className="text-lg font-bold leading-none" dir="ltr">{it.quantity}</div>
                                <div className="text-[10px] text-muted-foreground">{unitLabel(it.unit)}</div>
                              </div>
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-7"
                                disabled={busyId === it.id}
                                onClick={() => adjustQuantity(it, 1)}
                                aria-label="زيادة"
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>
                            <div className="text-[10px] text-muted-foreground text-left">
                              <div>الحد: <span dir="ltr">{it.lowStock}</span></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center rounded-xl border border-dashed">
                  <Package className="size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">لا عناصر {lowOnly ? "منخفضة" : "في المخزون"}</p>
                  <p className="text-xs text-muted-foreground">
                    {lowOnly ? "لا يوجد مخزون منخفض حالياً" : "أضف عناصر مخزونك لتتبعها"}
                  </p>
                  <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
                    <Plus className="size-4" />
                    عنصر جديد
                  </Button>
                </div>
              )}
            </div>

            {/* Waiting list preview */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <ListChecks className="size-4 text-emerald-glow" />
                  <h3 className="text-sm font-semibold">قائمة الانتظار</h3>
                  <Badge variant="secondary" className="text-[10px]">{waitingList.length}</Badge>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPanel("waitinglist")}>
                  عرض الكل
                  <ArrowLeft className="size-3.5" />
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  {topWaiting.length > 0 ? (
                    <div className="flex flex-col divide-y divide-border">
                      {topWaiting.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => setPanel("waitinglist")}
                          className="flex items-center gap-3 p-3 text-right hover:bg-muted/50 transition"
                        >
                          <div className="flex items-center gap-0.5 shrink-0">
                            {priorityStars(w.priority, w.priority >= 4 ? "text-rose-500" : "text-amber-500")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-medium truncate ${w.ready ? "line-through text-muted-foreground" : ""}`} dir="auto">
                              {w.title}
                            </div>
                            {w.description ? (
                              <p className="text-[11px] text-muted-foreground truncate" dir="auto">{w.description}</p>
                            ) : null}
                          </div>
                          {w.ready ? (
                            <Badge className="h-5 gap-1 text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shrink-0">
                              <CheckCircle2 className="size-3" />
                              جاهز
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-5 gap-1 text-[10px] text-amber-500 border-amber-500/30 shrink-0">
                              <Hourglass className="size-3" />
                              بانتظار
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <ListChecks className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">قائمة الانتظار فارغة</p>
                      <Button size="sm" variant="outline" className="mt-1" onClick={() => setPanel("waitinglist")}>
                        <ArrowLeft className="size-4" />
                        فتح قائمة الانتظار
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل عنصر المخزون" : "إضافة عنصر للمخزون"}</DialogTitle>
            <DialogDescription>سجّل اسم العنصر والكمية والفئة وحدّ المخزون المنخفض.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="hm-name">الاسم *</Label>
              <Input
                id="hm-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثال: أرز بسمتي"
                dir="auto"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="hm-qty">الكمية</Label>
                <Input
                  id="hm-qty"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>الوحدة</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="hm-low">حدّ المخزون المنخفض</Label>
                <Input
                  id="hm-low"
                  type="number"
                  min={0}
                  value={form.lowStock}
                  onChange={(e) => setForm((f) => ({ ...f, lowStock: e.target.value }))}
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <AlertDialogTitle>حذف عنصر المخزون</AlertDialogTitle>
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
