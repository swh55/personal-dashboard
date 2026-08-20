"use client";

import * as React from "react";
import {
  Plus,
  Pin,
  PinOff,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  StickyNote,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTE_COLORS = [
  { value: "default", label: "افتراضي", bg: "bg-card", border: "border-border" },
  { value: "yellow", label: "أصفر", bg: "bg-amber-100 dark:bg-amber-500/15", border: "border-amber-300 dark:border-amber-500/30" },
  { value: "green", label: "أخضر", bg: "bg-emerald-100 dark:bg-emerald-500/15", border: "border-emerald-300 dark:border-emerald-500/30" },
  { value: "blue", label: "أزرق", bg: "bg-sky-100 dark:bg-sky-500/15", border: "border-sky-300 dark:border-sky-500/30" },
  { value: "red", label: "أحمر", bg: "bg-rose-100 dark:bg-rose-500/15", border: "border-rose-300 dark:border-rose-500/30" },
  { value: "purple", label: "بنفسجي", bg: "bg-violet-100 dark:bg-violet-500/15", border: "border-violet-300 dark:border-violet-500/30" },
];

function colorClasses(color: string): { bg: string; border: string } {
  const c = NOTE_COLORS.find((x) => x.value === color) || NOTE_COLORS[0];
  return { bg: c.bg, border: c.border };
}

const EMPTY_FORM = { title: "", content: "", color: "default", pinned: false };

export function NotesSection() {
  const { data, loading, error, reload } = useApi<Note[]>("/api/notes");
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Note | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const sorted = React.useMemo(() => {
    const list = (data || []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [data, search]);

  const stats = React.useMemo(() => ({
    total: (data || []).length,
    pinned: (data || []).filter((n) => n.pinned).length,
  }), [data]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(n: Note) {
    setEditing(n);
    setForm({ title: n.title, content: n.content, color: n.color, pinned: n.pinned });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("العنوان والمحتوى مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        color: form.color,
        pinned: form.pinned,
      };
      const res = await fetch("/api/notes", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث الملاحظة" : "تمت إضافة الملاحظة");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePin(n: Note) {
    try {
      const res = await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id, pinned: !n.pinned }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(n.pinned ? "تم إلغاء التثبيت" : "تم التثبيت");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/notes?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الملاحظة");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  return (
    <div className="flex h-full flex-col gap-1">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight">الملاحظات</h1>
          <p className="text-sm text-muted-foreground">{stats.total} ملاحظة · {stats.pinned} مثبتة</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            ملاحظة جديدة
          </Button>
        </div>
      </div>

      {/* search */}
      <Card>
        <CardContent className="p-1">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في العنوان أو المحتوى" className="pe-8" />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل الملاحظات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* masonry-style grid using CSS columns */}
      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : sorted.length > 0 ? (
          <div className="columns-1 gap-1 sm:columns-2 lg:columns-3 xl:columns-4 pb-4 [column-fill:_balance]">
            {sorted.map((n) => {
              const c = colorClasses(n.color);
              return (
                <div
                  key={n.id}
                  className={`group mb-3 break-inside-avoid rounded-xl border p-2 shadow-sm transition-shadow hover:shadow-md ${c.bg} ${c.border}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-sm font-semibold leading-snug flex-1">{n.title}</h3>
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => togglePin(n)} aria-label={n.pinned ? "إلغاء التثبيت" : "تثبيت"}>
                        {n.pinned ? <PinOff className="size-3.5 text-amber-glow" /> : <Pin className="size-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(n)} aria-label="تعديل">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setDeleteId(n.id)} aria-label="حذف">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {n.pinned ? (
                    <div className="mb-1 flex items-center gap-1">
                      <Pin className="size-3 fill-amber-glow text-amber-glow" />
                      <span className="text-[10px] text-amber-glow font-medium">مثبتة</span>
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{n.content}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{timeAgo(n.updatedAt)}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{n.color === "default" ? "افتراضي" : NOTE_COLORS.find((x) => x.value === n.color)?.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <StickyNote className="size-6 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا ملاحظات</p>
            <p className="text-xs text-muted-foreground">ابدأ بكتابة أول ملاحظة</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              ملاحظة جديدة
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل ملاحظة" : "إضافة ملاحظة"}</DialogTitle>
            <DialogDescription>اكتب أفكارك وملاحظاتك بسرعة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="n-title">العنوان *</Label>
              <Input id="n-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="عنوان قصير" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="n-content">المحتوى *</Label>
              <Textarea id="n-content" rows={5} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="اكتب هنا..." />
            </div>
            <div className="grid gap-1.5">
              <Label>اللون</Label>
              <div className="flex flex-wrap gap-1.5">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.label}
                    onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                    className={`size-6 rounded-full border-2 ${c.bg} ${c.border} transition ${form.color === c.value ? "ring-2 ring-ring ring-offset-1" : ""}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <input
                id="n-pinned"
                type="checkbox"
                className="size-4 rounded border-input"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
              />
              <Label htmlFor="n-pinned" className="text-sm font-normal cursor-pointer">تثبيت في الأعلى</Label>
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
            <AlertDialogDescription>سيتم نقل الملاحظة إلى سلة المحذوفات.</AlertDialogDescription>
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
