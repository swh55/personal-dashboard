"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Zap,
  Clock,
  Calendar,
  CalendarClock,
  AlertOctagon,
  AlarmClock,
  Bell,
  Save,
  RefreshCcw,
  Mail,
  Inbox,
  Workflow,
  Power,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useApi, toast, timeAgo } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  config: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const TRIGGERS = [
  { value: "event_upcoming", label: "حدث قادم", icon: CalendarClock, cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "weekly", label: "أسبوعي", icon: Calendar, cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  { value: "budget_exceeded", label: "تجاوز الميزانية", icon: AlertOctagon, cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  { value: "hourly", label: "كل ساعة", icon: Clock, cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { value: "daily", label: "يومي", icon: AlarmClock, cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "task_overdue", label: "مهمة متأخرة", icon: AlertOctagon, cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
];

const ACTIONS = [
  { value: "notify", label: "إشعار", icon: Bell, cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "backup", label: "نسخ احتياطي", icon: Save, cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { value: "alert", label: "تنبيه", icon: AlertOctagon, cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { value: "email", label: "بريد إلكتروني", icon: Mail, cls: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  { value: "sync", label: "مزامنة", icon: RefreshCcw, cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
];

function triggerMeta(v: string) {
  return TRIGGERS.find((t) => t.value === v) || {
    value: v,
    label: v,
    icon: Zap,
    cls: "bg-muted text-muted-foreground",
  };
}

function actionMeta(v: string) {
  return ACTIONS.find((a) => a.value === v) || {
    value: v,
    label: v,
    icon: Zap,
    cls: "bg-muted text-muted-foreground",
  };
}

function tryParseConfig(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const EMPTY_FORM = {
  name: "",
  trigger: "daily",
  action: "notify",
  config: "",
  active: true,
};

export function AutomationSection() {
  const { data, loading, error, reload } = useApi<AutomationRule[]>(
    "/api/automation"
  );
  const rules = data || [];

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AutomationRule | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const stats = React.useMemo(
    () => ({
      total: rules.length,
      active: rules.filter((r) => r.active).length,
      inactive: rules.filter((r) => !r.active).length,
    }),
    [rules]
  );

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(r: AutomationRule) {
    setEditing(r);
    // Pretty-print config if valid JSON
    let cfg = "";
    if (r.config) {
      const parsed = tryParseConfig(r.config);
      cfg = parsed ? JSON.stringify(parsed, null, 2) : r.config;
    }
    setForm({
      name: r.name,
      trigger: r.trigger,
      action: r.action,
      config: cfg,
      active: r.active,
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    // Validate config JSON if provided
    let configValue: string | null = form.config.trim() || null;
    if (configValue) {
      try {
        // Normalize by parsing and re-stringifying
        configValue = JSON.stringify(JSON.parse(configValue));
      } catch {
        toast.error("صيغة JSON في الإعدادات غير صالحة");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        trigger: form.trigger,
        action: form.action,
        config: configValue,
        active: form.active,
      };
      const res = await fetch("/api/automation", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing ? { id: editing.id, ...payload } : payload
        ),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث القاعدة" : "تمت إضافة القاعدة");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(r: AutomationRule) {
    setTogglingId(r.id);
    try {
      const res = await fetch("/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, active: !r.active }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(r.active ? "تم إيقاف القاعدة" : "تم تفعيل القاعدة");
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل التحديث");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/automation?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف القاعدة");
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الحذف");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Workflow className="size-6 text-emerald-glow" />
            الأتمتة
          </h2>
          <p className="text-sm text-muted-foreground">
            قواعد تلقائية تنفّذ إجراءات عند تحقق شروط معيّنة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>إضافة قاعدة</span>
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="الإجمالي"
          value={stats.total}
          icon={<Workflow className="size-4" />}
          cls="text-emerald-glow bg-emerald-glow/10"
        />
        <StatCard
          label="نشطة"
          value={stats.active}
          icon={<Power className="size-4" />}
          cls="text-emerald-glow bg-emerald-glow/10"
        />
        <StatCard
          label="متوقفة"
          value={stats.inactive}
          icon={<Circle className="size-4" />}
          cls="text-muted-foreground bg-muted/40"
        />
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 custom-scroll -mx-1 px-1">
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertTitle>تعذّر تحميل قواعد الأتمتة</AlertTitle>
            <AlertDescription className="flex items-center gap-2">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : rules.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
                <Inbox className="size-7" />
              </div>
              <div>
                <p className="font-medium">لا توجد قواعد أتمتة</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  أنشئ قاعدة تُنفّذ إجراءً تلقائياً عند تحقق شرط
                </p>
              </div>
              <Button size="sm" onClick={openAdd}>
                <Plus className="size-4" />
                إضافة قاعدة
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rules.map((r) => {
              const tm = triggerMeta(r.trigger);
              const am = actionMeta(r.action);
              const TIcon = tm.icon;
              const AIcon = am.icon;
              const config = tryParseConfig(r.config);
              const isToggling = togglingId === r.id;
              return (
                <Card
                  key={r.id}
                  className={
                    "group border-border/60 transition-colors " +
                    (r.active
                      ? "hover:border-emerald-glow/40"
                      : "opacity-70 hover:opacity-100")
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          "flex size-10 shrink-0 items-center justify-center rounded-lg " +
                          (r.active
                            ? "bg-emerald-glow/15 text-emerald-glow"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {r.active ? (
                          <Zap className="size-5" />
                        ) : (
                          <Power className="size-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold leading-tight">
                            {r.name}
                          </h3>
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={r.active}
                              onCheckedChange={() => toggleActive(r)}
                              disabled={isToggling}
                              aria-label="تفعيل"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-emerald-glow opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => openEdit(r)}
                              aria-label="تعديل"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-rose-500 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => setDeleteId(r.id)}
                              aria-label="حذف"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={tm.cls}>
                            <TIcon className="size-3" />
                            {tm.label}
                          </Badge>
                          <span className="text-muted-foreground text-xs">←</span>
                          <Badge variant="outline" className={am.cls}>
                            <AIcon className="size-3" />
                            {am.label}
                          </Badge>
                          {r.active ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-glow/15 text-emerald-glow border-emerald-glow/30 gap-1"
                            >
                              <CheckCircle2 className="size-3" />
                              نشطة
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
                              <Circle className="size-3" />
                              متوقفة
                            </Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground mr-auto">
                            {timeAgo(r.updatedAt)}
                          </span>
                        </div>

                        {config && (
                          <pre
                            dir="ltr"
                            className="mt-2 max-h-24 overflow-auto custom-scroll rounded-md border border-border/60 bg-muted/30 p-2 text-left text-[11px] font-mono"
                          >
                            {JSON.stringify(config, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "تعديل قاعدة الأتمتة" : "إضافة قاعدة أتمتة"}
            </DialogTitle>
            <DialogDescription>
              حدّد المحفّز والإجراء والإعدادات
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">اسم القاعدة *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="مثال: تنبيه عند تجاوز ميزانية الطعام"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="trigger">المحفّز</Label>
                <Select
                  value={form.trigger}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, trigger: v }))
                  }
                >
                  <SelectTrigger id="trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => {
                      const Icon = t.icon;
                      return (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            <Icon className="size-4" />
                            {t.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="action">الإجراء</Label>
                <Select
                  value={form.action}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, action: v }))
                  }
                >
                  <SelectTrigger id="action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => {
                      const Icon = a.icon;
                      return (
                        <SelectItem key={a.value} value={a.value}>
                          <span className="flex items-center gap-2">
                            <Icon className="size-4" />
                            {a.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="config">الإعدادات (JSON اختياري)</Label>
              <Textarea
                id="config"
                rows={4}
                dir="ltr"
                className="font-mono text-xs"
                value={form.config}
                onChange={(e) =>
                  setForm((f) => ({ ...f, config: e.target.value }))
                }
                placeholder={'{\n  "threshold": 100,\n  "channel": "telegram"\n}'}
              />
              <p className="text-[11px] text-muted-foreground">
                أدخل إعدادات إضافية بصيغة JSON صحيحة
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <Power className="size-4 text-muted-foreground" />
                <div>
                  <Label className="cursor-pointer">قاعدة نشطة</Label>
                  <p className="text-[11px] text-muted-foreground">
                    عند التفعيل ستنفّذ القاعدة تلقائياً
                  </p>
                </div>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, active: v }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "حفظ القاعدة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف القاعدة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف قاعدة الأتمتة نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-500 hover:bg-rose-600"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  cls,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  cls: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 items-center justify-center rounded-lg ${cls}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
