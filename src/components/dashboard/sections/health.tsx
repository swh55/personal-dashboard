"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Pill,
  Moon,
  Activity,
  BedDouble,
  Sun,
  StickyNote,
  Timer,
  Star,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useApi, toast, formatDate, formatTime } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

interface SleepLog {
  id: string;
  date: string;
  bedtime: string | null;
  wakeTime: string | null;
  duration: number;
  quality: string;
  note: string | null;
  createdAt: string;
}

interface HealthStats {
  medicationsActive: number;
  avgSleepMinutes: number;
  avgSleepHours: number;
  avgQuality: number;
  sleepLogsCount: number;
}

interface HealthData {
  medications: Medication[];
  sleepLogs: SleepLog[];
}

const QUALITY_OPTIONS = [
  { value: "poor", label: "سيئة", emoji: "😞", color: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  { value: "fair", label: "مقبولة", emoji: "😐", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { value: "good", label: "جيدة", emoji: "🙂", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "excellent", label: "ممتازة", emoji: "😄", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "يومياً" },
  { value: "twice-daily", label: "مرتين يومياً" },
  { value: "weekly", label: "أسبوعياً" },
  { value: "as-needed", label: "عند الحاجة" },
];

function qualityMeta(q: string) {
  return QUALITY_OPTIONS.find((x) => x.value === q) || QUALITY_OPTIONS[2];
}

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} س ${m} د`;
}

const EMPTY_MED = {
  name: "",
  dosage: "",
  frequency: "daily",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  notes: "",
};

const EMPTY_SLEEP = {
  date: new Date().toISOString().slice(0, 10),
  bedtime: "",
  wakeTime: "",
  quality: "good",
  note: "",
};

export function HealthSection() {
  const { data, raw, loading, error, reload } = useApi<HealthData>("/api/health");
  const medications = data?.medications || [];
  const sleepLogs = data?.sleepLogs || [];
  const stats: HealthStats = raw?.stats || { medicationsActive: 0, avgSleepMinutes: 0, avgSleepHours: 0, avgQuality: 0, sleepLogsCount: 0 };

  const [medDialogOpen, setMedDialogOpen] = React.useState(false);
  const [sleepDialogOpen, setSleepDialogOpen] = React.useState(false);
  const [editingMed, setEditingMed] = React.useState<Medication | null>(null);
  const [deleteMed, setDeleteMed] = React.useState<Medication | null>(null);
  const [deleteSleep, setDeleteSleep] = React.useState<SleepLog | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [medForm, setMedForm] = React.useState(EMPTY_MED);
  const [sleepForm, setSleepForm] = React.useState(EMPTY_SLEEP);

  const sleepChart = React.useMemo(() => {
    return sleepLogs
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((s) => ({
        date: new Date(s.date).toLocaleDateString("ar-SY", { day: "numeric", month: "short" }),
        hours: +(s.duration / 60).toFixed(2),
        quality: qualityMeta(s.quality).label,
      }));
  }, [sleepLogs]);

  function openAddMed() {
    setEditingMed(null);
    setMedForm(EMPTY_MED);
    setMedDialogOpen(true);
  }

  function openEditMed(m: Medication) {
    setEditingMed(m);
    setMedForm({
      name: m.name,
      dosage: m.dosage || "",
      frequency: m.frequency,
      startDate: new Date(m.startDate).toISOString().slice(0, 10),
      endDate: m.endDate ? new Date(m.endDate).toISOString().slice(0, 10) : "",
      notes: m.notes || "",
    });
    setMedDialogOpen(true);
  }

  function openAddSleep() {
    setSleepForm(EMPTY_SLEEP);
    setSleepDialogOpen(true);
  }

  async function submitMed() {
    if (!medForm.name.trim()) {
      toast.error("اسم الدواء مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        name: medForm.name.trim(),
        dosage: medForm.dosage || null,
        frequency: medForm.frequency,
        startDate: new Date(medForm.startDate).toISOString(),
        endDate: medForm.endDate ? new Date(medForm.endDate).toISOString() : null,
        notes: medForm.notes || null,
      };
      const res = await fetch("/api/health", {
        method: editingMed ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingMed
            ? { type: "medication", id: editingMed.id, ...payload }
            : { type: "medication", ...payload }
        ),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editingMed ? "تم تحديث الدواء" : "تمت إضافة الدواء");
      setMedDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleMedActive(m: Medication) {
    try {
      const res = await fetch("/api/health", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "medication", id: m.id, active: !m.active }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(m.active ? "تم إيقاف الدواء" : "تم تفعيل الدواء");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function submitSleep() {
    if (!sleepForm.bedtime || !sleepForm.wakeTime) {
      toast.error("وقت النوم والاستيقاظ مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sleep",
          date: sleepForm.date,
          bedtime: sleepForm.bedtime,
          wakeTime: sleepForm.wakeTime,
          quality: sleepForm.quality,
          note: sleepForm.note || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success("تمت إضافة سجل النوم");
      setSleepDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteMed() {
    if (!deleteMed) return;
    try {
      const res = await fetch(`/api/health?id=${deleteMed.id}&type=medication`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف الدواء");
      setDeleteMed(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function confirmDeleteSleep() {
    if (!deleteSleep) return;
    try {
      const res = await fetch(`/api/health?id=${deleteSleep.id}&type=sleep`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف السجل");
      setDeleteSleep(null);
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
          <h1 className="text-xl font-bold tracking-tight">الصحة</h1>
          <p className="text-sm text-muted-foreground">الأدوية، النوم، والمتابعة الصحية</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={openAddSleep}>
            <Moon className="size-4" />
            سجل نوم
          </Button>
          <Button size="sm" onClick={openAddMed}>
            <Plus className="size-4" />
            دواء جديد
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <StatCard icon={Pill} label="أدوية نشطة" value={`${stats.medicationsActive}`} sub={`${medications.length} إجمالي`} accent="emerald" />
        <StatCard icon={Moon} label="متوسط النوم" value={`${stats.avgSleepHours} س`} sub={minutesToHours(stats.avgSleepMinutes)} accent="amber" />
        <StatCard icon={Star} label="متوسط الجودة" value={`${stats.avgQuality} / 4`} sub={`${stats.sleepLogsCount} سجل`} accent="emerald" />
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل البيانات الصحية</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid flex-1 min-h-0 gap-2 lg:grid-cols-[1fr_1fr]">
        {/* medications */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Pill className="size-4 text-emerald-glow" />
              الأدوية
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="custom-scroll h-full max-h-[60vh] -mx-1 px-1">
              {loading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
              ) : medications.length > 0 ? (
                <div className="flex flex-col gap-2 pb-2">
                  {medications.map((m) => (
                    <div
                      key={m.id}
                      className={`group rounded-xl border p-2 transition-shadow hover:shadow-md ${m.active ? "border-emerald-glow/30 bg-emerald-glow/5" : "border-border opacity-70"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`flex size-9 items-center justify-center rounded-md shrink-0 ${m.active ? "bg-emerald-glow/15 text-emerald-glow" : "bg-muted text-muted-foreground"}`}>
                            <Pill className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold truncate">{m.name}</span>
                              <Badge variant="outline" className="text-[10px]">{FREQUENCY_OPTIONS.find((f) => f.value === m.frequency)?.label || m.frequency}</Badge>
                            </div>
                            {m.dosage ? <div className="text-xs text-muted-foreground">{m.dosage}</div> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch checked={m.active} onCheckedChange={() => toggleMedActive(m)} aria-label="تفعيل الدواء" />
                          <Button size="icon" variant="ghost" className="size-7 opacity-0 transition-opacity group-hover:opacity-100" onClick={() => openEditMed(m)} aria-label="تعديل">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100" onClick={() => setDeleteMed(m)} aria-label="حذف">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Activity className="size-3" />
                          {formatDate(m.startDate, { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        {m.endDate ? (
                          <span className="inline-flex items-center gap-1">
                            ← {formatDate(m.endDate, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        ) : null}
                      </div>
                      {m.notes ? (
                        <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                          <StickyNote className="size-3 inline ml-1" />
                          {m.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Pill}
                  title="لا أدوية"
                  desc="أضف أدويتك لمتابعتها"
                  action={<Button size="sm" variant="outline" onClick={openAddMed}><Plus className="size-4" />دواء جديد</Button>}
                />
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* sleep */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Moon className="size-4 text-amber-glow" />
              سجل النوم
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7" onClick={openAddSleep}>
              <Plus className="size-3.5" />
              جديد
            </Button>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col gap-2">
            {/* chart */}
            <div className="h-32 shrink-0">
              {loading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : sleepChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sleepChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="oklch(0.7 0 0)" />
                    <YAxis domain={[0, 12]} tick={{ fontSize: 10 }} stroke="oklch(0.7 0 0)" />
                    <Tooltip
                      formatter={(v: number) => [`${v} ساعة`, "النوم"]}
                      contentStyle={{ direction: "rtl", fontSize: "12px", borderRadius: "8px" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke="oklch(0.78 0.18 152)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "oklch(0.82 0.16 75)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  لا بيانات نوم بعد
                </div>
              )}
            </div>

            <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
              {!loading && sleepLogs.length > 0 ? (
                <div className="flex flex-col gap-1.5 pb-2">
                  {sleepLogs.map((s) => {
                    const q = qualityMeta(s.quality);
                    return (
                      <div
                        key={s.id}
                        className="group flex items-center gap-2 rounded-lg border p-2 transition-shadow hover:shadow-sm"
                      >
                        <div className="flex flex-col items-center justify-center min-w-[44px] shrink-0">
                          <span className="text-[10px] text-muted-foreground">{new Date(s.date).toLocaleDateString("ar-SY", { weekday: "short" })}</span>
                          <span className="text-sm font-bold">{new Date(s.date).getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={`text-[10px] ${q.color} border`}>
                              <span className="ml-1">{q.emoji}</span>
                              {q.label}
                            </Badge>
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Timer className="size-3" />
                              {minutesToHours(s.duration)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            {s.bedtime ? (
                              <span className="inline-flex items-center gap-1">
                                <BedDouble className="size-3" />
                                {formatTime(s.bedtime)}
                              </span>
                            ) : null}
                            {s.wakeTime ? (
                              <span className="inline-flex items-center gap-1">
                                <Sun className="size-3" />
                                {formatTime(s.wakeTime)}
                              </span>
                            ) : null}
                          </div>
                          {s.note ? <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{s.note}</div> : null}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => setDeleteSleep(s)}
                          aria-label="حذف"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : !loading ? (
                <EmptyState
                  icon={Moon}
                  title="لا سجلات نوم"
                  desc="أضف أول سجل لمتابعة نمط نومك"
                  action={<Button size="sm" variant="outline" onClick={openAddSleep}><Plus className="size-4" />سجل نوم</Button>}
                />
              ) : null}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* medication dialog */}
      <Dialog open={medDialogOpen} onOpenChange={setMedDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMed ? "تعديل دواء" : "إضافة دواء"}</DialogTitle>
            <DialogDescription>أدخل تفاصيل الدواء والمتابعة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="m-name">اسم الدواء *</Label>
              <Input id="m-name" value={medForm.name} onChange={(e) => setMedForm((f) => ({ ...f, name: e.target.value }))} placeholder="مثال: باراسيتامول" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-dose">الجرعة</Label>
                <Input id="m-dose" value={medForm.dosage} onChange={(e) => setMedForm((f) => ({ ...f, dosage: e.target.value }))} placeholder="500mg" />
              </div>
              <div className="grid gap-1.5">
                <Label>التكرار</Label>
                <Select value={medForm.frequency} onValueChange={(v) => setMedForm((f) => ({ ...f, frequency: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-start">تاريخ البدء</Label>
                <Input id="m-start" type="date" value={medForm.startDate} onChange={(e) => setMedForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-end">تاريخ الانتهاء</Label>
                <Input id="m-end" type="date" value={medForm.endDate} onChange={(e) => setMedForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-notes">ملاحظات</Label>
              <Textarea id="m-notes" rows={2} value={medForm.notes} onChange={(e) => setMedForm((f) => ({ ...f, notes: e.target.value }))} placeholder="مثال: بعد الأكل" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedDialogOpen(false)}>إلغاء</Button>
            <Button onClick={submitMed} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* sleep dialog */}
      <Dialog open={sleepDialogOpen} onOpenChange={setSleepDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة سجل نوم</DialogTitle>
            <DialogDescription>سجّل ساعات نومك وجودتها.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="s-date">التاريخ</Label>
              <Input id="s-date" type="date" value={sleepForm.date} onChange={(e) => setSleepForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="s-bed">وقت النوم</Label>
                <Input
                  id="s-bed"
                  type="datetime-local"
                  value={sleepForm.bedtime}
                  onChange={(e) => setSleepForm((f) => ({ ...f, bedtime: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-wake">وقت الاستيقاظ</Label>
                <Input
                  id="s-wake"
                  type="datetime-local"
                  value={sleepForm.wakeTime}
                  onChange={(e) => setSleepForm((f) => ({ ...f, wakeTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>الجودة</Label>
              <Select value={sleepForm.quality} onValueChange={(v) => setSleepForm((f) => ({ ...f, quality: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUALITY_OPTIONS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>
                      {q.emoji} {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-note">ملاحظات</Label>
              <Textarea id="s-note" rows={2} value={sleepForm.note} onChange={(e) => setSleepForm((f) => ({ ...f, note: e.target.value }))} placeholder="مثال: استيقظت مرتين" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSleepDialogOpen(false)}>إلغاء</Button>
            <Button onClick={submitSleep} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete med */}
      <AlertDialog open={!!deleteMed} onOpenChange={(o) => !o && setDeleteMed(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الدواء</AlertDialogTitle>
            <AlertDialogDescription>سيتم نقل الدواء إلى سلة المحذوفات.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMed} className="bg-destructive text-white hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* delete sleep */}
      <AlertDialog open={!!deleteSleep} onOpenChange={(o) => !o && setDeleteSleep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سجل النوم</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف السجل نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSleep} className="bg-destructive text-white hover:bg-destructive/90">حذف</AlertDialogAction>
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
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent: "emerald" | "amber";
}) {
  const accentClass = accent === "emerald" ? "text-emerald-glow bg-emerald-glow/10" : "text-amber-glow bg-amber-glow/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-2">
        <div className={`flex size-9 items-center justify-center rounded-md shrink-0 ${accentClass}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-base font-bold truncate">{value}</div>
          {sub ? <div className="text-[10px] text-muted-foreground truncate">{sub}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Icon className="size-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
      {action}
    </div>
  );
}
