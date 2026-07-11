"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  CircleAlert,
  Calendar,
  HardDrive,
  Send,
  Mail,
  Github,
  Users,
  Cloud,
  Check,
  Link2,
  Unlink,
  RefreshCcw,
  Inbox,
  Plug,
} from "lucide-react";
import { useApi, toast, timeAgo } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Integration {
  id: string;
  service: string;
  name: string;
  connected: boolean;
  config: string | null;
  lastSync: string | null;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationMeta {
  count: number;
  connected: number;
  availableServices: string[];
}

const SERVICE_META: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    canSync?: boolean;
    syncEndpoint?: string;
    syncLabel?: string;
  }
> = {
  google_calendar: {
    label: "Google Calendar",
    icon: Calendar,
    color: "text-blue-500",
    bg: "bg-blue-500/15",
    canSync: true,
    syncEndpoint: "/api/sync/calendar",
    syncLabel: "مزامنة الأحداث",
  },
  google_drive: {
    label: "Google Drive",
    icon: HardDrive,
    color: "text-emerald-glow",
    bg: "bg-emerald-glow/15",
    canSync: true,
    syncEndpoint: "/api/sync/drive",
    syncLabel: "نسخ احتياطي",
  },
  google_contacts: {
    label: "Google Contacts",
    icon: Users,
    color: "text-violet-500",
    bg: "bg-violet-500/15",
    canSync: true,
    syncEndpoint: "/api/sync/contacts",
    syncLabel: "استيراد جهات الاتصال",
  },
  telegram: {
    label: "تيليجرام",
    icon: Send,
    color: "text-blue-500",
    bg: "bg-blue-500/15",
  },
  email: {
    label: "البريد الإلكتروني",
    icon: Mail,
    color: "text-amber-glow",
    bg: "bg-amber-glow/15",
  },
  github: {
    label: "GitHub",
    icon: Github,
    color: "text-foreground",
    bg: "bg-muted",
  },
  cloud_sync: {
    label: "مزامنة سحابية",
    icon: Cloud,
    color: "text-emerald-glow",
    bg: "bg-emerald-glow/15",
  },
};

function serviceMeta(service: string) {
  return (
    SERVICE_META[service] || {
      label: service,
      icon: Plug,
      color: "text-muted-foreground",
      bg: "bg-muted",
    }
  );
}

const EMPTY_FORM = {
  service: "",
  name: "",
};

export function IntegrationsSection() {
  const { data, raw, loading, error, reload } = useApi<Integration[]>(
    "/api/integrations"
  );
  const integrations = data || [];
  const meta: IntegrationMeta | undefined = raw?.meta;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [syncingService, setSyncingService] = React.useState<string | null>(
    null
  );

  const availableForAdd = React.useMemo(() => {
    if (!meta) return [];
    const used = new Set(integrations.map((i) => i.service));
    return meta.availableServices.filter((s) => !used.has(s));
  }, [integrations, meta]);

  function openAdd() {
    setForm({
      service: availableForAdd[0] || "",
      name: "",
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.service) {
      toast.error("اختر خدمة");
      return;
    }
    setSubmitting(true);
    try {
      const m = serviceMeta(form.service);
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: form.service,
          name: form.name.trim() || m.label,
          connected: false,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الإضافة");
      toast.success("تمت إضافة التكامل");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الإضافة");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(integration: Integration) {
    setTogglingId(integration.id);
    try {
      const res = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: integration.id,
          connected: !integration.connected,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(
        integration.connected ? "تم فصل التكامل" : "تم ربط التكامل"
      );
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل التحديث");
    } finally {
      setTogglingId(null);
    }
  }

  async function runSync(integration: Integration) {
    const m = serviceMeta(integration.service);
    if (!m.syncEndpoint) return;
    if (!integration.connected) {
      toast.error("يجب ربط الخدمة أولاً قبل المزامنة");
      return;
    }
    setSyncingService(integration.service);
    try {
      const res = await fetch(m.syncEndpoint, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "فشلت المزامنة");
      }
      const data = json.data || {};
      let msg = "اكتملت المزامنة";
      if (integration.service === "google_contacts") {
        msg = `تم استيراد ${data.imported || 0} جهة، تخطي ${data.skipped || 0}`;
      } else if (integration.service === "google_calendar") {
        msg = `استيراد ${data.imported || 0}، تصدير ${data.exported || 0} حدث`;
      } else if (integration.service === "google_drive") {
        msg = `تم إنشاء نسخة: ${data.filename || ""}`;
      }
      toast.success(msg);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشلت المزامنة");
    } finally {
      setSyncingService(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/integrations?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف التكامل");
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
          <h2 className="text-2xl font-bold tracking-tight">التكاملات</h2>
          <p className="text-sm text-muted-foreground">
            اربط خدماتك الخارجية ومزامنتها مع لوحة التحكم
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            disabled={!meta || availableForAdd.length === 0}
          >
            <Plus className="size-4" />
            <span>إضافة تكامل</span>
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="إجمالي التكاملات"
          value={meta?.count ?? 0}
          icon={<Plug className="size-4" />}
          cls="text-emerald-glow bg-emerald-glow/10"
        />
        <StatCard
          label="متصلة"
          value={meta?.connected ?? 0}
          icon={<Link2 className="size-4" />}
          cls="text-emerald-glow bg-emerald-glow/10"
        />
        <StatCard
          label="غير متصلة"
          value={(meta?.count ?? 0) - (meta?.connected ?? 0)}
          icon={<Unlink className="size-4" />}
          cls="text-muted-foreground bg-muted/40"
        />
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 custom-scroll -mx-1 px-1">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertTitle>تعذّر تحميل التكاملات</AlertTitle>
            <AlertDescription className="flex items-center gap-2">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={reload}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : integrations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
                <Inbox className="size-7" />
              </div>
              <div>
                <p className="font-medium">لا توجد تكاملات بعد</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  اربط Google Calendar أو Drive أو Telegram وغيرها
                </p>
              </div>
              <Button size="sm" onClick={openAdd}>
                <Plus className="size-4" />
                إضافة تكامل
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((it) => {
              const m = serviceMeta(it.service);
              const Icon = m.icon;
              const isToggling = togglingId === it.id;
              const isSyncing = syncingService === it.service;
              return (
                <Card
                  key={it.id}
                  className="group flex flex-col border-border/60 transition-colors hover:border-emerald-glow/40"
                >
                  <CardContent className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={
                            "flex size-10 items-center justify-center rounded-lg " +
                            m.bg +
                            " " +
                            m.color
                          }
                        >
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold leading-tight">
                            {it.name}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            {m.label}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-rose-500 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => setDeleteId(it.id)}
                        aria-label="حذف"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={
                          it.connected
                            ? "bg-emerald-glow/15 text-emerald-glow border-emerald-glow/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {it.connected ? (
                          <>
                            <Check className="size-3" />
                            متصل
                          </>
                        ) : (
                          <>
                            <Unlink className="size-3" />
                            غير متصل
                          </>
                        )}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {it.connected ? "ربط" : "فصل"}
                        </span>
                        <Switch
                          checked={it.connected}
                          onCheckedChange={() => toggle(it)}
                          disabled={isToggling}
                        />
                      </div>
                    </div>

                    {it.lastSync && (
                      <p className="text-[11px] text-muted-foreground">
                        آخر مزامنة: {timeAgo(it.lastSync)}
                      </p>
                    )}

                    {m.canSync && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-auto w-full gap-1.5"
                        disabled={!it.connected || isSyncing}
                        onClick={() => runSync(it)}
                      >
                        <RefreshCcw
                          className={
                            "size-3.5 " + (isSyncing ? "animate-spin" : "")
                          }
                        />
                        {isSyncing ? "جارٍ المزامنة..." : m.syncLabel}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة تكامل</DialogTitle>
            <DialogDescription>
              اختر خدمة لربطها مع لوحة التحكم
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="service">الخدمة</Label>
              <Select
                value={form.service}
                onValueChange={(v) => {
                  const m = serviceMeta(v);
                  setForm((f) => ({ ...f, service: v, name: m.label }));
                }}
              >
                <SelectTrigger id="service">
                  <SelectValue placeholder="اختر خدمة" />
                </SelectTrigger>
                <SelectContent>
                  {availableForAdd.map((s) => {
                    const m = serviceMeta(s);
                    const Icon = m.icon;
                    return (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <Icon className={"size-4 " + m.color} />
                          {m.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">الاسم المعروض</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="اسم مخصص للتكامل"
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
              {submitting ? "جارٍ الحفظ..." : "إضافة"}
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
            <AlertDialogTitle>حذف التكامل؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا التكامل نهائياً. لا يمكن التراجع.
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
