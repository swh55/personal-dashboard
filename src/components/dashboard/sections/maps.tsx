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
  Locate,
  Loader2,
  WifiOff,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import { getCurrentLocation } from "@/lib/native/bridge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

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

const EMPTY_FORM = {
  name: "",
  address: "",
  lat: String(DEFAULT_CENTER.lat),
  lng: String(DEFAULT_CENTER.lng),
  icon: "MapPin",
  color: "emerald",
};

// ---------------------------------------------------------------------------
// useLeaflet — dynamic CDN loader (CSS + JS), runs once per session
// ---------------------------------------------------------------------------

interface LeafletState {
  loaded: boolean;
  failed: boolean;
}

const LEAFLET_CSS_HREF = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_SRC = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function useLeaflet(): LeafletState {
  const [state, setState] = React.useState<LeafletState>({ loaded: false, failed: false });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const w = window as any;
    // Already loaded — done
    if (w.L) {
      setState({ loaded: true, failed: false });
      return;
    }

    let cancelled = false;

    // Inject CSS once
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_HREF;
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    // Inject JS once
    const finish = (ok: boolean) => {
      if (cancelled) return;
      if (ok && w.L) {
        setState({ loaded: true, failed: false });
      } else {
        setState({ loaded: false, failed: true });
      }
    };

    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      if (w.L) {
        finish(true);
      } else {
        existing.addEventListener("load", () => finish(true));
        existing.addEventListener("error", () => finish(false));
      }
    } else {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = LEAFLET_JS_SRC;
      script.async = true;
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// ---------------------------------------------------------------------------
// LeafletMap — interactive pannable/zoomable map with a draggable marker
// ---------------------------------------------------------------------------

interface LeafletMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  onMarkerMove?: (lat: number, lng: number) => void;
  draggable?: boolean;
  height?: string;
  className?: string;
  /** Show a hint banner above the map (drag/click instructions). */
  hint?: string;
}

function LeafletMap({
  lat,
  lng,
  zoom = 14,
  onMarkerMove,
  draggable = true,
  height = "300px",
  className,
  hint,
}: LeafletMapProps) {
  const { loaded, failed } = useLeaflet();

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);

  // Keep latest props in refs without re-running the init effect
  const onMarkerMoveRef = React.useRef(onMarkerMove);
  React.useEffect(() => {
    onMarkerMoveRef.current = onMarkerMove;
  }, [onMarkerMove]);

  // Initialize the map once Leaflet is loaded and the container is in the DOM
  React.useEffect(() => {
    if (!loaded) return;
    const node = containerRef.current;
    if (!node) return;
    const L = (window as any).L;
    if (!L) return;
    if (mapRef.current) return; // already init

    const map = L.map(node, {
      center: [lat, lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable }).addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      onMarkerMoveRef.current?.(ll.lat, ll.lng);
    });

    map.on("click", (e: any) => {
      const { lat: cl, lng: cL } = e.latlng;
      marker.setLatLng([cl, cL]);
      onMarkerMoveRef.current?.(cl, cL);
    });

    // Tiles can render before the container has its final size
    // (especially inside a dialog that animates open). Defer a layout fix.
    const t = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      window.clearTimeout(t);
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [loaded]);

  // ResizeObserver — keep tile grid aligned if the container resizes
  React.useEffect(() => {
    if (!loaded) return;
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [loaded]);

  // Sync marker position when lat/lng props change externally
  React.useEffect(() => {
    if (!loaded) return;
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - lat) > 1e-9 || Math.abs(cur.lng - lng) > 1e-9) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true });
    }
  }, [lat, lng, loaded]);

  // Toggle draggable on the marker
  React.useEffect(() => {
    if (!loaded) return;
    const marker = markerRef.current;
    if (!marker) return;
    try {
      if (draggable) marker.dragging?.enable();
      else marker.dragging?.disable();
    } catch {
      /* ignore */
    }
  }, [draggable, loaded]);

  // ----- Render states -----

  if (failed) {
    return (
      <div
        dir="ltr"
        className={
          "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 bg-muted/30 p-4 text-center text-sm text-muted-foreground " +
          (className || "")
        }
        style={{ height, width: "100%" }}
      >
        <WifiOff className="size-5" />
        <span>تعذّر تحميل الخريطة — تحقق من اتصال الإنترنت</span>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div
        dir="ltr"
        className={
          "flex items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground " +
          (className || "")
        }
        style={{ height, width: "100%" }}
      >
        <div className="flex items-center gap-1">
          <Loader2 className="size-4 animate-spin" />
          <span>جارٍ تحميل الخريطة...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: "100%" }}>
      {hint && (
        <div className="mb-1 text-center text-[11px] text-muted-foreground">
          {hint}
        </div>
      )}
      {/* Leaflet needs an explicit height + LTR direction */}
      <div
        ref={containerRef}
        dir="ltr"
        style={{ height, width: "100%", background: "#e5e7eb", borderRadius: "0.375rem" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function MapsSection() {
  const { data, loading, error, reload } = useApi<SavedLocation[]>(
    "/api/locations"
  );
  const locations = data || [];

  const [selected, setSelected] = React.useState<SavedLocation | null>(null);
  // Live pin position on the main map. Driven by `selected` but the user can
  // drag the marker to explore. Used to pre-fill the add dialog.
  const [pinPos, setPinPos] = React.useState<{ lat: number; lng: number }>(
    DEFAULT_CENTER
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);

  // When a location is selected, snap the main map's pin to it.
  React.useEffect(() => {
    if (selected) setPinPos({ lat: selected.lat, lng: selected.lng });
  }, [selected]);

  function openAdd() {
    setForm({
      ...EMPTY_FORM,
      lat: String(pinPos.lat),
      lng: String(pinPos.lng),
    });
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

  /** Use device GPS (native bridge falls back to browser geolocation on web). */
  async function locateMe(target: "main" | "dialog") {
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      if (!loc) {
        toast.error("تعذّر الحصول على موقعك الحالي");
        return;
      }
      if (target === "main") {
        setPinPos({ lat: loc.latitude, lng: loc.longitude });
      } else {
        setForm((f) => ({
          ...f,
          lat: String(loc.latitude),
          lng: String(loc.longitude),
        }));
      }
      toast.success("تم تحديد موقعك الحالي");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-1">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">الأماكن المحفوظة</h2>
          <p className="text-sm text-muted-foreground">
            خريطة تفاعلية — اسحب الدبوس أو انقر على الخريطة لتحديد الموقع
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => locateMe("main")}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Locate className="size-4" />
            )}
            <span className="hidden sm:inline">موقعي الحالي</span>
          </Button>
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
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
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
          label="موقع الدبوس"
          value={`${pinPos.lat.toFixed(3)}, ${pinPos.lng.toFixed(3)}`}
          icon={<MapIcon className="size-4" />}
          cls="text-blue-500 bg-blue-500/10"
          text
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid flex-1 gap-1 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <div className="grid gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" />
          <AlertTitle>تعذّر تحميل الأماكن</AlertTitle>
          <AlertDescription className="flex items-center gap-1">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              إعادة المحاولة
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid flex-1 gap-1 lg:grid-cols-[1fr_340px] min-h-0">
          {/* Map */}
          <Card className="overflow-hidden border-border/60 min-h-[300px] flex flex-col">
            <CardContent className="p-0 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between gap-1 border-b border-border/60 bg-muted/30 px-2 py-1">
                <div className="flex items-center gap-1 text-sm">
                  <MapIcon className="size-4 text-emerald-glow" />
                  <span className="font-medium">
                    {selected ? selected.name : "خريطة حلب"}
                  </span>
                  <Badge variant="outline" className="gap-1" dir="ltr">
                    <Navigation className="size-3" />
                    {pinPos.lat.toFixed(4)}، {pinPos.lng.toFixed(4)}
                  </Badge>
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
              <div className="flex-1 min-h-0 p-1">
                <LeafletMap
                  lat={pinPos.lat}
                  lng={pinPos.lng}
                  zoom={14}
                  draggable
                  height="250px"
                  className="h-full"
                  hint="اسحب الدبوس أو انقر على الخريطة لنقله"
                  onMarkerMove={(lat, lng) => setPinPos({ lat, lng })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Locations list */}
          <Card className="flex flex-col border-border/60 min-h-0">
            <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
              <div className="border-b border-border/60 px-2 py-0.5">
                <h3 className="text-sm font-semibold">قائمة الأماكن</h3>
              </div>
              {locations.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 p-1 text-center">
                  <div className="flex size-7 items-center justify-center rounded-full bg-emerald-glow/10 text-emerald-glow">
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
                            "group flex items-start gap-1 rounded-lg border p-2 text-right transition-colors " +
                            (isSelected
                              ? "border-emerald-glow/60 bg-emerald-glow/10"
                              : "border-transparent hover:bg-muted/40")
                          }
                        >
                          <div
                            className={
                              "flex size-7 shrink-0 items-center justify-center rounded-lg " +
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
                            <div className="flex items-center justify-between gap-1">
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
                            <div className="mt-1 flex items-center justify-between gap-1">
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة مكان جديد</DialogTitle>
            <DialogDescription>
              اسحب الدبوس أو انقر على الخريطة، أو أدخل الإحداثيات يدويًا
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 py-1">
            <div className="grid gap-1">
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
            <div className="grid gap-1">
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

            {/* Interactive picker map inside the dialog */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>الموقع على الخريطة</Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => locateMe("dialog")}
                  disabled={locating}
                >
                  {locating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Locate className="size-3.5" />
                  )}
                  موقعي الحالي
                </Button>
              </div>
              <LeafletMap
                lat={Number(form.lat) || DEFAULT_CENTER.lat}
                lng={Number(form.lng) || DEFAULT_CENTER.lng}
                zoom={14}
                draggable
                height="220px"
                hint="اسحب الدبوس أو انقر على الخريطة لنقله"
                onMarkerMove={(lat, lng) =>
                  setForm((f) => ({
                    ...f,
                    lat: String(lat),
                    lng: String(lng),
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-1">
              <div className="grid gap-1">
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
              <div className="grid gap-1">
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
            <div className="grid gap-1">
              <Label>الأيقونة</Label>
              <div className="flex flex-wrap gap-1">
                {ICON_OPTIONS.map((o) => {
                  const Icon = o.icon;
                  const active = form.icon === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: o.value }))}
                      className={
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs transition-colors " +
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
            <div className="grid gap-1">
              <Label>اللون</Label>
              <div className="flex flex-wrap gap-1">
                {COLOR_OPTIONS.map((c) => {
                  const active = form.color === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      className={
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs transition-colors " +
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
      <CardContent className="flex items-center gap-1 p-1">
        <div className={`flex size-6 items-center justify-center rounded-lg ${cls}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className={
              "font-bold leading-none truncate " +
              (text ? "text-sm font-mono" : "text-lg")
            }
            dir={text ? "ltr" : undefined}
          >
            {value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
