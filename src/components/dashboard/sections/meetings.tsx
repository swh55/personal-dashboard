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
  Search,
  X,
  Phone,
  MessageCircle,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface Contact {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  favorite?: boolean;
  relation?: string;
}

/** Split the comma-separated participants string into a trimmed list of names. */
function parseParticipants(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Strip everything except digits and a leading +, for use in tel: links. */
function sanitizePhone(p?: string | null): string {
  if (!p) return "";
  let cleaned = p.replace(/[^\d+]/g, "");
  // Drop any + that is not at the start
  cleaned = cleaned.replace(/(?!^)\+/g, "");
  return cleaned;
}

/** Sanitize and strip leading + for wa.me links (WhatsApp wants digits only). */
function waPhone(p?: string | null): string {
  return sanitizePhone(p).replace(/^\+/, "");
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
  const { data: contactsData } = useApi<Contact[]>("/api/contacts");
  const contacts = contactsData || [];

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

  /** Toggle a contact name in the participants list (add/remove). */
  function toggleParticipant(name: string) {
    setForm((f) => {
      const list = parseParticipants(f.participants);
      const newList = list.includes(name) ? list.filter((n) => n !== name) : [...list, name];
      return { ...f, participants: newList.join(", ") };
    });
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
    <div className="flex h-full flex-col gap-1">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight">الاجتماعات</h1>
          <p className="text-sm text-muted-foreground">{stats.total} اجتماع · {stats.upcoming} قادم</p>
        </div>
        <div className="flex items-center gap-1">
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
      <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
        <StatCard icon={CalendarDays} label="الإجمالي" value={stats.total} accent="emerald" />
        <StatCard icon={Clock} label="قادم" value={stats.upcoming} accent="amber" />
        <StatCard icon={CheckCircle2} label="مكتمل" value={stats.completed} accent="emerald" />
        <StatCard icon={XCircle} label="ملغى" value={stats.cancelled} accent="rose" />
      </div>

      {/* filter */}
      <Card>
        <CardContent className="flex items-center gap-1 p-1">
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
          <div className="me-auto text-xs text-muted-foreground">{filtered.length} اجتماع</div>
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
          <div className="grid grid-cols-1 gap-1 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-1 md:grid-cols-2 xl:grid-cols-3 pb-4">
            {filtered.map((m) => {
              const meta = STATUS_META[m.status] || STATUS_META.scheduled;
              const isUpcoming = m.status === "scheduled" && new Date(m.startDate) > new Date();
              return (
                <Card
                  key={m.id}
                  className="group cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => openDetail(m)}
                >
                  <CardContent className="flex flex-col gap-1 p-1">
                    <div className="flex items-start gap-1">
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
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
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
                        <Users className="size-3 text-emerald-glow/80" />
                        <span className="truncate">
                          {(() => {
                            const list = parseParticipants(m.participants);
                            if (list.length <= 2) return list.join("، ");
                            return `${list.slice(0, 2).join("، ")} +${list.length - 2}`;
                          })()}
                        </span>
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
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <CalendarClock className="size-6 text-muted-foreground/40" />
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
                <DialogTitle className="flex items-center gap-1">
                  {detail.title}
                  <Badge className={`text-[10px] gap-1 ${STATUS_META[detail.status]?.badge}`} variant="secondary">
                    {STATUS_META[detail.status]?.label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{formatDateTime(detail.startDate)}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1">
                {detail.agenda ? (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">جدول الأعمال</div>
                    <div className="rounded-lg bg-muted/40 p-2 text-sm whitespace-pre-wrap">{detail.agenda}</div>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-1 text-sm">
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
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Users className="size-3" />
                      المشاركون ({parseParticipants(detail.participants).length})
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {parseParticipants(detail.participants).map((name) => {
                        const contact = contacts.find((c) => c.name === name) || null;
                        const phone = contact?.phone || null;
                        const wa = waPhone(contact?.whatsapp || contact?.phone);
                        return (
                          <div
                            key={name}
                            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-2"
                          >
                            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-glow/15 text-emerald-glow text-xs font-bold shrink-0">
                              {name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{name}</div>
                              {phone ? (
                                <div className="text-xs text-muted-foreground truncate" dir="ltr">
                                  {phone}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground/60 italic">غير موجود في جهات الاتصال</div>
                              )}
                            </div>
                            {phone ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs text-emerald-glow"
                                >
                                  <a href={`tel:${sanitizePhone(phone)}`}>
                                    <Phone className="size-3" />
                                    اتصال
                                  </a>
                                </Button>
                                {wa ? (
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs text-emerald-glow"
                                  >
                                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                                      <MessageCircle className="size-3" />
                                      واتساب
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
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
          <div className="grid gap-1 max-h-[60vh] overflow-y-auto custom-scroll py-1">
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
            <div className="grid grid-cols-2 gap-1">
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
            <ContactPicker
              contacts={contacts}
              selected={parseParticipants(form.participants)}
              onToggle={toggleParticipant}
            />
            <div className="grid grid-cols-2 gap-1">
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

/**
 * Multi-select contact picker.
 * - Renders a trigger button that opens a searchable popover.
 * - Selected contacts appear as emerald-glow badges above the trigger,
 *   each with an X to remove it.
 * - The picker works on contact *names*; the parent stores the selected
 *   names as a comma-separated string (kept compatible with the existing
 *   `participants: string` schema field).
 */
function ContactPicker({
  contacts,
  selected,
  onToggle,
}: {
  contacts: Contact[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    );
  }, [contacts, query]);

  return (
    <div className="grid gap-1.5">
      <Label>المشاركون</Label>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((name) => (
            <Badge
              key={name}
              variant="secondary"
              className="gap-1 bg-emerald-glow/15 text-emerald-glow pr-1"
            >
              <Users className="size-3" />
              {name}
              <button
                type="button"
                aria-label={`إزالة ${name}`}
                className="rounded-full p-0.5 hover:bg-emerald-glow/20"
                onClick={() => onToggle(name)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className="justify-start w-full font-normal"
          >
            <Search className="size-4 text-muted-foreground" />
            {selected.length > 0 ? (
              <span className="text-muted-foreground">إضافة المزيد...</span>
            ) : (
              <span className="text-muted-foreground">اختر المشاركين من جهات الاتصال</span>
            )}
            {selected.length > 0 ? (
              <Badge
                className="ms-auto bg-emerald-glow/15 text-emerald-glow"
                variant="secondary"
              >
                {selected.length}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: "var(--radix-popover-trigger-width)", minWidth: 260 }}
        >
          <div className="flex flex-col">
            <div className="border-b p-2">
              <Input
                placeholder="بحث بالاسم أو الرقم..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8"
              />
            </div>
            <ScrollArea className="h-60">
              {contacts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  لا جهات اتصال متاحة
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  لا نتائج
                </div>
              ) : (
                <div className="flex flex-col">
                  {filtered.map((c) => {
                    const checked = selected.includes(c.name);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onToggle(c.name)}
                        className="flex items-center gap-2 px-3 py-2 text-start hover:bg-muted/40 text-sm"
                      >
                        <Checkbox checked={checked} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{c.name}</div>
                          {c.phone ? (
                            <div className="truncate text-xs text-muted-foreground" dir="ltr">
                              {c.phone}
                            </div>
                          ) : null}
                        </div>
                        {c.favorite ? (
                          <Badge
                            className="text-[9px] bg-amber-glow/15 text-amber-glow"
                            variant="secondary"
                          >
                            مميز
                          </Badge>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
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
      <CardContent className="flex items-center gap-1 p-1">
        <div className={`flex size-7 items-center justify-center rounded-md shrink-0 ${accentClass}`}>
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
