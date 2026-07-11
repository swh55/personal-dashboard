"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  CircleAlert,
  MapPin,
  Home,
  Building2,
  Store,
  Stethoscope,
  Moon,
  Star,
  Heart,
  Navigation,
  Map as MapIcon,
  Inbox,
  Crosshair,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface SavedLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

const ICON_OPTIONS = [
  { value: "MapPin", label: "موقع عام", icon: MapPin },
  { value: "Home", label: "منزل", icon: Home },
  { value: "Building2", label: "مبنى", icon: Building2 },
  { value: "Store", label: "متجر", icon: Store },
  { value: "Stethoscope", label: "صحة", icon: Stethoscope },
  { value: "Moon", label: "راحة", icon: Moon },
  { value: "Star", label: "مفضّل", icon: Star },
  { value: "Heart", label: "عائلة", icon: Heart },
];

const COLOR_OPTIONS = [
  { value: "emerald", label: "أخضر", cls: "bg-emerald-500", text: "text-emerald-500" },
  { value: "amber", label: "كهرماني", cls: "bg-amber-500", text: "text-amber-glow" },
  { value: "rose", label: "وردي", cls: "bg-rose-500", text: "text-rose-500" },
  { value: "blue", label: "أزرق", cls: "bg-blue-500", text: "text-blue-500" },
  { value: "violet", label: "بنفسجي", cls: "bg-violet-500", text: "text-violet-500" },
  { value: "slate", label: "رمادي", cls: "bg-slate-500", text: "text-slate-500" },
];

function iconFor(value: string) {
  return ICON_OPTIONS.find((o) => o.value === value)?.icon || MapPin;
}

function colorCls(value: string) {
  return COLOR_OPTIONS.find((c) => c.value === value)?.cls || "bg-blue-500";
}

// Aleppo default center
const DEFAULT_CENTER = { lat: 36.2021, lng: 37.1343 };

function buildMapUrl(loc?: { lat: number; lng: number }) {
  const c = loc || DEFAULT_CENTER;
  const delta = 0.01;
  const bbox = `${c.lng - delta},${c.lat - delta},${c.lng + delta},${c.lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${c.lat},${c.lng}`;
}

const EMPTY_FORM = {
  name: "",
  address: "",
  lat: String(DEFAULT_CENTER.lat),
  lng: String(DEFAULT_CENTER.lng),
  icon: "MapPin",
  color: "emerald",
};

export function MapsSection() {
  const { data, loading, error, reload } = useApi<SavedLocation[]>(
    "/api/locations"
  );
  const locations = data || [];

  const [selected, setSelected] = React.useState<SavedLocation | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const mapUrl = selected ? buildMapUrl(selected) : buildMapUrl();

  function openAdd() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("الإحداثيات غير صالحة");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          lat,
          lng,
          icon: form.icon,
          color: form.color,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الإضافة");
      toast.success("تمت إضافة المكان");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الإضافة");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/locations?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف المكان");
      if (selected?.id === deleteId) setSelected(null);
      setDeleteId(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "فشل الحذف");
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">الأماكن المحفوظة</h2>
          <p className="text-sm text-muted-foreground">
            خريطة المواقع الهامة حولك
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>إضافة مكان</span>
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard
          label="إجمالي الأماكن"
          value={locations.length}
          icon={<MapPin className="size-4" />}
          cls="text-emerald-glow bg-emerald-glow/10"
        />
        <StatCard
          label="محدّد حالياً"
          value={selected ? 1 : 0}
          icon={<Crosshair className="size-4" />}
          cls="text-amber-glow bg-amber-glow/10"
        />
        <StatCard
          label="الخريطة"
          value={selected ? "مخصّصة" : "حلب"}
          icon={<MapIcon className="size-4" />}
          cls="text-blue-500 bg-blue-500/10"
          text
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid flex-1 gap-2 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-[420px] w-full rounded-xl" />
          <div className="grid gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" />
          <AlertTitle>تعذّر تحميل الأماكن</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              إعادة المحاولة
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid flex-1 gap-2 lg:grid-cols-[1fr_340px] min-h-0">
          {/* Map */}
          <Card className="overflow-hidden border-border/60 min-h-[300px]">
            <CardContent className="p-0 h-full">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-2 py-1">
                <div className="flex items-center gap-2 text-sm">
                  <MapIcon className="size-4 text-emerald-glow" />
                  <span className="font-medium">
                    {selected ? selected.name : "خريطة حلب"}
                  </span>
                  {selected && (
                    <Badge variant="outline" className="gap-1">
                      <Navigation className="size-3" />
                      {selected.lat.toFixed(4)}، {selected.lng.toFixed(4)}
                    </Badge>
                  )}
                </div>
                {selected && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => setSelected(null)}
                  >
                    عرض الكل
                  </Button>
                )}
              </div>
              <iframe
                title="map"
                src={mapUrl}
                className="h-[420px] w-full border-0 lg:h-[calc(100%-41px)]"
                loading="lazy"
              />
            </CardContent>
          </Card>

          {/* Locations list */}
          <Card className="flex flex-col border-border/60 min-h-0">
            <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
              <div className="border-b border-border/60 px-2 py-1.5">
                <h3 className="text-sm font-semibold">قائمة الأماكن</h3>
              </div>
              {locations.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center">
                  <div className="flex size-9 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
                    <Inbox className="size-6" />
                  </div>
                  <div>
                    <p className="font-medium">لا توجد أماكن محفوظة</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      أضف منزلك، عملك، أو أي موقع هام
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={openAdd}>
                    <Plus className="size-4" />
                    إضافة مكان
                  </Button>
                </div>
              ) : (
                <ScrollArea className="flex-1 custom-scroll">
                  <div className="flex flex-col gap-1 p-2">
                    {locations.map((loc) => {
                      const Icon = iconFor(loc.icon);
                      const isSelected = selected?.id === loc.id;
                      return (
                        <button
                          key={loc.id}
                          onClick={() => setSelected(loc)}
                          className={
                            "group flex items-start gap-2 rounded-lg border p-2 text-right transition-colors " +
                            (isSelected
                              ? "border-emerald-glow/60 bg-emerald-glow/10"
                              : "border-transparent hover:bg-muted/40")
                          }
                        >
                          <div
                            className={
                              "flex size-9 shrink-0 items-center justify-center rounded-lg " +
                              colorCls(loc.color) +
                              " bg-opacity-15"
                            }
                          >
                            <Icon
                              className={
                                "size-4 " +
                                (COLOR_OPTIONS.find((c) => c.value === loc.color)
                                  ?.text || "text-blue-500")
                              }
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">
                                {loc.name}
                              </span>
                              <span
                                className={
                                  "size-2.5 shrink-0 rounded-full " +
                                  colorCls(loc.color)
                                }
                                aria-hidden
                              />
                            </div>
                            {loc.address && (
                              <p className="text-xs text-muted-foreground truncate">
                                {loc.address}
                              </p>
                            )}
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span
                                className="font-mono text-[10px] text-muted-foreground"
                                dir="ltr"
                              >
                                {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-muted-foreground hover:text-rose-500 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteId(loc.id);
                                }}
                                aria-label="حذف"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة مكان جديد</DialogTitle>
            <DialogDescription>
              احفظ موقعاً هاماً لعرضه على الخريطة
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">الاسم *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="مثال: المنزل، العمل، الصيدلية"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">العنوان</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="الحي، الشارع..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="lat">خط العرض (lat)</Label>
                <Input
                  id="lat"
                  inputMode="decimal"
                  dir="ltr"
                  value={form.lat}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lat: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lng">خط الطول (lng)</Label>
                <Input
                  id="lng"
                  inputMode="decimal"
                  dir="ltr"
                  value={form.lng}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lng: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>الأيقونة</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((o) => {
                  const Icon = o.icon;
                  const active = form.icon === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: o.value }))}
                      className={
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors " +
                        (active
                          ? "border-emerald-glow bg-emerald-glow/10 text-emerald-glow"
                          : "border-border hover:bg-muted/40")
                      }
                    >
                      <Icon className="size-3.5" />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>اللون</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => {
                  const active = form.color === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      className={
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors " +
                        (active
                          ? "border-foreground/40 bg-muted/50"
                          : "border-border hover:bg-muted/40")
                      }
                    >
                      <span className={"size-3 rounded-full " + c.cls} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
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
              {submitting ? "جارٍ الحفظ..." : "حفظ المكان"}
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
            <AlertDialogTitle>حذف المكان؟</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن التراجع عن هذا الإجراء.
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
  text,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  cls: string;
  text?: boolean;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-2 p-2">
        <div className={`flex size-8 items-center justify-center rounded-lg ${cls}`}>
          {icon}
        </div>
        <div>
          <div className={"font-bold leading-none " + (text ? "text-base" : "text-xl")}>
            {value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
