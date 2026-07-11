"use client";

import * as React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ar } from "date-fns/locale";
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  MapPin,
  Clock,
  Pencil,
  Trash2,
  CircleAlert,
  RefreshCw,
  CircleDot,
} from "lucide-react";
import { useApi, toast, formatTime } from "@/lib/api";
import { EVENT_COLORS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  type: string;
  color: string;
  location: string | null;
}

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const EVENT_TYPES = [
  { value: "personal", label: "شخصي" },
  { value: "work", label: "عمل" },
  { value: "family", label: "عائلي" },
  { value: "health", label: "صحة" },
  { value: "other", label: "أخرى" },
];

function colorClass(color: string): string {
  const map: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    slate: "bg-slate-500",
  };
  return map[color] || "bg-primary";
}

function typeLabel(type: string): string {
  return EVENT_TYPES.find((t) => t.value === type)?.label || type;
}

function toLocalInputValue(d: Date): string {
  // YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarSection() {
  // Initialize cursor/selectedDay as null and set them on mount to avoid
  // SSR hydration mismatch when the server timezone differs from the client's.
  const [cursor, setCursor] = React.useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const t = new Date();
    setCursor(startOfMonth(t));
    setSelectedDay(t);
  }, []);

  const today = React.useMemo(() => new Date(), []);

  // fetch events for visible month range (with prev/next week padding)
  // Guard for null cursor (before mount) — use today as fallback so the URL is stable.
  const cursorDate = cursor || today;
  const monthStart = startOfWeek(startOfMonth(cursorDate), { weekStartsOn: 6 });
  const monthEnd = endOfWeek(endOfMonth(cursorDate), { weekStartsOn: 6 });
  const from = monthStart.toISOString();
  const to = monthEnd.toISOString();
  const { data, loading, error, reload } = useApi<EventItem[] | null>(
    cursor ? `/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : null
  );

  // dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EventItem | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const days = React.useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of data || []) {
      const key = format(new Date(e.startDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [data]);

  const selectedDayEvents = React.useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return (eventsByDay.get(key) || []).slice().sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [selectedDay, eventsByDay]);

  const upcoming = React.useMemo(() => {
    const now = Date.now();
    return (data || [])
      .filter((e) => new Date(e.startDate).getTime() >= now)
      .slice()
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 8);
  }, [data]);

  function openAdd(prefillDay?: Date) {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      startDate: toLocalInputValue(prefillDay ? new Date(prefillDay.setHours(10, 0, 0, 0)) : new Date()),
      endDate: "",
      allDay: false,
      type: "personal",
      color: "emerald",
      location: "",
    });
    setDialogOpen(true);
  }

  function openEdit(ev: EventItem) {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description || "",
      startDate: toLocalInputValue(new Date(ev.startDate)),
      endDate: ev.endDate ? toLocalInputValue(new Date(ev.endDate)) : "",
      allDay: ev.allDay,
      type: ev.type,
      color: ev.color,
      location: ev.location || "",
    });
    setDialogOpen(true);
  }

  const [form, setForm] = React.useState({
    title: "",
    description: "",
    startDate: toLocalInputValue(new Date()),
    endDate: "",
    allDay: false,
    type: "personal",
    color: "emerald",
    location: "",
  });

  async function submit() {
    if (!form.title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        allDay: form.allDay,
        type: form.type,
        color: form.color,
        location: form.location.trim() || undefined,
      };
      const res = await fetch(editing ? `/api/events` : `/api/events`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث الحدث" : "تمت إضافة الحدث");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/events?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الحدث");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحذف");
    }
  }

  // While cursor is null (before mount), render a stable skeleton to avoid
  // any SSR hydration mismatch from date/timezone differences.
  if (!cursor) {
    return (
      <div className="flex h-full flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">التقويم</h1>
            <p className="text-sm text-muted-foreground">إدارة الأحداث والمواعيد</p>
          </div>
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">التقويم</h1>
          <p className="text-sm text-muted-foreground">إدارة الأحداث والمواعيد</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={() => openAdd(selectedDay || today)}>
            <Plus className="size-4" />
            إضافة حدث
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل الأحداث</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-3">
        {/* calendar grid */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setCursor((c) => subMonths(c || today, 1))} aria-label="الشهر السابق">
                  <ChevronRight className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setCursor((c) => addMonths(c || today, 1))} aria-label="الشهر التالي">
                  <ChevronLeft className="size-4" />
                </Button>
                <CardTitle className="text-lg">
                  {format(cursorDate, "MMMM yyyy", { locale: ar })}
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCursor(startOfMonth(today));
                  setSelectedDay(today);
                }}
              >
                اليوم
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-2">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(key) || [];
                  const inMonth = isSameMonth(day, cursorDate);
                  const isSel = selectedDay && isSameDay(day, selectedDay);
                  const todayFlag = isToday(day);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`relative aspect-square rounded-md border p-1 text-right transition-colors ${
                        isSel
                          ? "border-emerald-glow bg-emerald-glow/10"
                          : "border-transparent hover:bg-accent"
                      } ${inMonth ? "" : "opacity-40"}`}
                    >
                      <span className={`text-xs ${todayFlag ? "font-bold text-emerald-glow" : ""}`}>
                        {format(day, "d")}
                      </span>
                      <div className="absolute bottom-1 right-1 left-1 flex flex-wrap gap-0.5 justify-start">
                        {dayEvents.slice(0, 4).map((e) => (
                          <span key={e.id} className={`size-1.5 rounded-full ${colorClass(e.color)}`} />
                        ))}
                        {dayEvents.length > 4 ? (
                          <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 4}</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* selected day panel */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-emerald-glow" />
              {selectedDay
                ? format(selectedDay, "EEEE d MMMM", { locale: ar })
                : "اختر يوماً"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="custom-scroll h-full">
              <div className="p-2 space-y-2">
                {loading ? (
                  [0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)
                ) : selectedDayEvents.length > 0 ? (
                  selectedDayEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      ev={ev}
                      onEdit={() => openEdit(ev)}
                      onDelete={() => setDeleteId(ev.id)}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <CircleDot className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">لا أحداث في هذا اليوم</p>
                    <Button size="sm" variant="outline" onClick={() => openAdd(selectedDay || today)}>
                      <Plus className="size-4" />
                      إضافة حدث
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* upcoming list */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">الأحداث القادمة</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : upcoming.length > 0 ? (
            <div className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((ev) => (
                <EventCard key={ev.id} ev={ev} compact onEdit={() => openEdit(ev)} onDelete={() => setDeleteId(ev.id)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CalendarDays className="size-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">لا أحداث قادمة</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل حدث" : "إضافة حدث جديد"}</DialogTitle>
            <DialogDescription>أدخل تفاصيل الحدث ثم اضغط حفظ.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-title">العنوان *</Label>
              <Input
                id="ev-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="عنوان الحدث"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ev-start">تاريخ البدء *</Label>
                <Input
                  id="ev-start"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ev-end">تاريخ الانتهاء</Label>
                <Input
                  id="ev-end"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="ev-all-day"
                type="checkbox"
                className="size-4 rounded border-input"
                checked={form.allDay}
                onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
              />
              <Label htmlFor="ev-all-day" className="text-sm font-normal cursor-pointer">طوال اليوم</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>اللون</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-label={c.label}
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      className={`size-7 rounded-full ${c.class} ring-offset-2 transition ${form.color === c.value ? "ring-2 ring-ring" : ""}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-loc">المكان</Label>
              <Input
                id="ev-loc"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="عنوان المكان"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-desc">الوصف</Label>
              <Textarea
                id="ev-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="ملاحظات إضافية"
              />
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
            <AlertDialogDescription>سيتم نقل الحدث إلى سلة المحذوفات. يمكنك استعادته لاحقاً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EventCard({
  ev,
  compact,
  onEdit,
  onDelete,
}: {
  ev: EventItem;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`group rounded-lg border p-2 ${compact ? "" : "bg-card"}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 size-2.5 shrink-0 rounded-full ${colorClass(ev.color)}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{ev.title}</span>
            <Badge variant="secondary" className="shrink-0 text-[10px]">{typeLabel(ev.type)}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {ev.allDay ? "طوال اليوم" : formatTime(ev.startDate)}
            </span>
            {ev.location ? (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="size-3" />
                {ev.location}
              </span>
            ) : null}
          </div>
          {ev.description && !compact ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{ev.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="size-7" onClick={onEdit} aria-label="تعديل">
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={onDelete} aria-label="حذف">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
