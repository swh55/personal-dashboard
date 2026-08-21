"use client";

import * as React from "react";
import {
  RefreshCw,
  CircleAlert,
  User,
  Shield,
  Palette,
  Database,
  Info,
  Sun,
  Moon,
  Check,
  Download,
  Trash2,
  Lock,
  Smartphone,
  Github,
  Heart,
  MapPin,
  Locate,
  DollarSign,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAppSettings } from "@/hooks/use-app-settings";
import { toast } from "@/lib/api";
import { getCurrentLocation, isNative } from "@/lib/native/bridge";
import { clearDemoData, hasDemoData } from "@/hooks/use-first-run";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const TIMEZONES = [
  { value: "Asia/Damascus", label: "دمشق (سوريا)" },
  { value: "Asia/Riyadh", label: "الرياض (السعودية)" },
  { value: "Africa/Cairo", label: "القاهرة (مصر)" },
  { value: "Asia/Beirut", label: "بيروت (لبنان)" },
  { value: "Asia/Amman", label: "عمّان (الأردن)" },
  { value: "Asia/Baghdad", label: "بغداد (العراق)" },
  { value: "Asia/Kuwait", label: "الكويت" },
  { value: "Asia/Qatar", label: "الدوحة (قطر)" },
  { value: "Asia/Dubai", label: "دبي (الإمارات)" },
  { value: "Europe/Istanbul", label: "إسطنبول (تركيا)" },
  { value: "Asia/Jerusalem", label: "القدس" },
  { value: "Asia/Tehran", label: "طهران (إيران)" },
  { value: "UTC", label: "UTC (عالمي)" },
];

const AI_MODELS = [
  { value: "glm-4.5", label: "GLM-4.5 (الأحدث والأذكى)" },
  { value: "glm-4.5-flash", label: "GLM-4.5-Flash (موصى به)" },
  { value: "glm-4-plus", label: "GLM-4-Plus" },
  { value: "glm-4-air", label: "GLM-4-Air (سريع)" },
  { value: "glm-4-flashx", label: "GLM-4-FlashX" },
  { value: "glm-4-long", label: "GLM-4-Long (سياق طويل)" },
];

const ACCENTS = [
  { value: "emerald", label: "زمردي", color: "oklch(0.78 0.18 152)" },
  { value: "amber", label: "كهرماني", color: "oklch(0.82 0.16 75)" },
  { value: "rose", label: "وردي", color: "oklch(0.65 0.22 15)" },
  { value: "blue", label: "أزرق", color: "oklch(0.62 0.19 250)" },
  { value: "violet", label: "بنفسجي", color: "oklch(0.6 0.22 295)" },
];

const APP_VERSION = "1.0.0";

export function SettingsSection() {
  const {
    settings,
    setUsername,
    setTheme: setStoreTheme,
    setAccent,
    setPinEnabled,
    setPinCode,
    setCity,
    setLat,
    setLng,
    setTimezone,
    setExchangeRate,
    setAiApiKey,
    setAiModel,
    setAiBaseUrl,
  } = useAppSettings();
  const { theme: renderedTheme, setTheme: setRenderedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // local input states
  const [usernameInput, setUsernameInput] = React.useState(settings.username);
  const [pinInput, setPinInput] = React.useState(settings.pinCode || "");
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingPin, setSavingPin] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [demoStatus, setDemoStatus] = React.useState<"present" | "absent" | "checking">("checking");
  const [demoClearing, setDemoClearing] = React.useState(false);

  // Check if demo data exists on mount
  React.useEffect(() => {
    setDemoStatus(hasDemoData() ? "present" : "absent");
  }, []);

  // Location inputs
  const [cityInput, setCityInput] = React.useState(settings.city);
  const [latInput, setLatInput] = React.useState(String(settings.lat));
  const [lngInput, setLngInput] = React.useState(String(settings.lng));
  const [timezoneInput, setTimezoneInput] = React.useState(settings.timezone);
  const [savingLocation, setSavingLocation] = React.useState(false);
  const [locating, setLocating] = React.useState(false);

  // Exchange rate input
  const [rateInput, setRateInput] = React.useState(String(settings.exchangeRate));
  const [savingRate, setSavingRate] = React.useState(false);

  // AI API inputs
  const [aiKeyInput, setAiKeyInput] = React.useState(settings.aiApiKey);
  const [aiModelInput, setAiModelInput] = React.useState(settings.aiModel);
  const [aiBaseUrlInput, setAiBaseUrlInput] = React.useState(settings.aiBaseUrl);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [savingAi, setSavingAi] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // sync local inputs whenever store updates
  React.useEffect(() => {
    setUsernameInput(settings.username);
  }, [settings.username]);
  React.useEffect(() => {
    setPinInput(settings.pinCode || "");
  }, [settings.pinCode]);
  React.useEffect(() => {
    setCityInput(settings.city);
    setLatInput(String(settings.lat));
    setLngInput(String(settings.lng));
    setTimezoneInput(settings.timezone);
  }, [settings.city, settings.lat, settings.lng, settings.timezone]);
  React.useEffect(() => {
    setRateInput(String(settings.exchangeRate));
  }, [settings.exchangeRate]);
  React.useEffect(() => {
    setAiKeyInput(settings.aiApiKey);
    setAiModelInput(settings.aiModel);
    setAiBaseUrlInput(settings.aiBaseUrl);
  }, [settings.aiApiKey, settings.aiModel, settings.aiBaseUrl]);

  async function persistAppearance(payload: Record<string, any>) {
    try {
      const res = await fetch("/api/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      return true;
    } catch (e: any) {
      toast.error(e.message || "فشل الحفظ على الخادم");
      return false;
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setUsername(usernameInput.trim() || "");
    const ok = await persistAppearance({ username: usernameInput.trim() || "" });
    if (ok) toast.success("تم حفظ اسم المستخدم");
    setSavingProfile(false);
  }

  async function togglePin(enabled: boolean) {
    setPinEnabled(enabled);
    if (!enabled) {
      // clear pin
      setPinCode(null);
      setPinInput("");
      const ok = await persistAppearance({ pinEnabled: false, pinCode: "" });
      if (ok) toast.success("تم إيقاف قفل PIN");
    } else {
      const ok = await persistAppearance({ pinEnabled: true });
      if (ok) toast.success("تم تفعيل قفل PIN — أدخل رمزاً من 4 أرقام");
    }
  }

  async function savePin() {
    const cleaned = pinInput.replace(/\D/g, "");
    if (cleaned.length !== 4) {
      toast.error("الرمز يجب أن يكون 4 أرقام");
      return;
    }
    setSavingPin(true);
    setPinCode(cleaned);
    const ok = await persistAppearance({ pinCode: cleaned });
    if (ok) toast.success("تم حفظ الرمز");
    setSavingPin(false);
  }

  async function changeTheme(t: "dark" | "light") {
    setStoreTheme(t);
    setRenderedTheme(t);
    await persistAppearance({ theme: t });
    toast.success(t === "dark" ? "الوضع الليلي" : "الوضع النهاري");
  }

  async function changeAccent(a: string) {
    setAccent(a);
    await persistAppearance({ accent: a });
    toast.success("تم تغيير اللون المميز");
  }

  async function saveLocation() {
    setSavingLocation(true);
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error("الإحداثيات غير صالحة");
      setSavingLocation(false);
      return;
    }
    const city = cityInput.trim() || "حلب";
    const tz = timezoneInput || "Asia/Damascus";
    setCity(city);
    setLat(lat);
    setLng(lng);
    setTimezone(tz);
    const ok = await persistAppearance({
      city,
      lat,
      lng,
      timezone: tz,
    });
    if (ok) toast.success("تم حفظ إعدادات الموقع");
    setSavingLocation(false);
  }

  async function useGpsLocation() {
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      if (!loc) {
        toast.error("تعذر الحصول على موقعك — تحقق من صلاحية GPS");
        return;
      }
      setLatInput(String(loc.latitude.toFixed(4)));
      setLngInput(String(loc.longitude.toFixed(4)));
      toast.success("تم تحديد إحداثيات موقعك الحالي");
    } catch (e: any) {
      toast.error(e?.message || "خطأ في تحديد الموقع");
    } finally {
      setLocating(false);
    }
  }

  async function saveExchangeRate() {
    setSavingRate(true);
    const rate = parseFloat(rateInput);
    if (Number.isNaN(rate) || rate <= 0) {
      toast.error("سعر الصرف غير صالح");
      setSavingRate(false);
      return;
    }
    setExchangeRate(rate);
    const ok = await persistAppearance({ exchangeRate: rate });
    if (ok) toast.success("تم حفظ سعر الصرف");
    setSavingRate(false);
  }

  async function saveAi() {
    setSavingAi(true);
    const key = aiKeyInput.trim();
    const model = aiModelInput || "glm-4-flash";
    const baseUrl = aiBaseUrlInput.trim();
    setAiApiKey(key);
    setAiModel(model);
    setAiBaseUrl(baseUrl);
    const ok = await persistAppearance({
      aiApiKey: key,
      aiModel: model,
      aiBaseUrl: baseUrl,
    });
    if (ok) toast.success("تم حفظ إعدادات الذكاء الاصطناعي");
    setSavingAi(false);
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/sync/drive", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "فشل التصدير");
      }
      const stats = json.data?.stats;
      toast.success(
        `تم إنشاء نسخة احتياطية (${json.data?.filename || ""})` +
        (stats ? ` — ${stats.tasks ?? 0} مهمة، ${stats.contacts ?? 0} جهة اتصال` : "")
      );
    } catch (e: any) {
      toast.error(e.message || "فشل التصدير");
    } finally {
      setExporting(false);
    }
  }

  async function clearActivity() {
    setClearing(true);
    try {
      // Delete all (no "before" filter — older than now = everything)
      const res = await fetch(`/api/activity?before=${new Date().toISOString()}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل المسح");
      toast.success("تم مسح كل سجل النشاط");
      setClearOpen(false);
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    } finally {
      setClearing(false);
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-full flex-col gap-1">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight">الإعدادات</h1>
          <p className="text-sm text-muted-foreground">الملف الشخصي، الأمان، المظهر، والبيانات</p>
        </div>
      </div>

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        <div className="flex flex-col gap-1 pb-4 max-w-3xl">

          {/* User profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <User className="size-4 text-emerald-glow" />
                الملف الشخصي
              </CardTitle>
              <CardDescription className="text-xs">معلومات المستخدم الأساسية</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-glow to-amber-glow text-background font-bold text-lg shrink-0">
                  {(usernameInput || "ع").charAt(0)}
                </div>
                <div className="flex-1 grid gap-1.5">
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="اسمك"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "جارٍ الحفظ..." : "حفظ"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <Shield className="size-4 text-emerald-glow" />
                الأمان
              </CardTitle>
              <CardDescription className="text-xs">قفل التطبيق برمز PIN</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center justify-between rounded-lg border p-2">
                <div className="flex items-start gap-1">
                  <Lock className="size-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">قفل PIN</div>
                    <div className="text-xs text-muted-foreground">
                      طلب رمز مكون من 4 أرقام عند فتح التطبيق
                    </div>
                  </div>
                </div>
                <Switch checked={settings.pinEnabled} onCheckedChange={togglePin} />
              </div>

              {settings.pinEnabled ? (
                <div className="rounded-lg border border-emerald-glow/30 bg-emerald-glow/5 p-2">
                  <Label htmlFor="pin" className="text-sm">
                    رمز PIN (4 أرقام)
                  </Label>
                  <div className="mt-2 flex items-center gap-1">
                    <Input
                      id="pin"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      dir="ltr"
                      className="text-center tracking-[0.5em] max-w-32"
                    />
                    <Button size="sm" onClick={savePin} disabled={savingPin || pinInput.length !== 4}>
                      {savingPin ? "جارٍ..." : "حفظ الرمز"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <Smartphone className="size-3 inline ms-1" />
                    سيُطلب الرمز في المرة القادمة عند فتح التطبيق
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <Palette className="size-4 text-emerald-glow" />
                المظهر
              </CardTitle>
              <CardDescription className="text-xs">السمة واللون المميز</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="grid gap-1">
                <Label>السمة</Label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => changeTheme("dark")}
                    className={`flex items-center gap-1 rounded-lg border p-2 text-start transition ${renderedTheme === "dark" ? "border-emerald-glow bg-emerald-glow/5" : "border-border hover:bg-muted"}`}
                  >
                    <Moon className={`size-5 ${renderedTheme === "dark" ? "text-emerald-glow" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">ليلي</div>
                      <div className="text-[10px] text-muted-foreground">خلفية داكنة</div>
                    </div>
                    {renderedTheme === "dark" ? <Check className="size-4 text-emerald-glow" /> : null}
                  </button>
                  <button
                    onClick={() => changeTheme("light")}
                    className={`flex items-center gap-1 rounded-lg border p-2 text-start transition ${renderedTheme === "light" ? "border-emerald-glow bg-emerald-glow/5" : "border-border hover:bg-muted"}`}
                  >
                    <Sun className={`size-5 ${renderedTheme === "light" ? "text-emerald-glow" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">نهاري</div>
                      <div className="text-[10px] text-muted-foreground">خلفية فاتحة</div>
                    </div>
                    {renderedTheme === "light" ? <Check className="size-4 text-emerald-glow" /> : null}
                  </button>
                </div>
              </div>

              <Separator />

              <div className="grid gap-1">
                <Label>اللون المميز</Label>
                <div className="flex flex-wrap gap-1">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => changeAccent(a.value)}
                      className={`relative flex items-center gap-1 rounded-lg border p-2 pe-3 transition ${settings.accent === a.value ? "border-foreground/40 bg-muted" : "border-border hover:bg-muted"}`}
                      aria-label={a.label}
                    >
                      <span
                        className="size-6 rounded-full"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="text-sm">{a.label}</span>
                      {settings.accent === a.value ? <Check className="size-4 text-emerald-glow" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <MapPin className="size-4 text-emerald-glow" />
                الموقع
              </CardTitle>
              <CardDescription className="text-xs">
                المدينة والإحداثيات والمنطقة الزمنية — تُستخدم للطقس والتقويم
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="grid gap-1.5">
                <Label htmlFor="city">المدينة</Label>
                <Input
                  id="city"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="حلب"
                />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="grid gap-1.5">
                  <Label htmlFor="lat">خط العرض (Latitude)</Label>
                  <Input
                    id="lat"
                    inputMode="decimal"
                    dir="ltr"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    placeholder="36.2021"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lng">خط الطول (Longitude)</Label>
                  <Input
                    id="lng"
                    inputMode="decimal"
                    dir="ltr"
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                    placeholder="37.1343"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>المنطقة الزمنية</Label>
                <Select value={timezoneInput} onValueChange={setTimezoneInput}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={useGpsLocation}
                  disabled={locating}
                >
                  {locating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Locate className="size-4" />
                  )}
                  استخدام موقعي الحالي
                </Button>
                <Button size="sm" onClick={saveLocation} disabled={savingLocation}>
                  {savingLocation ? "جارٍ الحفظ..." : "حفظ"}
                </Button>
              </div>
              {!isNative() ? (
                <p className="text-[10px] text-muted-foreground">
                  💡 GPS يعتمد على متصفحك. على الهاتف، يستخدم GPS الجهاز.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* Exchange Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <DollarSign className="size-4 text-emerald-glow" />
                سعر الصرف
              </CardTitle>
              <CardDescription className="text-xs">
                سعر صرف الدولار مقابل الليرة السورية — يُستخدم في القسم المالي
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="grid gap-1.5">
                <Label htmlFor="rate">1 دولار = ? ليرة سورية</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="rate"
                    inputMode="numeric"
                    dir="ltr"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="12500"
                    className="text-start"
                  />
                  <Badge variant="secondary" className="shrink-0">ل.س</Badge>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveExchangeRate} disabled={savingRate}>
                  {savingRate ? "جارٍ الحفظ..." : "حفظ"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <Sparkles className="size-4 text-emerald-glow" />
                إعدادات الذكاء الاصطناعي
              </CardTitle>
              <CardDescription className="text-xs">
                مفتاح API للمساعد الذكي — يُستخدم في المساعد والاقتراحات الذكية
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-key">مفتاح API</Label>
                <div className="relative">
                  <Input
                    id="ai-key"
                    type={showApiKey ? "text" : "password"}
                    dir="ltr"
                    value={aiKeyInput}
                    onChange={(e) => setAiKeyInput(e.target.value)}
                    placeholder="••••••••••••••••••••••••"
                    className="pe-10 text-start"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((s) => !s)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    aria-label={showApiKey ? "إخفاء المفتاح" : "إظهار المفتاح"}
                  >
                    {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  احصل على مفتاحك من منصة Z.ai (z.ai). يُحفظ محلياً وفي قاعدة البيانات فقط.
                </p>
              </div>
              <Separator />
              <div className="grid gap-1.5">
                <Label>النموذج</Label>
                <Select value={aiModelInput} onValueChange={setAiModelInput}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-baseurl">عنوان API (اختياري)</Label>
                <Input
                  id="ai-baseurl"
                  dir="ltr"
                  value={aiBaseUrlInput}
                  onChange={(e) => setAiBaseUrlInput(e.target.value)}
                  placeholder="https://api.z.ai/api/paas/v4"
                  className="text-start"
                />
                <p className="text-[10px] text-muted-foreground">
                  اتركه فارغاً لاستخدام العنوان الافتراضي. مفيد لنقاط نهاية مخصصة.
                </p>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveAi} disabled={savingAi}>
                  {savingAi ? "جارٍ الحفظ..." : "حفظ"}
                </Button>
              </div>
              {!settings.aiApiKey ? (
                <div className="rounded-lg border border-amber-glow/30 bg-amber-glow/5 p-2 text-xs">
                  ⚠️ لم يتم ضبط مفتاح API. المساعد الذكي سيطلب منك الإعداد قبل العمل.
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <Database className="size-4 text-emerald-glow" />
                البيانات
              </CardTitle>
              <CardDescription className="text-xs">النسخ الاحتياطي وإدارة السجل</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-1 rounded-lg border p-2">
                <div className="flex items-start gap-1 min-w-0">
                  <Download className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">تصدير نسخة احتياطية</div>
                    <div className="text-xs text-muted-foreground truncate">
                      رفع نسخة إلى Google Drive (يتطلب ربط الحساب)
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={exportData} disabled={exporting}>
                  {exporting ? "جارٍ..." : "تصدير"}
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-1 rounded-lg border border-destructive/30 p-2">
                <div className="flex items-start gap-1 min-w-0">
                  <Trash2 className="size-5 text-destructive mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">مسح سجل النشاط</div>
                    <div className="text-xs text-muted-foreground truncate">
                      حذف جميع سجلات النشاط نهائياً
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => setClearOpen(true)}>
                  مسح
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <Info className="size-4 text-emerald-glow" />
                حول التطبيق
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الاسم</span>
                <span className="font-medium">لوحة التحكم الشخصية</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الإصدار</span>
                <Badge variant="secondary">v{APP_VERSION}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">التقنيات</span>
                <span className="font-medium">Next.js 16 · Prisma · SQLite</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المنصة</span>
                <span className="font-medium">عربي · RTL</span>
              </div>
              <Separator />
              <div className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
                <Heart className="size-3 text-rose-500" />
                صُنع بعناية
                <Github className="size-3 me-1" />
              </div>
            </CardContent>
          </Card>

          {/* Demo Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-base">
                <Database className="size-4 text-amber-glow" />
                إدارة البيانات التجريبية
              </CardTitle>
              <CardDescription className="text-xs">
                البيانات التجريبية تساعدك على استكشاف الموقع. يمكنك حذفها متى شئت مع الحفاظ على بياناتك الحقيقية.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {demoStatus === "present" ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg bg-amber-glow/10 p-2 text-sm text-amber-glow">
                    <Sparkles className="size-4" />
                    البيانات التجريبية مفعّلة حالياً
                  </div>
                  <Button
                    variant="outline"
                    className="border-amber-glow/40 text-amber-glow hover:bg-amber-glow/10"
                    disabled={demoClearing}
                    onClick={() => {
                      setDemoClearing(true);
                      setTimeout(() => {
                        const result = clearDemoData();
                        setDemoClearing(false);
                        setDemoStatus("absent");
                        toast.success(`تم حذف ${result.cleared} عنصراً تجريبياً. بقيت ${result.remaining} من بياناتك الحقيقية.`);
                        setTimeout(() => window.location.reload(), 600);
                      }, 100);
                    }}
                  >
                    <Trash2 className="ms-1 size-4" />
                    {demoClearing ? "جارٍ المسح..." : "مسح البيانات التجريبية فقط"}
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2 text-sm text-muted-foreground">
                  <Check className="size-4 text-emerald-glow" />
                  لا توجد بيانات تجريبية — الموقع جاهز لبياناتك الحقيقية
                </div>
              )}
              <p className="text-[11px] text-muted-foreground pt-1">
                ملاحظة: المسح يحذف فقط العناصر ذات المعرّف <code className="font-mono">demo-*</code> ولا يمسّ أي بيانات أضفتها بنفسك.
              </p>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>

      {/* clear activity confirm */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مسح سجل النشاط</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع سجلات النشاط نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); clearActivity(); }}
              disabled={clearing}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {clearing ? "جارٍ..." : "مسح الكل"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
