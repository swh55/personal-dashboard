"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  BookOpen,
  Search,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  Sun,
  Cloudy,
  Sparkles,
} from "lucide-react";
import { useApi, toast, formatDate } from "@/lib/api";
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

interface DiaryEntry {
  id: string;
  title: string | null;
  content: string;
  mood: string;
  weather: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

const MOODS = [
  { value: "happy", label: "سعيد", emoji: "😄", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "excited", label: "متحمس", emoji: "🤩", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { value: "neutral", label: "محايد", emoji: "😐", color: "bg-slate-500/15 text-slate-500 border-slate-500/30" },
  { value: "anxious", label: "قلق", emoji: "😟", color: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  { value: "sad", label: "حزين", emoji: "😢", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "angry", label: "غاضب", emoji: "😠", color: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
];

const WEATHERS = [
  { value: "sunny", label: "مشمس", icon: Sun },
  { value: "partly", label: "غائم جزئياً", icon: CloudSun },
  { value: "cloudy", label: "غائم", icon: Cloudy },
  { value: "rainy", label: "ممطر", icon: CloudRain },
  { value: "snowy", label: "ثلجي", icon: CloudSnow },
  { value: "foggy", label: "ضبابي", icon: Cloud },
];

function moodMeta(m: string) {
  return MOODS.find((x) => x.value === m) || MOODS[2];
}

function weatherMeta(w: string | null) {
  if (!w) return null;
  return WEATHERS.find((x) => x.value === w) || null;
}

const EMPTY_FORM = {
  title: "",
  content: "",
  mood: "neutral",
  weather: "",
  date: new Date().toISOString().slice(0, 10),
};

export function DiarySection() {
  const { data, loading, error, reload } = useApi<DiaryEntry[]>("/api/diary");
  const entries = data || [];

  const [search, setSearch] = React.useState("");
  const [moodFilter, setMoodFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DiaryEntry | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const filtered = React.useMemo(() => {
    let list = entries.slice();
    if (moodFilter !== "all") list = list.filter((e) => e.mood === moodFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.title || "").toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, moodFilter, search]);

  const stats = React.useMemo(() => ({
    total: entries.length,
    byMood: MOODS.map((m) => ({ ...m, count: entries.filter((e) => e.mood === m.value).length })),
  }), [entries]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openView(e: DiaryEntry) {
    setEditing(e);
    setForm({
      title: e.title || "",
      content: e.content,
      mood: e.mood,
      weather: e.weather || "",
      date: new Date(e.date).toISOString().slice(0, 10),
    });
    setViewOpen(true);
  }

  function openEdit(e: DiaryEntry) {
    setEditing(e);
    setForm({
      title: e.title || "",
      content: e.content,
      mood: e.mood,
      weather: e.weather || "",
      date: new Date(e.date).toISOString().slice(0, 10),
    });
    setDialogOpen(true);
    setViewOpen(false);
  }

  async function submit() {
    if (!form.content.trim()) {
      toast.error("المحتوى مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim() || null,
        content: form.content.trim(),
        mood: form.mood,
        weather: form.weather || null,
        date: new Date(form.date).toISOString(),
      };
      const res = await fetch("/api/diary", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث المذكرة" : "تمت إضافة المذكرة");
      setDialogOpen(false);
      setEditing(null);
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
      const res = await fetch(`/api/diary?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف المذكرة");
      setDeleteId(null);
      setViewOpen(false);
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
          <h1 className="text-xl font-bold tracking-tight">المذكرات اليومية</h1>
          <p className="text-sm text-muted-foreground">{stats.total} مذكرة · سجّل أفكارك ومشاعرك</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            مذكرة جديدة
          </Button>
        </div>
      </div>

      {/* mood filter chips */}
      <Card>
        <CardContent className="p-2 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setMoodFilter("all")}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${moodFilter === "all" ? "border-emerald-glow bg-emerald-glow/10 text-emerald-glow" : "border-border hover:bg-muted"}`}
          >
            الكل
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{stats.total}</Badge>
          </button>
          {stats.byMood.map((m) => (
            <button
              key={m.value}
              onClick={() => setMoodFilter(moodFilter === m.value ? "all" : m.value)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${moodFilter === m.value ? m.color + " border" : "border-border hover:bg-muted"}`}
            >
              <span className="ml-0.5">{m.emoji}</span>
              {m.label}
              {m.count > 0 ? <Badge variant="secondary" className="text-[10px] h-4 px-1">{m.count}</Badge> : null}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* search */}
      <Card>
        <CardContent className="p-2">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في العنوان أو المحتوى"
              className="pr-8"
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل المذكرات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => {
              const m = moodMeta(e.mood);
              const w = weatherMeta(e.weather);
              const WIcon = w?.icon || Sparkles;
              return (
                <Card
                  key={e.id}
                  className="group cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => openView(e)}
                >
                  <CardContent className="flex flex-col gap-2 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{m.emoji}</span>
                        <h3 className="text-sm font-semibold truncate flex-1">{e.title || "بدون عنوان"}</h3>
                      </div>
                      {w ? (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          <WIcon className="size-3 ml-1" />
                          {w.label}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
                      {e.content}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatDate(e.date, { day: "numeric", month: "long", year: "numeric" })}</span>
                      <Badge variant="outline" className={`text-[10px] ${m.color} border`}>{m.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <BookOpen className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا مذكرات</p>
            <p className="text-xs text-muted-foreground">
              {search || moodFilter !== "all" ? "لا نتائج مطابقة" : "ابدأ بكتابة أول مذكرة"}
            </p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              مذكرة جديدة
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل المذكرة" : "إضافة مذكرة"}</DialogTitle>
            <DialogDescription>سجّل يومك ومشاعرك.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="d-title">العنوان</Label>
              <Input id="d-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="عنوان مختصر" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-content">المحتوى *</Label>
              <Textarea id="d-content" rows={6} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="اكتب هنا..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>المزاج</Label>
                <Select value={form.mood} onValueChange={(v) => setForm((f) => ({ ...f, mood: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.emoji} {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>الطقس</Label>
                <Select value={form.weather || "none"} onValueChange={(v) => setForm((f) => ({ ...f, weather: v === "none" ? "" : v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— غير محدد —</SelectItem>
                    {WEATHERS.map((w) => (
                      <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-date">التاريخ</Label>
              <Input id="d-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); }}>إلغاء</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* view dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{editing ? moodMeta(editing.mood).emoji : ""}</span>
              {editing?.title || "بدون عنوان"}
            </DialogTitle>
            <DialogDescription>
              {editing ? formatDate(editing.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
              {editing?.weather ? ` · ${weatherMeta(editing.weather)?.label || ""}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto custom-scroll">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{editing?.content}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>إغلاق</Button>
            {editing ? (
              <>
                <Button variant="outline" onClick={() => openEdit(editing)}>
                  <Pencil className="size-4" />
                  تعديل
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteId(editing.id);
                    setViewOpen(false);
                  }}
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>سيتم نقل المذكرة إلى سلة المحذوفات.</AlertDialogDescription>
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
