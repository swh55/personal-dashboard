"use client";

import * as React from "react";
import {
  Sun,
  Moon,
  Check,
  Palette,
  Type,
  Eye,
  RefreshCw,
  CircleAlert,
  Layers,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAppSettings } from "@/hooks/use-app-settings";
import { toast } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const ACCENTS = [
  { value: "emerald", label: "زمردي", color: "oklch(0.78 0.18 152)" },
  { value: "amber", label: "كهرماني", color: "oklch(0.82 0.16 75)" },
  { value: "rose", label: "وردي", color: "oklch(0.65 0.22 15)" },
  { value: "blue", label: "أزرق", color: "oklch(0.62 0.19 250)" },
  { value: "violet", label: "بنفسجي", color: "oklch(0.6 0.22 295)" },
  { value: "slate", label: "رمادي", color: "oklch(0.55 0.02 250)" },
] as const;

const PREVIEW_TEXT = "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ — مثال على نص عربي بخط القاهرة";

export function AppearanceSection() {
  const { settings, setTheme: setStoreTheme, setAccent, setUsername } = useAppSettings();
  const { theme: renderedTheme, setTheme: setRenderedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [usernameInput, setUsernameInput] = React.useState(settings.username);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setUsernameInput(settings.username);
  }, [settings.username]);

  async function persistAppearance(payload: Record<string, unknown>) {
    setPending(true);
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
    } finally {
      setPending(false);
    }
  }

  async function changeTheme(t: "dark" | "light") {
    setStoreTheme(t);
    setRenderedTheme(t);
    const ok = await persistAppearance({ theme: t });
    if (ok) toast.success(t === "dark" ? "تم اختيار الوضع الليلي" : "تم اختيار الوضع النهاري");
  }

  async function changeAccent(a: string) {
    setAccent(a);
    const ok = await persistAppearance({ accent: a });
    if (ok) toast.success("تم تغيير اللون المميز");
  }

  async function saveProfile() {
    setSavingProfile(true);
    const name = usernameInput.trim() || "عبد الله";
    setUsername(name);
    const ok = await persistAppearance({ username: name });
    if (ok) toast.success("تم حفظ اسم المستخدم");
    setSavingProfile(false);
  }

  const currentAccent = ACCENTS.find((a) => a.value === settings.accent) || ACCENTS[0];

  if (!mounted) {
    return (
      <div className="flex h-full flex-col gap-4">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const previewAccentStyle = { "--primary": currentAccent.color } as React.CSSProperties;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">المظهر</h2>
          <p className="text-sm text-muted-foreground">
            خصّص شكل التطبيق — السمة، اللون المميز، والخط
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setStoreTheme("dark");
            setAccent("emerald");
            setRenderedTheme("dark");
            persistAppearance({ theme: "dark", accent: "emerald" }).then((ok) => {
              if (ok) toast.success("تمت استعادة الإعدادات الافتراضية");
            });
          }}
          disabled={pending}
        >
          <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
          <span className="hidden sm:inline">استعادة الافتراضي</span>
        </Button>
      </header>

      <ScrollArea className="custom-scroll flex-1 min-h-0 -mx-1 px-1">
        <div className="flex flex-col gap-4 pb-4 max-w-3xl">

          {/* Theme section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4 text-emerald-glow" />
                السمة
              </CardTitle>
              <CardDescription className="text-xs">اختر بين الوضع الليلي والنهاري</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => changeTheme("dark")}
                  className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-right transition ${renderedTheme === "dark" ? "border-emerald-glow bg-emerald-glow/5 shadow-sm" : "border-border hover:bg-muted"}`}
                  aria-pressed={renderedTheme === "dark"}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-slate-900 border border-slate-700">
                      <Moon className={`size-5 ${renderedTheme === "dark" ? "text-emerald-glow" : "text-slate-400"}`} />
                    </div>
                    {renderedTheme === "dark" ? <Check className="size-5 text-emerald-glow" /> : null}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">ليلي</div>
                    <div className="text-[11px] text-muted-foreground">خلفية داكنة، نص فاتح</div>
                  </div>
                </button>
                <button
                  onClick={() => changeTheme("light")}
                  className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-right transition ${renderedTheme === "light" ? "border-emerald-glow bg-emerald-glow/5 shadow-sm" : "border-border hover:bg-muted"}`}
                  aria-pressed={renderedTheme === "light"}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 border border-amber-200">
                      <Sun className={`size-5 ${renderedTheme === "light" ? "text-emerald-glow" : "text-amber-500"}`} />
                    </div>
                    {renderedTheme === "light" ? <Check className="size-5 text-emerald-glow" /> : null}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">نهاري</div>
                    <div className="text-[11px] text-muted-foreground">خلفية فاتحة، نص داكن</div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Accent color section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-4 text-emerald-glow" />
                اللون المميز
              </CardTitle>
              <CardDescription className="text-xs">اللون المستخدم في الأزرار والروابط والعناصر المميزة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {ACCENTS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => changeAccent(a.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition ${settings.accent === a.value ? "border-foreground/40 bg-muted shadow-sm" : "border-border hover:bg-muted"}`}
                    aria-pressed={settings.accent === a.value}
                    aria-label={a.label}
                  >
                    <span
                      className="size-7 rounded-full ring-2 ring-offset-2 ring-offset-background"
                      style={{
                        backgroundColor: a.color,
                        boxShadow: settings.accent === a.value ? `0 0 0 2px ${a.color}` : undefined,
                      }}
                    />
                    {settings.accent === a.value ? (
                      <Check className="size-3.5 text-emerald-glow" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{a.label}</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                اللون الحالي: <span className="font-medium" style={{ color: currentAccent.color }}>{currentAccent.label}</span>
              </p>
            </CardContent>
          </Card>

          {/* Font preview section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Type className="size-4 text-emerald-glow" />
                معاينة الخط
              </CardTitle>
              <CardDescription className="text-xs">يستخدم التطبيق خط القاهرة العربي</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="font-arabic text-base leading-relaxed">{PREVIEW_TEXT}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ap-username">اسم المستخدم</Label>
                <div className="flex gap-2">
                  <Input
                    id="ap-username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="اسمك"
                    className="font-arabic"
                  />
                  <Button onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile ? "جارٍ..." : "حفظ"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live preview card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="size-4 text-emerald-glow" />
                معاينة حيّة
              </CardTitle>
              <CardDescription className="text-xs">شكل البطاقات والأزرار بالسمة واللون الحالي</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-xl border bg-card p-4 flex flex-col gap-3"
                style={previewAccentStyle}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">عنوان البطاقة</div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      هذه بطاقة تجريبية لمعاينة الشكل النهائي بعد تطبيق الإعدادات.
                    </p>
                  </div>
                  <Badge style={{ backgroundColor: "var(--primary)", color: "white" }}>جديد</Badge>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" style={{ backgroundColor: "var(--primary)", color: "white" }}>
                    زر أساسي
                  </Button>
                  <Button size="sm" variant="outline">
                    زر ثانوي
                  </Button>
                  <Button size="sm" variant="ghost">
                    زر شبحي
                  </Button>
                  <Badge variant="outline" style={{ color: "var(--primary)", borderColor: "var(--primary)" }}>
                    مميز
                  </Badge>
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: "var(--primary)" }}
                  >
                    <Check className="size-3.5" />
                    نص مميز
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden bg-muted"
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: "62%", backgroundColor: "var(--primary)" }}
                  />
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                ملاحظة: تُحفظ الإعدادات محلياً وعلى الخادم، ويُطبَّق اللون المميز داخل هذه المعاينة فقط كاستعراض.
              </p>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
    </div>
  );
}
