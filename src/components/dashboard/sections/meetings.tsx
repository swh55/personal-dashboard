"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  CalendarClock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  CalendarDays,
  StickyNote,
} from "lucide-react";
import { useApi, toast, formatDateTime, formatDate, formatTime } from "@/lib/api";
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

interface Meeting {
  id: string;
  title: string;
  agenda: string | null;
  notes: string | null;
  location: string | null;
  participants: string | null;
  startDate: string;
  endDate: string | null;
  status: string; // scheduled, completed, cancelled
  createdAt: string;
}

interface MeetingStats {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
}

const STATUS_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; badge: string }> = {
  scheduled: { label: "مجدول", icon: Clock, badge: "bg-emerald-glow/15 text-emerald-glow" },
  completed: { label: "مكتمل", icon: CheckCircle2, badge: "bg-emerald-glow/15 text-emerald-glow" },
  cancelled: { label: "ملغى", icon: XCircle, badge: "bg-rose-500/15 text-rose-500" },
};

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  title: "",
  agenda: "",
  location: "",
  participants: "",
  startDate: toLocalInput(new Date()),
  endDate: "",
  status: "scheduled",
  notes: "",
};

export function MeetingsSection() {
  const { data, raw, loading, error, reload } = useApi<Meeting[]>("/api/meetings");
  const meetings = data || [];
  const stats: MeetingStats = raw?.stats || { total: 0, upcoming: 0, completed: 0, cancelled: 0 };

  const [filter, setFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Meeting | null>(null);
  const [detail, setDetail] = React.useState<Meeting | null>(null);
  const [detailNotes, setDetailNotes] = React.useState("");
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const filtered = React.useMemo(() => {
    if (filter === "all") return meetings;
    return meetings.filter((m) => m.status === filter);
  }, [meetings, filter]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, startDate: toLocalInput(new Date()) });
    setDialogOpen(true);
  }

  function openEdit(m: Meeting) {
    setEditing(m);
    setForm({
      title: m.title,
      agenda: m.agenda || "",
      location: m.location || "",
      participants: m.participants || "",
      startDate: toLocalInput(new Date(m.startDate)),
      endDate: m.endDate ? toLocalInput(new Date(m.endDate)) : "",
      status: m.status,
      notes: m.notes || "",
    });
    setDetail(null);
    setDialogOpen(true);
  }

  function openDetail(m: Meeting) {
    setDetail(m);
    setDetailNotes(m.notes || "");
  }

  async function submit() {
    if (!form.title.trim() || !form.startDate) {
      toast.error("العنوان والتاريخ مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        agenda: form.agenda.trim() || null,
        location: form.location.trim() || null,
        participants: form.participants.trim() || null,
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      const res = await fetch("/api/meetings", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث الاجتماع" : "تمت إضافة الاجتماع");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(m: Meeting, status: string) {
    try {
      const res = await fetch("/api/meetings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(
        status === "completed" ? "تم وضع علامة مكتمل" : status === "cancelled" ? "تم إلغاء الاجتماع" : "تم التحديث"
      );
      reload();
      if (detail && detail.id === m.id) setDetail({ ...detail, status });
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function saveNotes() {
    if (!detail) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detail.id, notes: detailNotes.trim() || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success("تم حفظ الملاحظات");
      setDetail({ ...detail, notes: detailNotes });
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setSavingNotes(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/meetings?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الاجتماع");
      setDeleteId(null);
      if (detail && detail.id === deleteId) setDetail(null);
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
          <h1 className="text-xl font-bold tracking-tight">الاجتماعات</h1>
          <p className="text-sm text-muted-foreground">{stats.total} اجتماع · {stats.upcoming} قادم</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            اجتماع جديد
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard icon={CalendarDays} label="الإجمالي" value={stats.total} accent="emerald" />
        <StatCard icon={Clock} label="قادم" value={stats.upcoming} accent="amber" />
        <StatCard icon={CheckCircle2} label="مكتمل" value={stats.completed} accent="emerald" />
        <StatCard icon={XCircle} label="ملغى" value={stats.cancelled} accent="rose" />
      </div>

      {/* filter */}
      <Card>
        <CardContent className="flex items-center gap-2 p-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="scheduled">مجدول</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغى</SelectItem>
            </SelectContent>
          </Select>
          <div className="mr-auto text-xs text-muted-foreground">{filtered.length} اجتماع</div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل الاجتماعات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 pb-4">
            {filtered.map((m) => {
              const meta = STATUS_META[m.status] || STATUS_META.scheduled;
              const isUpcoming = m.status === "scheduled" && new Date(m.startDate) > new Date();
              return (
                <Card
                  key={m.id}
                  className="group cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => openDetail(m)}
                >
                  <CardContent className="flex flex-col gap-2 p-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{m.title}</div>
                        {m.agenda ? (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.agenda}</div>
                        ) : null}
                      </div>
                      <Badge className={`text-[10px] gap-1 ${meta.badge}`} variant="secondary">
                        <meta.icon className="size-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarClock className={`size-3 ${isUpcoming ? "text-emerald-glow" : ""}`} />
                        {formatDate(m.startDate, { day: "numeric", month: "short" })} · {formatTime(m.startDate)}
                      </span>
                      {m.location ? (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="size-3" />
                          <span className="truncate">{m.location}</span>
                        </span>
                      ) : null}
                    </div>
                    {m.participants ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        <span className="truncate">{m.participants}</span>
                      </div>
                    ) : null}
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 mt-1">
                      {m.status === "scheduled" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-emerald-glow"
                            onClick={(e) => { e.stopPropagation(); setStatus(m, "completed"); }}
                          >
                            <CheckCircle2 className="size-3" />
                            إتمام
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-rose-500"
                            onClick={(e) => { e.stopPropagation(); setStatus(m, "cancelled"); }}
                          >
                            <XCircle className="size-3" />
                            إلغاء
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(m.id); }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <CalendarClock className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا اجتماعات</p>
            <p className="text-xs text-muted-foreground">ابدأ بجدولة اجتماع جديد</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              إضافة اجتماع
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.title}
                  <Badge className={`text-[10px] gap-1 ${STATUS_META[detail.status]?.badge}`} variant="secondary">
                    {STATUS_META[detail.status]?.label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{formatDateTime(detail.startDate)}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                {detail.agenda ? (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">جدول الأعمال</div>
                    <div className="rounded-lg bg-muted/40 p-2 text-sm whitespace-pre-wrap">{detail.agenda}</div>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">الوقت</div>
                    <div>{formatTime(detail.startDate)}{detail.endDate ? ` - ${formatTime(detail.endDate)}` : ""}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">الموقع</div>
                    <div>{detail.location || "—"}</div>
                  </div>
                </div>
                {detail.participants ? (
                  <div>
                    <div className="text-xs text-muted-foreground">المشاركون</div>
                    <div className="text-sm">{detail.participants}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <StickyNote className="size-3" />
                    الملاحظات
                  </div>
                  <Textarea
                    rows={3}
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    placeholder="أضف ملاحظات الاجتماع..."
                  />
                  <div className="flex justify-end mt-1">
                    <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                      {savingNotes ? "جارٍ الحفظ..." : "حفظ الملاحظات"}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                {detail.status === "scheduled" ? (
                  <>
                    <Button variant="outline" className="text-emerald-glow" onClick={() => setStatus(detail, "completed")}>
                      <CheckCircle2 className="size-4" />
                      إتمام
                    </Button>
                    <Button variant="outline" className="text-rose-500" onClick={() => setStatus(detail, "cancelled")}>
                      <XCircle className="size-4" />
                      إلغاء
                    </Button>
                  </>
                ) : null}
                <Button variant="outline" onClick={() => openEdit(detail)}>
                  <Pencil className="size-4" />
                  تعديل
                </Button>
                <Button variant="destructive" onClick={() => setDeleteId(detail.id)}>
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الاجتماع" : "إضافة اجتماع"}</DialogTitle>
            <DialogDescription>أدخل تفاصيل الاجتماع.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="m-title">العنوان *</Label>
              <Input
                id="m-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-agenda">جدول الأعمال</Label>
              <Textarea
                id="m-agenda"
                rows={2}
                value={form.agenda}
                onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-loc">الموقع</Label>
                <Input
                  id="m-loc"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="مثال: المكتب"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">مجدول</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                    <SelectItem value="cancelled">ملغى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-parts">المشاركون</Label>
              <Input
                id="m-parts"
                value={form.participants}
                onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))}
                placeholder="مثال: أحمد، سامي، خالد"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-start">البداية *</Label>
                <Input
                  id="m-start"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-end">النهاية</Label>
                <Input
                  id="m-end"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            {editing ? (
              <div className="grid gap-1.5">
                <Label htmlFor="m-notes">ملاحظات</Label>
                <Textarea
                  id="m-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            ) : null}
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
            <AlertDialogDescription>سيتم نقل الاجتماع إلى سلة المحذوفات.</AlertDialogDescription>
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

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
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
      <CardContent className="flex items-center gap-2.5 p-2">
        <div className={`flex size-9 items-center justify-center rounded-md shrink-0 ${accentClass}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-base font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
