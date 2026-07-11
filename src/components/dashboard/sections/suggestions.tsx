"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  CircleAlert,
  Lightbulb,
  Check,
  X,
  Inbox,
  Tag,
  Clock,
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

interface Suggestion {
  id: string;
  title: string;
  content: string;
  category: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: "work", label: "عمل" },
  { value: "personal", label: "شخصي" },
  { value: "family", label: "عائلي" },
  { value: "health", label: "صحة" },
  { value: "finance", label: "مالية" },
  { value: "general", label: "عام" },
];

const STATUS_META: Record<
  Suggestion["status"],
  { label: string; cls: string }
> = {
  pending: {
    label: "قيد الانتظار",
    cls: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
  accepted: {
    label: "مقبول",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  rejected: {
    label: "مرفوض",
    cls: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  },
};

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "general",
};

export function SuggestionsSection() {
  const { data, loading, error, reload } = useApi<Suggestion[]>(
    "/api/suggestions"
  );
  const suggestions = data || [];

  const [tab, setTab] = React.useState<"all" | Suggestion["status"]>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const stats = React.useMemo(
    () => ({
      total: suggestions.length,
      pending: suggestions.filter((s) => s.status === "pending").length,
      accepted: suggestions.filter((s) => s.status === "accepted").length,
      rejected: suggestions.filter((s) => s.status === "rejected").length,
    }),
    [suggestions]
  );

  const filtered = React.useMemo(() => {
    if (tab === "all") return suggestions;
    return suggestions.filter((s) => s.status === tab);
  }, [suggestions, tab]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الإضافة");
      toast.success("تمت إضافة الاقتراح");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الإضافة");
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: Suggestion["status"]) {
    setBusyId(id);
    try {
      const res = await fetch("/api/suggestions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(
        status === "accepted" ? "تم قبول الاقتراح" : "تم رفض الاقتراح"
      );
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل التحديث");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/suggestions?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الاقتراح");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الحذف");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">الاقتراحات</h2>
          <p className="text-sm text-muted-foreground">
            أفكار وملاحظات لتحسين عملك اليومي
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>اقتراح جديد</span>
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="الإجمالي"
          value={stats.total}
          icon={<Lightbulb className="size-4" />}
          cls="text-emerald-glow bg-emerald-glow/10"
        />
        <StatCard
          label="قيد الانتظار"
          value={stats.pending}
          icon={<Clock className="size-4" />}
          cls="text-amber-glow bg-amber-glow/10"
        />
        <StatCard
          label="مقبولة"
          value={stats.accepted}
          icon={<Check className="size-4" />}
          cls="text-emerald-glow bg-emerald-glow/10"
        />
        <StatCard
          label="مرفوضة"
          value={stats.rejected}
          icon={<X className="size-4" />}
          cls="text-rose-500 bg-rose-500/10"
        />
      </div>

      {/* Filter Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="w-full"
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">الكل ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">قيد الانتظار ({stats.pending})</TabsTrigger>
          <TabsTrigger value="accepted">مقبولة ({stats.accepted})</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة ({stats.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Body */}
      <ScrollArea className="flex-1 custom-scroll -mx-1 px-1">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertTitle>تعذّر تحميل الاقتراحات</AlertTitle>
            <AlertDescription className="flex items-center gap-2">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : filtered.length === 0 ? (
          <EmptyState onAdd={openAdd} hasAny={suggestions.length > 0} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((s) => {
              const st = STATUS_META[s.status];
              const isBusy = busyId === s.id;
              return (
                <Card
                  key={s.id}
                  className="group relative overflow-hidden border-border/60 transition-colors hover:border-emerald-glow/40"
                >
                  <span
                    className={
                      "absolute inset-y-0 right-0 w-1 " +
                      (s.status === "accepted"
                        ? "bg-emerald-glow"
                        : s.status === "rejected"
                        ? "bg-rose-500"
                        : "bg-amber-glow")
                    }
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-muted/60"
                        >
                          <Tag className="size-3" />
                          {categoryLabel(s.category)}
                        </Badge>
                        <Badge variant="outline" className={st.cls}>
                          {st.label}
                        </Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-rose-500 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => setDeleteId(s.id)}
                        aria-label="حذف"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <h3 className="mt-2 font-semibold leading-snug">
                      {s.title}
                    </h3>
                    {s.content && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                        {s.content}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(s.createdAt)}
                      </span>
                      {s.status === "pending" ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-emerald-glow/40 text-emerald-glow hover:bg-emerald-glow/10"
                            disabled={isBusy}
                            onClick={() => setStatus(s.id, "accepted")}
                          >
                            <Check className="size-3.5" />
                            قبول
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
                            disabled={isBusy}
                            onClick={() => setStatus(s.id, "rejected")}
                          >
                            <X className="size-3.5" />
                            رفض
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1"
                          disabled={isBusy}
                          onClick={() => setStatus(s.id, "pending")}
                        >
                          <RefreshCw className="size-3.5" />
                          إعادة للانتظار
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>اقتراح جديد</DialogTitle>
            <DialogDescription>
              أضف فكرة أو ملاحظة لمراجعتها لاحقاً
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="title">العنوان *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="مثال: تنظيم جدول المراجعات الأسبوعية"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">الفئة</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="اختر فئة" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">المحتوى</Label>
              <Textarea
                id="content"
                rows={4}
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                placeholder="اشرح الاقتراح بالتفصيل..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "حفظ الاقتراح"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الاقتراح؟</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف الاقتراح نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-500 hover:bg-rose-600"
            >
              حذف
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
  icon,
  cls,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  cls: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 items-center justify-center rounded-lg ${cls}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  onAdd,
  hasAny,
}: {
  onAdd: () => void;
  hasAny: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
          <Inbox className="size-7" />
        </div>
        <div>
          <p className="font-medium">
            {hasAny ? "لا توجد اقتراحات في هذه الفئة" : "لا توجد اقتراحات بعد"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            ابدأ بتسجيل أفكارك وملاحظاتك لمراجعتها لاحقاً
          </p>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="size-4" />
          إضافة اقتراح
        </Button>
      </CardContent>
    </Card>
  );
}
