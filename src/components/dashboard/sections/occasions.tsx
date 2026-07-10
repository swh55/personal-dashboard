"use client";

import * as React from "react";
import {
  Gift,
  Cake,
  Heart,
  PartyPopper,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  CalendarDays,
  Clock,
  CircleAlert,
  X,
} from "lucide-react";
import { useApi, toast, formatDate, daysUntil } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Occasion {
  id: string;
  title: string;
  date: string;
  type: string;
  recurring: boolean;
  note: string | null;
}

const OCCASION_TYPES = [
  { value: "birthday", label: "عيد ميلاد", emoji: "🎂", icon: Cake, color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { value: "anniversary", label: "ذكرى سنوية", emoji: "💕", icon: Heart, color: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  { value: "holiday", label: "عطلة", emoji: "🎉", icon: PartyPopper, color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "other", label: "أخرى", emoji: "✨", icon: Sparkles, color: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
];

function typeMeta(t: string) {
  return OCCASION_TYPES.find((x) => x.value === t) || OCCASION_TYPES[3];
}

function nextOccurrence(o: Occasion): { date: Date; diffDays: number; isToday: boolean; isFuture: boolean } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(o.date);
  d.setHours(0, 0, 0, 0);
  if (o.recurring) {
    const tryDate = new Date(now.getFullYear(), d.getMonth(), d.getDate());
    if (tryDate.getTime() < now.getTime()) {
      tryDate.setFullYear(now.getFullYear() + 1);
    }
    const diff = Math.ceil((tryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { date: tryDate, diffDays: diff, isToday: diff === 0, isFuture: diff > 0 };
  }
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { date: d, diffDays: diff, isToday: diff === 0, isFuture: diff > 0 };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("ar-SY", { month: "long", year: "numeric" });
}

const EMPTY_FORM = {
  title: "",
  date: new Date().toISOString().slice(0, 10),
  type: "birthday",
  recurring: true,
  note: "",
};

export function OccasionsSection() {
  const { data: occasions, loading, error, reload } = useApi<Occasion[]>("/api/occasions");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Occasion | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const safeOccasions = React.useMemo(() => {
    return Array.isArray(occasions) ? occasions : [];
  }, [occasions]);

  const sorted = React.useMemo(() => {
    return safeOccasions
      .slice()
      .map((o) => ({ o, next: nextOccurrence(o) }))
      .sort((a, b) => a.next.date.getTime() - b.next.date.getTime());
  }, [safeOccasions]);

  const nextOne = sorted.length > 0 ? sorted[0] : null;

  const grouped = React.useMemo(() => {
    const map = new Map<string, { label: string; items: typeof sorted }>();
    for (const item of sorted) {
      const k = monthKey(item.next.date);
      if (!map.has(k)) map.set(k, { label: monthLabel(item.next.date), items: [] });
      map.get(k)!.items.push(item);
    }
    return Array.from(map.entries());
  }, [sorted]);

  const stats = React.useMemo(() => ({
    total: safeOccasions.length,
    upcoming: sorted.filter((s) => s.next.isFuture).length,
    today: sorted.filter((s) => s.next.isToday).length,
  }), [sorted, safeOccasions]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(o: Occasion) {
    setEditing(o);
    setForm({
      title: o.title,
      date: new Date(o.date).toISOString().slice(0, 10),
      type: o.type,
      recurring: o.recurring,
      note: o.note || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.date) {
      toast.error("العنوان والتاريخ مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        date: new Date(form.date).toISOString(),
        type: form.type,
        recurring: form.recurring,
        note: form.note || null,
      };
      const url = "/api/occasions";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...body } : body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث المناسبة" : "تمت إضافة المناسبة");
      setDialogOpen(false);
      reload();
    } catch (err: any) {
      toast.error(err.message || "فشل الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/occasions?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف المناسبة");
      setDeleteId(null);
      reload();
    } catch (err: any) {
      toast.error(err.message || "فشل الحذف");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">المناسبات</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} مناسبة · {stats.upcoming} قادمة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            مناسبة جديدة
          </Button>
        </div>
      </div>

      {/* next occasion hero */}
      {nextOne ? (
        <Card className="overflow-hidden border-none">
          <CardContent className="p-0">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-l from-emerald-glow/15 via-transparent to-amber-glow/15 pointer-events-none" />
              <div className="relative flex items-center gap-4 p-5">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-glow to-amber-glow text-background text-2xl shrink-0">
                  {typeMeta(nextOne.o.type).emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">المناسبة القادمة</div>
                  <div className="text-lg font-bold truncate">{nextOne.o.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="size-3" />
                      {formatDate(nextOne.next.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    {nextOne.next.isToday ? (
                      <Badge className="bg-emerald-glow text-background">اليوم!</Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-glow border-emerald-glow/30">
                        <Clock className="size-3 ml-1" />
                        بعد {nextOne.next.diffDays} يوم
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل البيانات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-emerald-glow">{stats.total}</div><div className="text-xs text-muted-foreground">الإجمالي</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-amber-glow">{stats.upcoming}</div><div className="text-xs text-muted-foreground">قادمة</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-rose-500">{stats.today}</div><div className="text-xs text-muted-foreground">اليوم</div></CardContent></Card>
      </div>

      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-4 pb-4">
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : sorted.length > 0 ? (
            <div className="flex flex-col gap-4">
              {grouped.map(([key, group]) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
                    <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {group.items.map(({ o, next }) => {
                      const tm = typeMeta(o.type);
                      const Icon = tm.icon;
                      return (
                        <Card key={o.id} className="group relative overflow-hidden">
                          <CardContent className="flex items-center gap-3 p-3">
                            <div className={`flex size-10 items-center justify-center rounded-xl border ${tm.color}`}>
                              <Icon className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{o.title}</span>
                                {o.recurring ? <Badge variant="outline" className="text-[10px] shrink-0">سنوي</Badge> : null}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                <CalendarDays className="size-3" />
                                {formatDate(next.date, { day: "numeric", month: "long" })}
                                {next.isToday ? <span className="text-emerald-glow font-medium">اليوم!</span> : next.diffDays > 0 ? <span>بعد {next.diffDays} يوم</span> : <span className="text-muted-foreground">مرت</span>}
                              </div>
                              {o.note ? <div className="mt-0.5 text-xs text-muted-foreground truncate">{o.note}</div> : null}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(o)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => setDeleteId(o.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <Gift className="size-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">لا مناسبات</p>
                  <p className="text-xs text-muted-foreground">أضف عيد ميلاد أو ذكرى لتذكيرك بها</p>
                </div>
                <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
                  <Plus className="size-4" />
                  مناسبة جديدة
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل مناسبة" : "مناسبة جديدة"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: عيد ميلاد سوسو" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">التاريخ</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OCCASION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="recurring">متكرر سنوياً</Label>
              <Switch id="recurring" checked={form.recurring} onCheckedChange={(v) => setForm({ ...form, recurring: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">ملاحظة</Label>
              <Textarea id="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ملاحظة اختيارية" rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                <X className="size-4" />
                إلغاء
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "جاري الحفظ..." : editing ? "حفظ التغييرات" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذه المناسبة؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
