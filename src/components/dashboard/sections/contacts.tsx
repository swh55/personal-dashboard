"use client";

import * as React from "react";
import {
  Search,
  Star,
  UserPlus,
  Phone,
  MessageCircle,
  Mail,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Users,
  Heart,
  Filter,
} from "lucide-react";
import { useApi, toast } from "@/lib/api";
import { RELATION_TYPES } from "@/lib/constants";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface Contact {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  relation: string;
  category: string | null;
  note: string | null;
  favorite: boolean;
  avatar: string | null;
  createdAt: string;
  _count?: { calls: number };
}

function relationLabel(r: string): string {
  return RELATION_TYPES.find((x) => x.value === r)?.label || r;
}

function sanitizePhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}

const AVATAR_COLORS = [
  "bg-emerald-glow/15 text-emerald-glow",
  "bg-amber-glow/15 text-amber-glow",
  "bg-rose-500/15 text-rose-500",
  "bg-violet-500/15 text-violet-500",
  "bg-blue-500/15 text-blue-500",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const EMPTY_FORM = {
  name: "",
  phone: "",
  whatsapp: "",
  email: "",
  relation: "other",
  category: "",
  note: "",
  favorite: false,
  avatar: "",
};

export function ContactsSection() {
  const { data, loading, error, reload } = useApi<Contact[]>("/api/contacts");
  const [search, setSearch] = React.useState("");
  const [relation, setRelation] = React.useState<string>("all");
  const [favOnly, setFavOnly] = React.useState(false);
  const [detail, setDetail] = React.useState<Contact | null>(null);
  const [editing, setEditing] = React.useState<Contact | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const filtered = React.useMemo(() => {
    let list = (data || []).slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "ar"));
    if (favOnly) list = list.filter((c) => c.favorite);
    if (relation !== "all") list = list.filter((c) => c.relation === relation);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email || "").toLowerCase().includes(q));
    }
    return list;
  }, [data, favOnly, relation, search]);

  const stats = React.useMemo(() => {
    const list = data || [];
    const byRelation: Record<string, number> = {};
    for (const c of list) byRelation[c.relation] = (byRelation[c.relation] || 0) + 1;
    return {
      total: list.length,
      favorites: list.filter((c) => c.favorite).length,
      byRelation,
    };
  }, [data]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      whatsapp: c.whatsapp || "",
      email: c.email || "",
      relation: c.relation,
      category: c.category || "",
      note: c.note || "",
      favorite: c.favorite,
      avatar: c.avatar || "",
    });
    setDetail(null);
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("الاسم والهاتف مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        relation: form.relation,
        category: form.category.trim() || null,
        note: form.note.trim() || null,
        favorite: form.favorite,
        avatar: form.avatar.trim() || null,
      };
      const res = await fetch("/api/contacts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحفظ");
      toast.success(editing ? "تم تحديث جهة الاتصال" : "تمت إضافة جهة الاتصال");
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleFavorite(c: Contact) {
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, favorite: !c.favorite }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل التحديث");
      toast.success(c.favorite ? "تمت الإزالة من المفضلة" : "أُضيفت إلى المفضلة");
      reload();
      if (detail && detail.id === c.id) setDetail({ ...detail, favorite: !detail.favorite });
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/contacts?id=${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الحذف");
      toast.success("تم حذف جهة الاتصال");
      setDeleteId(null);
      if (detail && detail.id === deleteId) setDetail(null);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطأ");
    }
  }

  function callContact(c: Contact) {
    const clean = sanitizePhone(c.phone);
    if (!clean) { toast.error("الرقم غير صالح"); return; }
    fetch("/api/calllogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: c.id, name: c.name, phone: clean, type: "call", direction: "outgoing" }),
    }).then((r) => r.json()).then((j) => {
      if (!j.success) throw new Error(j.error);
      toast.success(`جارٍ الاتصال بـ ${c.name}`);
      try { window.location.href = `tel:${clean}`; } catch {}
    }).catch((e) => toast.error(e.message || "خطأ"));
  }

  function whatsappContact(c: Contact) {
    const clean = sanitizePhone(c.whatsapp || c.phone).replace(/^\+/, "");
    if (!clean) { toast.error("الرقم غير صالح"); return; }
    window.open(`https://wa.me/${clean}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">جهات الاتصال</h1>
          <p className="text-sm text-muted-foreground">{stats.total} جهة · {stats.favorites} مفضلة</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd}>
            <UserPlus className="size-4" />
            جهة جديدة
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <StatPill icon={Users} label="الإجمالي" value={stats.total} accent="emerald" />
        <StatPill icon={Heart} label="المفضلة" value={stats.favorites} accent="amber" />
        {RELATION_TYPES.map((r) => (
          <StatPill key={r.value} label={r.label} value={stats.byRelation[r.value] || 0} accent="emerald" />
        ))}
      </div>

      {/* filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو البريد" className="pr-8" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={relation} onValueChange={setRelation}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العلاقات</SelectItem>
                {RELATION_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="fav-only" className="text-sm text-muted-foreground">المفضلة فقط</Label>
            <Switch id="fav-only" checked={favOnly} onCheckedChange={setFavOnly} />
          </div>
        </CardContent>
      </Card>

      {/* grid */}
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>تعذر تحميل جهات الاتصال</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2"><Button size="sm" variant="outline" onClick={() => reload()}>إعادة المحاولة</Button></div>
          </AlertDescription>
        </Alert>
      ) : null}

      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-4">
            {filtered.map((c) => (
              <Card key={c.id} className="group cursor-pointer transition-shadow hover:shadow-md" onClick={() => setDetail(c)}>
                <CardContent className="flex items-start gap-3 p-4">
                  <Avatar className="size-12">
                    {c.avatar ? <AvatarImage src={c.avatar} alt={c.name} /> : null}
                    <AvatarFallback className={`text-sm font-bold ${colorForName(c.name)}`}>
                      {c.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold truncate">{c.name}</span>
                      {c.favorite ? <Star className="size-3 fill-amber-glow text-amber-glow shrink-0" /> : null}
                    </div>
                    <div dir="ltr" className="text-xs text-muted-foreground text-right truncate">{c.phone}</div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{relationLabel(c.relation)}</Badge>
                      {c.category ? <Badge variant="outline" className="text-[10px]">{c.category}</Badge> : null}
                    </div>
                  </div>
                </CardContent>
                <div className="flex border-t divide-x divide-x-reverse">
                  <Button variant="ghost" size="sm" className="flex-1 rounded-none text-emerald-glow h-9" onClick={(e) => { e.stopPropagation(); callContact(c); }}>
                    <Phone className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 rounded-none h-9" onClick={(e) => { e.stopPropagation(); whatsappContact(c); }}>
                    <MessageCircle className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 rounded-none h-9" onClick={(e) => { e.stopPropagation(); toggleFavorite(c); }}>
                    <Star className={`size-4 ${c.favorite ? "fill-amber-glow text-amber-glow" : ""}`} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Users className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا جهات اتصال</p>
            <p className="text-xs text-muted-foreground">ابدأ بإضافة جهة جديدة</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={openAdd}>
              <UserPlus className="size-4" />
              إضافة جهة
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>تفاصيل جهة الاتصال</DialogTitle>
                <DialogDescription>{relationLabel(detail.relation)} {detail.category ? `· ${detail.category}` : ""}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 py-2">
                <Avatar className="size-16">
                  {detail.avatar ? <AvatarImage src={detail.avatar} alt={detail.name} /> : null}
                  <AvatarFallback className={`text-xl font-bold ${colorForName(detail.name)}`}>
                    {detail.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold truncate">{detail.name}</span>
                    {detail.favorite ? <Star className="size-4 fill-amber-glow text-amber-glow" /> : null}
                  </div>
                  <div dir="ltr" className="text-sm text-muted-foreground text-right">{detail.phone}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="default" className="bg-emerald-glow text-emerald-glow-foreground hover:bg-emerald-glow/90" onClick={() => callContact(detail)}>
                  <Phone className="size-4" />
                  اتصال
                </Button>
                <Button variant="outline" onClick={() => whatsappContact(detail)}>
                  <MessageCircle className="size-4" />
                  واتساب
                </Button>
                {detail.email ? (
                  <Button variant="outline" asChild>
                    <a href={`mailto:${detail.email}`}><Mail className="size-4" /> بريد</a>
                  </Button>
                ) : <Button variant="outline" disabled><Mail className="size-4" /> بريد</Button>}
              </div>
              {detail.email ? (
                <div className="text-sm"><span className="text-muted-foreground">البريد: </span><span dir="ltr">{detail.email}</span></div>
              ) : null}
              {detail.whatsapp ? (
                <div className="text-sm"><span className="text-muted-foreground">واتساب: </span><span dir="ltr">{detail.whatsapp}</span></div>
              ) : null}
              {detail.note ? (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">{detail.note}</div>
              ) : null}
              <DialogFooter>
                <Button variant="outline" onClick={() => toggleFavorite(detail)}>
                  <Star className={`size-4 ${detail.favorite ? "fill-amber-glow text-amber-glow" : ""}`} />
                  {detail.favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                </Button>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل جهة اتصال" : "إضافة جهة اتصال"}</DialogTitle>
            <DialogDescription>أدخل البيانات المطلوبة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto custom-scroll py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="n-name">الاسم *</Label>
              <Input id="n-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="n-phone">الهاتف *</Label>
                <Input id="n-phone" dir="ltr" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="text-right" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="n-wa">واتساب</Label>
                <Input id="n-wa" dir="ltr" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} className="text-right" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="n-email">البريد الإلكتروني</Label>
                <Input id="n-email" dir="ltr" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="text-right" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="n-cat">التصنيف</Label>
                <Input id="n-cat" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="مثال: زبائن" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>العلاقة</Label>
              <Select value={form.relation} onValueChange={(v) => setForm((f) => ({ ...f, relation: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATION_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="n-avatar">رابط الصورة الرمزية</Label>
              <Input id="n-avatar" dir="ltr" value={form.avatar} onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value }))} className="text-right" placeholder="https://..." />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="n-note">ملاحظة</Label>
              <Textarea id="n-note" rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="n-fav" checked={form.favorite} onCheckedChange={(v) => setForm((f) => ({ ...f, favorite: v }))} />
              <Label htmlFor="n-fav" className="text-sm font-normal cursor-pointer">إضافة للمفضلة</Label>
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
            <AlertDialogDescription>سيتم نقل جهة الاتصال إلى سلة المحذوفات. يمكن استعادتها لاحقاً.</AlertDialogDescription>
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

function StatPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: "emerald" | "amber";
}) {
  const accentClass = accent === "emerald" ? "text-emerald-glow bg-emerald-glow/10" : "text-amber-glow bg-amber-glow/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-3">
        {Icon ? <div className={`flex size-8 items-center justify-center rounded-md ${accentClass}`}><Icon className="size-4" /></div> : null}
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
