"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Send,
  MessageCircle,
  MessageSquare,
  Mail,
  Clock,
  CheckCircle2,
  CalendarClock,
  Inbox,
} from "lucide-react";
import { useApi, toast, formatDate, formatTime, formatDateTime } from "@/lib/api";
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

interface ScheduledMessage {
  id: string;
  recipient: string;
  message: string;
  channel: string; // whatsapp | sms | telegram | email
  scheduledAt: string;
  sent: boolean;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CHANNELS = [
  {
    value: "whatsapp",
    label: "واتساب",
    icon: MessageCircle,
    badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  {
    value: "sms",
    label: "SMS",
    icon: MessageSquare,
    badge: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    dot: "bg-blue-500",
  },
  {
    value: "telegram",
    label: "تيليغرام",
    icon: Send,
    badge: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
    dot: "bg-cyan-500",
  },
  {
    value: "email",
    label: "بريد",
    icon: Mail,
    badge: "bg-violet-500/15 text-violet-500 border-violet-500/30",
    dot: "bg-violet-500",
  },
] as const;

function channelMeta(c: string) {
  return CHANNELS.find((x) => x.value === c) || CHANNELS[0];
}

/** Format a future date as a friendly countdown. */
function countdown(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "حان الموعد";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `بعد ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `بعد ${hr} ساعة و ${min % 60} د`;
  const day = Math.floor(hr / 24);
  return `بعد ${day} يوم و ${hr % 24} س`;
}

/** Convert Date to local datetime-local input value (yyyy-MM-ddTHH:mm). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  recipient: "",
  message: "",
  channel: "whatsapp",
  scheduledAt: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
};

type TabValue = "all" | "pending" | "sent";

export function ScheduledMessagesSection() {
  const { data, loading, error, reload } = useApi<ScheduledMessage[]>("/api/scheduled-messages");
  const messages = data || [];

  const [tab, setTab] = React.useState<TabValue>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ScheduledMessage | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [, forceTick] = React.useState(0);

  // refresh countdowns every 30 seconds
  React.useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const stats = React.useMemo(() => ({
    total: messages.length,
    pending: messages.filter((m) => !m.sent).length,
    sent: messages.filter((m) => m.sent).length,
  }), [messages]);

  const filtered = React.useMemo(() => {
    if (tab === "pending") return messages.filter((m) => !m.sent);
    if (tab === "sent") return messages.filter((m) => m.sent);
    return messages;
  }, [messages, tab]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(m: ScheduledMessage) {
    setEditing(m);
    setForm({
      recipient: m.recipient,
      message: m.message,
      channel: m.channel,
      scheduledAt: toLocalInput(new Date(m.scheduledAt)),
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.recipient.trim()) {
      toast.error("المستلم مطلوب");
      return;
    }
    if (!form.message.trim()) {
      toast.error("الرسالة مطلوبة");
      return;
    }
    if (!form.scheduledAt) {
      toast.error("وقت الإرسال مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        recipient: form.recipient.trim(),
        message: form.message.trim(),
        channel: form.channel,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      };
      const res = await fetch("/api/scheduled-messages", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث الرسالة" : "تمت جدولة الرسالة");
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
      const res = await fetch(`/api/scheduled-messages?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الرسالة");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function markSent(m: ScheduledMessage) {
    try {
      const res = await fetch("/api/scheduled-messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, sent: true, sentAt: new Date().toISOString() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success("تم تحديد الرسالة كمُرسَلة");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  const statCards = [
    { label: "الإجمالي", value: stats.total, icon: CalendarClock, cls: "bg-emerald-glow/15 text-emerald-glow" },
    { label: "بانتظار الإرسال", value: stats.pending, icon: Clock, cls: "bg-amber-500/15 text-amber-500" },
    { label: "مُرسَلة", value: stats.sent, icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-500" },
  ];

  return (
    <div className="flex h-full flex-col gap-1">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">الرسائل المجدولة</h2>
          <p className="text-sm text-muted-foreground">
            جدولة رسائل الواتساب وSMS والتيليغرام والبريد لإرسالها لاحقاً
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>جدولة رسالة</span>
          </Button>
        </div>
      </header>

      {/* stats */}
      <div className="grid grid-cols-3 gap-1">
        {statCards.map((s) => {
          const I = s.icon;
          return (
            <Card key={s.label} className="border-border/60">
              <CardContent className="flex items-center gap-1 p-1">
                <div className={`flex size-7 items-center justify-center rounded-md shrink-0 ${s.cls}`}>
                  <I className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold leading-none">{s.value}</div>
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
          <TabsTrigger value="pending">
            بانتظار
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{stats.pending}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sent">
            مُرسَلة
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{stats.sent}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل الرسائل</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={reload}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        {loading ? (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-1 pb-4 lg:grid-cols-2">
            {filtered.map((m) => {
              const meta = channelMeta(m.channel);
              const I = meta.icon;
              const schedDate = new Date(m.scheduledAt);
              const isFuture = !m.sent && schedDate.getTime() > Date.now();
              return (
                <Card
                  key={m.id}
                  className={`group transition-shadow hover:shadow-md ${m.sent ? "opacity-70" : ""}`}
                >
                  <CardContent className="flex flex-col gap-1 p-1">
                    <div className="flex items-start gap-1">
                      <div className={`flex size-7 items-center justify-center rounded-md shrink-0 ${meta.badge}`}>
                        <I className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold truncate" dir="auto">{m.recipient}</span>
                          <Badge variant="outline" className={`h-5 gap-1 text-[10px] ${meta.badge}`}>
                            {meta.label}
                          </Badge>
                          {m.sent ? (
                            <Badge className="h-5 gap-1 text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                              <CheckCircle2 className="size-3" />
                              مُرسَلة
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap" dir="auto">
                          {m.message}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {!m.sent ? (
                          <Button size="icon" variant="ghost" className="size-7 text-emerald-glow" onClick={() => markSent(m)} aria-label="تحديد كمُرسَلة" title="تحديد كمُرسَلة">
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        ) : null}
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(m)} aria-label="تعديل">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => setDeleteId(m.id)} aria-label="حذف">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground border-t pt-2 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3 text-emerald-glow" />
                        {formatDateTime(schedDate)}
                      </span>
                      {m.sent && m.sentAt ? (
                        <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                          <CheckCircle2 className="size-3" />
                          أُرسلت {formatTime(m.sentAt)}
                        </Badge>
                      ) : isFuture ? (
                        <Badge variant="outline" className="h-5 gap-1 text-[10px] text-amber-500 border-amber-500/30">
                          <Clock className="size-3" />
                          {countdown(schedDate)}
                        </Badge>
                      ) : !m.sent ? (
                        <Badge variant="outline" className="h-5 gap-1 text-[10px] text-rose-500 border-rose-500/30">
                          <Clock className="size-3" />
                          متأخرة
                        </Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <Inbox className="size-6 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا رسائل {tab === "pending" ? "بانتظار الإرسال" : tab === "sent" ? "مُرسَلة" : "مجدولة"}</p>
            <p className="text-xs text-muted-foreground">جدول رسالة لإرسالها في وقت محدد</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              جدولة رسالة
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل رسالة مجدولة" : "جدولة رسالة"}</DialogTitle>
            <DialogDescription>حدّد المستلم والقناة والوقت لإرسال الرسالة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="sm-recipient">المستلم *</Label>
              <Input
                id="sm-recipient"
                value={form.recipient}
                onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
                placeholder="رقم الهاتف أو البريد الإلكتروني"
                dir="auto"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>القناة</Label>
              <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => {
                const I = c.icon;
                return (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="inline-flex items-center gap-1">
                      <I className="size-3.5" />
                      {c.label}
                    </span>
                  </SelectItem>
                );
              })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sm-message">الرسالة *</Label>
              <Textarea
                id="sm-message"
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="نص الرسالة"
                dir="auto"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sm-at">وقت الإرسال *</Label>
              <Input
                id="sm-at"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "جدولة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الرسالة</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف الرسالة المجدولة. لا يمكن التراجع.</AlertDialogDescription>
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
