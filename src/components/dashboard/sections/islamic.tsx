"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  CircleAlert,
  BookOpen,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  CloudSun,
  Star,
  Sparkles,
  CalendarHeart,
  Clock,
} from "lucide-react";
import { useApi, toast, formatDate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface QuranLog {
  id: string;
  surah: number;
  fromAyah: number;
  toAyah: number;
  juz: number | null;
  note: string | null;
  date: string;
  createdAt: string;
}

interface QuranStats {
  totalAyahs: number;
  surahsRead: number;
  sessions: number;
  surahNames: string[];
}

interface QuranResponse {
  data: QuranLog[];
  stats: QuranStats;
}

interface WeatherData {
  current: {
    temperature: number;
    weatherDescription: string;
    weatherIcon: string;
  };
  forecast: Array<{
    date: string;
    sunrise: string;
    sunset: string;
  }>;
  city: string;
}

interface WeatherResponse {
  data: WeatherData;
}

// Static approximate prayer times for Aleppo (Syria)
const PRAYER_TIMES = [
  { key: "fajr", name: "الفجر", hour: 5, minute: 0, icon: Sunrise },
  { key: "dhuhr", name: "الظهر", hour: 12, minute: 30, icon: Sun },
  { key: "asr", name: "العصر", hour: 15, minute: 45, icon: CloudSun },
  { key: "maghrib", name: "المغرب", hour: 19, minute: 0, icon: Sunset },
  { key: "isha", name: "العشاء", hour: 20, minute: 30, icon: Moon },
];

const DHIKR_LIST = [
  { ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", count: "100 مرة", virtue: "غُرست له نخلة في الجنة" },
  { ar: "لا إلَهَ إلا اللَّهُ وَحْدَهُ لا شَرِيكَ لَهُ، لَهُ المُلْكُ وَلَهُ الحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ", count: "10 مرات", virtue: "عدلت عتق رقبة" },
  { ar: "سُبْحَانَ اللَّهِ، والْحَمْدُ لِلَّهِ، ولا إلَهَ إلا اللَّهُ، واللَّهُ أَكْبَرُ", count: "100 مرة", virtue: "أحب الكلام إلى الله" },
  { ar: "لا حَوْلَ ولا قُوَّةَ إلا باللَّهِ", count: "كثيراً", virtue: "كنز من كنوز الجنة" },
  { ar: "أَسْتَغْفِرُ اللَّهَ العَظِيمَ الذي لا إلَهَ إلا هو الحَيَّ القَيُّومَ وأتُوبُ إلَيْهِ", count: "100 مرة", virtue: "غُفرت ذنوبه وإن كان فرَّ من الزحف" },
  { ar: "اللَّهُمَّ صَلِّ وسَلِّمْ علَى نَبِيِّنَا مُحَمَّدٍ", count: "100 مرة", virtue: "صلى الله عليه عشراً" },
  { ar: "بِسْمِ اللَّهِ الذي لا يَضُرُّ مع اسْمِهِ شَيْءٌ في الأرْضِ ولا في السَّماءِ وهو السَّمِيعُ العَلِيمُ", count: "3 مرات", virtue: "لم يضره شيء" },
  { ar: "رَضِيتُ باللَّهِ رَبًّا، وبالإسْلامِ دِينًا، وبمُحَمَّدٍ صَلَّى اللهُ عليه وسلَّمَ نَبِيًّا", count: "3 مرات", virtue: "كان حقاً على الله أن يُرضيه يوم القيامة" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getHijriDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "ربيع الأول 1447";
  }
}

function getGregorianDateAr(date: Date): string {
  try {
    return new Intl.DateTimeFormat("ar-SY", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return formatDate(date);
  }
}

function getNextPrayerIndex(): { index: number; untilMs: number } {
  const now = new Date();
  const nowMs = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000;
  for (let i = 0; i < PRAYER_TIMES.length; i++) {
    const p = PRAYER_TIMES[i];
    const pMs = p.hour * 3600000 + p.minute * 60000;
    if (pMs > nowMs) {
      return { index: i, untilMs: pMs - nowMs };
    }
  }
  // After Isha — next is Fajr tomorrow
  const fajrMs = PRAYER_TIMES[0].hour * 3600000 + PRAYER_TIMES[0].minute * 60000;
  return { index: 0, untilMs: 24 * 3600000 - nowMs + fajrMs };
}

function formatCountdown(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} س ${m} د`;
  return `${m} دقيقة`;
}

const EMPTY_FORM = {
  surah: "1",
  fromAyah: "1",
  toAyah: "1",
  juz: "",
  note: "",
};

export function IslamicSection() {
  const { data: quranLogs, raw: quranRaw, loading, error, reload } = useApi<QuranLog[]>("/api/quran");
  const { data: weather, raw: weatherRaw } = useApi<WeatherResponse["data"]>("/api/weather");

  const logs = quranLogs || [];
  const stats = quranRaw?.stats || { totalAyahs: 0, surahsRead: 0, sessions: 0, surahNames: [] };
  const surahNames = stats.surahNames || [];

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  // Start as null to avoid SSR hydration mismatch (server timezone differs
  // from the browser's). Set on mount, then tick every minute.
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Rotating dhikr based on day of year (guarded for null `now` during SSR)
  const dayOfYear = now
    ? Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
    : 0;
  const todaysDhikr = DHIKR_LIST[dayOfYear % DHIKR_LIST.length];
  const nextPrayer = React.useMemo(() => (now ? getNextPrayerIndex() : { index: 0, untilMs: 0 }), [now]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  async function submit() {
    const surah = Number(form.surah);
    const fromAyah = Number(form.fromAyah);
    const toAyah = Number(form.toAyah);
    if (!surah || surah < 1 || surah > 114) {
      toast.error("اختر سورة صحيحة (1-114)");
      return;
    }
    if (!fromAyah || !toAyah || toAyah < fromAyah) {
      toast.error("آية البداية والنهاية غير صحيحة");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        surah,
        fromAyah,
        toAyah,
        juz: form.juz ? Number(form.juz) : null,
        note: form.note.trim() || null,
      };
      const res = await fetch("/api/quran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الإضافة");
      toast.success("تم تسجيل القراءة");
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
      const res = await fetch(`/api/quran?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف السجل");
      setDeleteId(null);
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
          <h1 className="text-xl font-bold tracking-tight">القسم الإسلامي</h1>
          <p className="text-sm text-muted-foreground">قرآن، أذكار، ومواقيت الصلاة</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="size-4" />
          تحديث
        </Button>
      </div>

      {/* date banner */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-glow/15 to-amber-glow/10 p-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex size-11 items-center justify-center rounded-full bg-emerald-glow/15 text-emerald-glow shrink-0">
              <CalendarHeart className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">التاريخ الهجري</div>
              <div className="text-lg font-bold">{now ? getHijriDate(now) : "—"}</div>
              <div className="text-xs text-muted-foreground">{now ? getGregorianDateAr(now) : "—"}</div>
            </div>
          </div>
        </div>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل البيانات</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_320px] flex-1 min-h-0">
        {/* left: quran log */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* quran stats */}
          <div className="grid grid-cols-3 gap-1.5">
            <StatCard icon={BookOpen} label="آيات مقروءة" value={String(stats.totalAyahs)} accent="emerald" />
            <StatCard icon={Star} label="سور مفتوحة" value={String(stats.surahsRead)} accent="amber" />
            <StatCard icon={Sparkles} label="جلسات القراءة" value={String(stats.sessions)} accent="emerald" />
          </div>

          <Card className="flex flex-col flex-1 min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-emerald-glow" />
                سجل القراءة
                <Button size="sm" className="mr-auto h-7" onClick={openAdd}>
                  <Plus className="size-3.5" />
                  تسجيل قراءة
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="custom-scroll h-full max-h-[60vh] -mx-1 px-1">
                {loading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                  </div>
                ) : logs.length > 0 ? (
                  <div className="flex flex-col gap-2 pb-4">
                    {logs.map((l) => {
                      const surahName = surahNames[l.surah - 1] || `سورة ${l.surah}`;
                      const ayahCount = l.toAyah - l.fromAyah + 1;
                      return (
                        <Card key={l.id} className="group">
                          <CardContent className="flex items-center gap-2 p-2">
                            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-glow/10 text-emerald-glow shrink-0">
                              <BookOpen className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold">{surahName}</span>
                                <Badge variant="secondary" className="text-[10px]">آية {l.fromAyah} - {l.toAyah}</Badge>
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <Sparkles className="size-2.5" />
                                  {ayahCount} آية
                                </Badge>
                                {l.juz ? <Badge variant="outline" className="text-[10px]">جزء {l.juz}</Badge> : null}
                              </div>
                              {l.note ? (
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{l.note}</div>
                              ) : null}
                              <div className="text-[10px] text-muted-foreground mt-0.5">{formatDate(l.date)}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => setDeleteId(l.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <BookOpen className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">لا سجلات قراءة</p>
                    <p className="text-xs text-muted-foreground">ابدأ بتسجيل أول جلسة قراءة</p>
                    <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
                      <Plus className="size-4" />
                      تسجيل قراءة
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* right: prayer times + dhikr */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* prayer times */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-emerald-glow" />
                مواقيت الصلاة
                <Badge variant="outline" className="text-[10px] mr-auto">حلب</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {PRAYER_TIMES.map((p, i) => {
                const isNext = i === nextPrayer.index;
                const Icon = p.icon;
                return (
                  <div
                    key={p.key}
                    className={`flex items-center gap-2 rounded-lg p-2 ${
                      isNext ? "bg-emerald-glow/10 border border-emerald-glow/30" : ""
                    }`}
                  >
                    <div className={`flex size-9 items-center justify-center rounded-md shrink-0 ${
                      isNext ? "bg-emerald-glow/20 text-emerald-glow" : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isNext ? "text-emerald-glow" : ""}`}>{p.name}</div>
                      {isNext ? (
                        <div className="text-[10px] text-emerald-glow">بعد {formatCountdown(nextPrayer.untilMs)}</div>
                      ) : null}
                    </div>
                    <div
                      dir="ltr"
                      className={`text-sm font-bold tabular-nums ${isNext ? "text-emerald-glow" : ""}`}
                    >
                      {pad2(p.hour)}:{pad2(p.minute)}
                    </div>
                  </div>
                );
              })}
              {weather?.forecast?.[0] ? (
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sunrise className="size-3" />
                    {new Date(weather.forecast[0].sunrise).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Sunset className="size-3" />
                    {new Date(weather.forecast[0].sunset).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span>{weather.current.temperature}°</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* daily dhikr */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-amber-glow" />
                ذكر اليوم
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-gradient-to-l from-amber-glow/10 to-emerald-glow/10 p-2 text-center">
                <p className="text-lg font-arabic leading-relaxed" style={{ fontFamily: "var(--font-arabic, inherit)" }}>
                  {todaysDhikr.ar}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{todaysDhikr.count}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{todaysDhikr.virtue}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* add reading dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل قراءة</DialogTitle>
            <DialogDescription>سجّل جلسة تلاوتك اليومية.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label>السورة *</Label>
              <Select value={form.surah} onValueChange={(v) => setForm((f) => ({ ...f, surah: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {surahNames.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {i + 1}. {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="q-from">من آية *</Label>
                <Input
                  id="q-from"
                  type="number"
                  min={1}
                  value={form.fromAyah}
                  onChange={(e) => setForm((f) => ({ ...f, fromAyah: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="q-to">إلى آية *</Label>
                <Input
                  id="q-to"
                  type="number"
                  min={1}
                  value={form.toAyah}
                  onChange={(e) => setForm((f) => ({ ...f, toAyah: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="q-juz">الجزء (اختياري)</Label>
              <Input
                id="q-juz"
                type="number"
                min={1}
                max={30}
                value={form.juz}
                onChange={(e) => setForm((f) => ({ ...f, juz: e.target.value }))}
                placeholder="1 - 30"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="q-note">ملاحظة</Label>
              <Textarea
                id="q-note"
                rows={2}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="خواطر أو تدبر..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "تسجيل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف سجل القراءة نهائياً.</AlertDialogDescription>
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
  value: string;
  accent: "emerald" | "amber";
}) {
  const accentClass = accent === "emerald" ? "text-emerald-glow bg-emerald-glow/10" : "text-amber-glow bg-amber-glow/10";
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
