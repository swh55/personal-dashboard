"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  FolderKanban,
  ListChecks,
  Calendar,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  Archive,
  Filter,
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
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
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

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  _count?: { tasks: number };
}

interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  paused: number;
  avgProgress: number;
}

const STATUS_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; badge: string }> = {
  active: { label: "نشط", icon: PlayCircle, badge: "bg-emerald-glow/15 text-emerald-glow" },
  paused: { label: "متوقف", icon: PauseCircle, badge: "bg-amber-glow/15 text-amber-glow" },
  completed: { label: "مكتمل", icon: CheckCircle2, badge: "bg-emerald-glow/15 text-emerald-glow" },
  archived: { label: "مؤرشف", icon: Archive, badge: "bg-muted text-muted-foreground" },
};

const COLOR_HEX: Record<string, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#ef4444",
  blue: "#0ea5e9",
  violet: "#8b5cf6",
  slate: "#64748b",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  status: "active",
  color: "emerald",
  progress: 0,
  startDate: "",
  endDate: "",
};

export function ProjectsSection() {
  const { data, raw, loading, error, reload } = useApi<Project[]>("/api/projects");
  const projects = data || [];
  const stats: ProjectStats = raw?.stats || { total: 0, active: 0, completed: 0, paused: 0, avgProgress: 0 };

  const [filter, setFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Project | null>(null);
  const [detail, setDetail] = React.useState<Project | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const filtered = React.useMemo(() => {
    if (filter === "all") return projects;
    return projects.filter((p) => p.status === filter);
  }, [projects, filter]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      status: p.status,
      color: p.color,
      progress: p.progress,
      startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : "",
      endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : "",
    });
    setDetail(null);
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        color: form.color,
        progress: Number(form.progress),
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      };
      const res = await fetch("/api/projects", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث المشروع" : "تمت إضافة المشروع");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/projects?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف المشروع");
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
          <h1 className="text-lg font-bold tracking-tight">المشاريع</h1>
          <p className="text-sm text-muted-foreground">{stats.total} مشروع · متوسط التقدم {stats.avgProgress}%</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            مشروع جديد
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-1 md:grid-cols-5">
        <StatCard icon={FolderKanban} label="الإجمالي" value={stats.total} accent="emerald" />
        <StatCard icon={PlayCircle} label="نشط" value={stats.active} accent="emerald" />
        <StatCard icon={PauseCircle} label="متوقف" value={stats.paused} accent="amber" />
        <StatCard icon={CheckCircle2} label="مكتمل" value={stats.completed} accent="emerald" />
        <StatCard icon={ListChecks} label="متوسط التقدم" value={`${stats.avgProgress}%`} accent="amber" />
      </div>

      {/* filter */}
      <Card>
        <CardContent className="flex items-center gap-1 p-1">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="paused">متوقف</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>
          <div className="me-auto text-xs text-muted-foreground">{filtered.length} مشروع</div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل المشاريع</AlertTitle>
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
            {filtered.map((p) => {
              const meta = STATUS_META[p.status] || STATUS_META.active;
              const colorHex = COLOR_HEX[p.color] || COLOR_HEX.emerald;
              return (
                <Card
                  key={p.id}
                  className="group cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setDetail(p)}
                >
                  <CardContent className="flex flex-col gap-1 p-1">
                    <div className="flex items-start gap-1">
                      <div
                        className="mt-0.5 size-3 rounded-full shrink-0"
                        style={{ backgroundColor: colorHex }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{p.name}</div>
                        {p.description ? (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</div>
                        ) : null}
                      </div>
                      <Badge className={`text-[10px] gap-1 ${meta.badge}`} variant="secondary">
                        <meta.icon className="size-3" />
                        {meta.label}
                      </Badge>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>التقدم</span>
                        <span className="font-medium" style={{ color: colorHex }}>{p.progress}%</span>
                      </div>
                      <Progress value={p.progress} className="h-2" />
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <ListChecks className="size-3" />
                        {p._count?.tasks || 0} مهمة
                      </span>
                      {p.startDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatDate(p.startDate, { day: "numeric", month: "short" })}
                        </span>
                      ) : null}
                      {p.endDate ? (
                        <span className="flex items-center gap-1">
                          → {formatDate(p.endDate, { day: "numeric", month: "short" })}
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <FolderKanban className="size-6 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا مشاريع</p>
            <p className="text-xs text-muted-foreground">ابدأ بإضافة مشروعك الأول</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <Plus className="size-4" />
              إضافة مشروع
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
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: COLOR_HEX[detail.color] || COLOR_HEX.emerald }}
                  />
                  {detail.name}
                </DialogTitle>
                <DialogDescription>
                  {STATUS_META[detail.status]?.label || detail.status} · {detail._count?.tasks || 0} مهمة
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1">
                {detail.description ? (
                  <div className="rounded-lg bg-muted/40 p-2 text-sm">{detail.description}</div>
                ) : null}
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>التقدم</span>
                    <span className="font-medium">{detail.progress}%</span>
                  </div>
                  <Progress value={detail.progress} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">تاريخ البدء</div>
                    <div>{detail.startDate ? formatDate(detail.startDate) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">تاريخ الانتهاء</div>
                    <div>{detail.endDate ? formatDate(detail.endDate) : "—"}</div>
                  </div>
                </div>
              </div>
              <DialogFooter>
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
            <DialogTitle>{editing ? "تعديل المشروع" : "إضافة مشروع"}</DialogTitle>
            <DialogDescription>أدخل تفاصيل المشروع.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="p-name">الاسم *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-desc">الوصف</Label>
              <Textarea
                id="p-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="grid gap-1.5">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="paused">متوقف</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                    <SelectItem value="archived">مؤرشف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>اللون</Label>
                <Select value={form.color} onValueChange={(v) => setForm((f) => ({ ...f, color: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLOR_HEX).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <div className="flex items-center gap-1">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: v }} />
                          {k}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>التقدم: {form.progress}%</Label>
              <Slider
                value={[form.progress]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => setForm((f) => ({ ...f, progress: v[0] }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="grid gap-1.5">
                <Label htmlFor="p-start">تاريخ البدء</Label>
                <Input
                  id="p-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-end">تاريخ الانتهاء</Label>
                <Input
                  id="p-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
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
            <AlertDialogDescription>سيتم نقل المشروع إلى سلة المحذوفات.</AlertDialogDescription>
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
  value: number | string;
  accent: "emerald" | "amber";
}) {
  const accentClass = accent === "emerald" ? "text-emerald-glow bg-emerald-glow/10" : "text-amber-glow bg-amber-glow/10";
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
