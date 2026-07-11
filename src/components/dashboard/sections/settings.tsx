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
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAppSettings } from "@/hooks/use-app-settings";
import { toast } from "@/lib/api";
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

const ACCENTS = [
  { value: "emerald", label: "زمردي", color: "oklch(0.78 0.18 152)" },
  { value: "amber", label: "كهرماني", color: "oklch(0.82 0.16 75)" },
  { value: "rose", label: "وردي", color: "oklch(0.65 0.22 15)" },
  { value: "blue", label: "أزرق", color: "oklch(0.62 0.19 250)" },
  { value: "violet", label: "بنفسجي", color: "oklch(0.6 0.22 295)" },
];

const APP_VERSION = "1.0.0";

export function SettingsSection() {
  const { settings, setUsername, setTheme: setStoreTheme, setAccent, setPinEnabled, setPinCode } = useAppSettings();
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
    setUsername(usernameInput.trim() || "عبد الله");
    const ok = await persistAppearance({ username: usernameInput.trim() || "عبد الله" });
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
      <div className="flex h-full flex-col gap-2">
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
    <div className="flex h-full flex-col gap-2">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">الإعدادات</h1>
          <p className="text-sm text-muted-foreground">الملف الشخصي، الأمان، المظهر، والبيانات</p>
        </div>
      </div>

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        <div className="flex flex-col gap-2 pb-4 max-w-3xl">

          {/* User profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4 text-emerald-glow" />
                الملف الشخصي
              </CardTitle>
              <CardDescription className="text-xs">معلومات المستخدم الأساسية</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-glow to-amber-glow text-background font-bold text-xl shrink-0">
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
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4 text-emerald-glow" />
                الأمان
              </CardTitle>
              <CardDescription className="text-xs">قفل التطبيق برمز PIN</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border p-2">
                <div className="flex items-start gap-2">
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
                  <div className="mt-2 flex items-center gap-2">
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
                    <Smartphone className="size-3 inline ml-1" />
                    سيُطلب الرمز في المرة القادمة عند فتح التطبيق
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-4 text-emerald-glow" />
                المظهر
              </CardTitle>
              <CardDescription className="text-xs">السمة واللون المميز</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="grid gap-2">
                <Label>السمة</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => changeTheme("dark")}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-right transition ${renderedTheme === "dark" ? "border-emerald-glow bg-emerald-glow/5" : "border-border hover:bg-muted"}`}
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
                    className={`flex items-center gap-2 rounded-lg border p-2 text-right transition ${renderedTheme === "light" ? "border-emerald-glow bg-emerald-glow/5" : "border-border hover:bg-muted"}`}
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

              <div className="grid gap-2">
                <Label>اللون المميز</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => changeAccent(a.value)}
                      className={`relative flex items-center gap-2 rounded-lg border p-2 pr-3 transition ${settings.accent === a.value ? "border-foreground/40 bg-muted" : "border-border hover:bg-muted"}`}
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

          {/* Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4 text-emerald-glow" />
                البيانات
              </CardTitle>
              <CardDescription className="text-xs">النسخ الاحتياطي وإدارة السجل</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 rounded-lg border p-2">
                <div className="flex items-start gap-2 min-w-0">
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
              <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 p-2">
                <div className="flex items-start gap-2 min-w-0">
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
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="size-4 text-emerald-glow" />
                حول التطبيق
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
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
                <Github className="size-3 mr-1" />
              </div>
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
