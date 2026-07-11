"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Phone,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  Bell,
  BellOff,
  User,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
} from "lucide-react";
import { useApi, toast, formatDate, timeAgo, daysUntil } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface ContactReminder {
  id: string;
  contactId: string | null;
  contactName: string;
  frequency: string; // daily | weekly | monthly
  lastContacted: string | null;
  nextReminder: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  overdue?: boolean;
  daysUntilDue?: number | null;
}

interface RemindersMeta {
  count: number;
  overdue: number;
}

const FREQUENCIES = [
  { value: "daily", label: "يومي", icon: Calendar, cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "weekly", label: "أسبوعي", icon: CalendarDays, cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "monthly", label: "شهري", icon: CalendarRange, cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
] as const;

function freqMeta(f: string) {
  return FREQUENCIES.find((x) => x.value === f) || FREQUENCIES[1];
}

function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const EMPTY_FORM = {
  contactName: "",
  frequency: "weekly",
  lastContacted: "",
  nextReminder: "",
  active: true,
};

type TabValue = "all" | "due" | "active";

export function ContactRemindersSection() {
  const { data, raw, loading, error, reload } = useApi<ContactReminder[]>("/api/contact-reminders");
  const reminders = data || [];
  const meta: RemindersMeta | undefined = raw?.meta;

  const [tab, setTab] = React.useState<TabValue>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContactReminder | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [markingId, setMarkingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const stats = React.useMemo(() => ({
    total: meta?.count ?? reminders.length,
    overdue: meta?.overdue ?? reminders.filter((r) => r.overdue).length,
    active: reminders.filter((r) => r.active).length,
  }), [meta, reminders]);

  const filtered = React.useMemo(() => {
    if (tab === "due") return reminders.filter((r) => r.overdue);
    if (tab === "active") return reminders.filter((r) => r.active);
    return reminders;
  }, [reminders, tab]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(r: ContactReminder) {
    setEditing(r);
    setForm({
      contactName: r.contactName,
      frequency: r.frequency,
      lastContacted: toDateInput(r.lastContacted),
      nextReminder: toDateInput(r.nextReminder),
      active: r.active,
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.contactName.trim()) {
      toast.error("اسم جهة الاتصال مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        contactName: form.contactName.trim(),
        frequency: form.frequency,
        active: Boolean(form.active),
      };
      if (form.lastContacted) payload.lastContacted = new Date(form.lastContacted).toISOString();
      else payload.lastContacted = null;
      if (form.nextReminder) payload.nextReminder = new Date(form.nextReminder).toISOString();

      const res = await fetch("/api/contact-reminders", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث التذكير" : "تمت إضافة التذكير");
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
      const res = await fetch(`/api/contact-reminders?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف التذكير");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function toggleActive(r: ContactReminder, next: boolean) {
    setTogglingId(r.id);
    try {
      const res = await fetch("/api/contact-reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, active: next }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(next ? "تم تفعيل التذكير" : "تم تعطيل التذكير");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setTogglingId(null);
    }
  }

  async function markContacted(r: ContactReminder) {
    setMarkingId(r.id);
    try {
      const res = await fetch("/api/contact-reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, lastContacted: new Date().toISOString() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(`تم تحديث آخر تواصل مع ${r.contactName}`);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setMarkingId(null);
    }
  }

  const statCards = [
    { label: "الإجمالي", value: stats.total, icon: Bell, cls: "bg-emerald-glow/15 text-emerald-glow" },
    { label: "متأخرة", value: stats.overdue, icon: AlertTriangle, cls: "bg-rose-500/15 text-rose-500" },
    { label: "نشطة", value: stats.active, icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-500" },
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">تذكيرات التواصل</h2>
          <p className="text-sm text-muted-foreground">
            نظّم تواصلك الدوري مع الأشخاص المهمين
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>تذكير جديد</span>
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
          <TabsTrigger value="due">
            مستحقة الآن
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{stats.overdue}</Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            نشطة
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{stats.active}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل التذكيرات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={reload}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2">
            {filtered.map((r) => {
              const fm = freqMeta(r.frequency);
              const FI = fm.icon;
              const dueDays = r.daysUntilDue ?? (r.nextReminder ? daysUntil(r.nextReminder) : null);
              const isOverdue = r.overdue || (dueDays !== null && dueDays < 0);
              return (
                <Card
                  key={r.id}
                  className={`group transition-shadow hover:shadow-md ${!r.active ? "opacity-60" : ""} ${isOverdue && r.active ? "border-rose-500/40 bg-rose-500/5" : ""}`}
                >
                  <CardContent className="flex flex-col gap-2 p-2">
                    <div className="flex items-start gap-2">
                      <div className={`flex size-9 items-center justify-center rounded-md shrink-0 ${isOverdue && r.active ? "bg-rose-500/15 text-rose-500" : "bg-emerald-glow/15 text-emerald-glow"}`}>
                        <User className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold truncate" dir="auto">{r.contactName}</span>
                          <Badge variant="outline" className={`h-5 gap-1 text-[10px] ${fm.cls}`}>
                            <FI className="size-3" />
                            {fm.label}
                          </Badge>
                          {r.active ? (
                            <Badge variant="outline" className="h-5 gap-1 text-[10px] text-emerald-500 border-emerald-500/30">
                              <Bell className="size-3" />
                              نشط
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-5 gap-1 text-[10px] text-muted-foreground">
                              <BellOff className="size-3" />
                              متوقف
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <PhoneCall className="size-3" />
                            آخر تواصل:{" "}
                            {r.lastContacted ? (
                              <span>
                                {formatDate(r.lastContacted, { day: "numeric", month: "short", year: "numeric" })}
                                <span className="text-muted-foreground/70"> ({timeAgo(r.lastContacted)})</span>
                              </span>
                            ) : "غير مسجّل"}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3" />
                            التذكير القادم:{" "}
                            {r.nextReminder ? (
                              <span className={isOverdue && r.active ? "text-rose-500 font-medium" : ""}>
                                {formatDate(r.nextReminder, { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            ) : "—"}
                            {dueDays !== null && r.nextReminder ? (
                              <Badge
                                variant="outline"
                                className={`h-4 px-1 text-[10px] ${
                                  isOverdue
                                    ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
                                    : dueDays <= 1
                                    ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {dueDays === 0 ? "اليوم" : dueDays > 0 ? `بعد ${dueDays} يوم` : `متأخر ${Math.abs(dueDays)} يوم`}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={r.active}
                        disabled={togglingId === r.id}
                        onCheckedChange={(v) => toggleActive(r, v)}
                        aria-label="تفعيل التذكير"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 border-t pt-2 mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={markingId === r.id}
                        onClick={() => markContacted(r)}
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-glow" />
                        {markingId === r.id ? "جارٍ..." : "تم التواصل"}
                      </Button>
                      <div className="flex-1" />
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(r)} aria-label="تعديل">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setDeleteId(r.id)} aria-label="حذف">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Bell className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا تذكيرات {tab === "due" ? "مستحقة" : "محفوظة"}</p>
            <p className="text-xs text-muted-foreground">أضف شخصاً لتذكيرك بالتواصل معه دورياً</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              تذكير جديد
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل تذكير" : "إضافة تذكير تواصل"}</DialogTitle>
            <DialogDescription>سيتم تذكيرك بالتواصل مع هذا الشخص دورياً.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="cr-name">اسم جهة الاتصال *</Label>
              <Input
                id="cr-name"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                placeholder="مثال: العم أبو محمد"
                dir="auto"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>تكرار التذكير</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((fr) => {
                    const FI = fr.icon;
                    return (
                      <SelectItem key={fr.value} value={fr.value}>
                        <span className="inline-flex items-center gap-2">
                          <FI className="size-3.5" />
                          {fr.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cr-last">آخر تواصل</Label>
                <Input
                  id="cr-last"
                  type="date"
                  value={form.lastContacted}
                  onChange={(e) => setForm((f) => ({ ...f, lastContacted: e.target.value }))}
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cr-next">التذكير القادم</Label>
                <Input
                  id="cr-next"
                  type="date"
                  value={form.nextReminder}
                  onChange={(e) => setForm((f) => ({ ...f, nextReminder: e.target.value }))}
                  dir="ltr"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              إذا تُرك التذكير القادم فارغاً، سيُحسب تلقائياً من تاريخ آخر تواصل والتكرار.
            </p>
            <div className="flex items-center justify-between rounded-md border p-2.5">
              <div>
                <Label htmlFor="cr-active" className="text-sm font-medium cursor-pointer">التذكير نشط</Label>
                <p className="text-[11px] text-muted-foreground">عطّله لإيقاف التذكير مؤقتاً</p>
              </div>
              <Switch
                id="cr-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
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
            <AlertDialogTitle>حذف التذكير</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف التذكير نهائياً.</AlertDialogDescription>
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
