"use client";

import * as React from "react";
import {
  Phone,
  MessageCircle,
  Delete,
  Search,
  Star,
  UserPlus,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RefreshCw,
  CircleAlert,
  Send,
} from "lucide-react";
import { useApi, toast, timeAgo } from "@/lib/api";
import { RELATION_TYPES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface Contact {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  favorite: boolean;
  relation: string;
}

interface CallLog {
  id: string;
  name: string;
  phone: string;
  type: string;
  direction: string;
  createdAt: string;
  contactId: string | null;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function relationLabel(r: string): string {
  return RELATION_TYPES.find((x) => x.value === r)?.label || r;
}

function sanitizePhone(p: string): string {
  // keep + and digits
  return p.replace(/[^\d+]/g, "");
}

export function CallPadSection() {
  const { data: contacts, loading: contactsLoading, error: contactsError, reload: reloadContacts } = useApi<Contact[]>("/api/contacts");
  const { data: logs, loading: logsLoading, error: logsError, reload: reloadLogs } = useApi<CallLog[]>("/api/calllogs");

  const [dialed, setDialed] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [newContact, setNewContact] = React.useState({ name: "", phone: "" });

  const filteredContacts = React.useMemo(() => {
    const list = (contacts || []).slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "ar"));
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.whatsapp || "").includes(c.whatsapp ? q : ""));
  }, [contacts, search]);

  function pressKey(k: string) {
    setDialed((d) => (d.length < 20 ? d + k : d));
  }

  function delKey() {
    setDialed((d) => d.slice(0, -1));
  }

  function findMatchingContact(phone: string): Contact | undefined {
    const clean = sanitizePhone(phone);
    if (!clean) return undefined;
    return (contacts || []).find((c) => sanitizePhone(c.phone) === clean || (c.whatsapp && sanitizePhone(c.whatsapp) === clean));
  }

  async function makeCall(phone: string, name?: string) {
    const clean = sanitizePhone(phone);
    if (!clean) {
      toast.error("الرقم غير صالح");
      return;
    }
    const match = findMatchingContact(clean);
    const displayName = name || match?.name || clean;
    try {
      const res = await fetch("/api/calllogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: match?.id,
          name: displayName,
          phone: clean,
          type: "call",
          direction: "outgoing",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل تسجيل المكالمة");
      toast.success(`جارٍ الاتصال بـ ${displayName}`);
      // attempt to open tel: link (will be ignored in many sandboxes but harmless)
      try {
        window.location.href = `tel:${clean}`;
      } catch {
        /* ignore */
      }
      reloadLogs();
    } catch (e: any) {
      toast.error(e.message || "خطأ في تسجيل المكالمة");
    }
  }

  function openWhatsApp(phone: string, name?: string) {
    const clean = sanitizePhone(phone).replace(/^\+/, "");
    if (!clean) {
      toast.error("الرقم غير صالح");
      return;
    }
    const url = `https://wa.me/${clean}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(`فتح واتساب: ${name || clean}`);
  }

  function openSms(phone: string) {
    const clean = sanitizePhone(phone);
    try {
      window.location.href = `sms:${clean}`;
    } catch {
      /* ignore */
    }
  }

  async function addContact() {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      toast.error("الاسم والهاتف مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContact.name.trim(),
          phone: newContact.phone.trim(),
          whatsapp: newContact.phone.trim(),
          relation: "other",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "فشل الإضافة");
      toast.success("تمت إضافة جهة الاتصال");
      setNewContact({ name: "", phone: "" });
      setAddOpen(false);
      reloadContacts();
    } catch (e: any) {
      toast.error(e.message || "خطأ في الإضافة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة الاتصال</h1>
          <p className="text-sm text-muted-foreground">اتصال سريع وإدارة المكالمات</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { reloadContacts(); reloadLogs(); }}>
            <RefreshCw className="size-4" />
            تحديث
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" />
            جهة جديدة
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3">
        {/* dialpad */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="size-4 text-emerald-glow" />
              لوحة الأرقام
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            {/* display */}
            <div className="min-h-[3.5rem] rounded-lg border bg-muted/30 px-3 py-2 text-center">
              <div dir="ltr" className="text-2xl font-mono font-semibold tracking-wider break-all min-h-[2rem]">
                {dialed || <span className="text-muted-foreground/50 text-base">اكتب رقماً...</span>}
              </div>
              {dialed ? (
                <div className="text-xs text-muted-foreground mt-1">
                  {(() => {
                    const m = findMatchingContact(dialed);
                    return m ? m.name : "رقم غير محفوظ";
                  })()}
                </div>
              ) : null}
            </div>

            {/* action row */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="default"
                className="bg-emerald-glow text-emerald-glow-foreground hover:bg-emerald-glow/90"
                onClick={() => makeCall(dialed)}
                disabled={!dialed}
              >
                <PhoneCall className="size-4" />
                اتصال
              </Button>
              <Button
                variant="outline"
                onClick={() => openWhatsApp(dialed)}
                disabled={!dialed}
              >
                <MessageCircle className="size-4 text-emerald-glow" />
                واتساب
              </Button>
              <Button
                variant="outline"
                onClick={() => openSms(dialed)}
                disabled={!dialed}
              >
                <Send className="size-4" />
                رسالة
              </Button>
            </div>

            {/* keypad */}
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <Button
                  key={k}
                  variant="secondary"
                  className="h-14 text-xl font-mono font-semibold"
                  onClick={() => pressKey(k)}
                >
                  {k}
                </Button>
              ))}
            </div>

            {/* delete */}
            <Button
              variant="outline"
              className="h-12"
              onClick={delKey}
              disabled={!dialed}
            >
              <Delete className="size-4" />
              حذف
            </Button>
          </CardContent>
        </Card>

        {/* contacts */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="size-4 text-amber-glow" />
              جهات الاتصال
            </CardTitle>
            <div className="relative mt-1">
              <Search className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الرقم"
                className="pr-8"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="custom-scroll h-full max-h-[28rem] lg:max-h-none">
              {contactsError ? (
                <Alert variant="destructive" className="m-3">
                  <CircleAlert />
                  <AlertTitle>خطأ</AlertTitle>
                  <AlertDescription>{contactsError}</AlertDescription>
                </Alert>
              ) : contactsLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : filteredContacts.length > 0 ? (
                <ul className="divide-y">
                  {filteredContacts.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/40 transition-colors">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-emerald-glow/15 text-emerald-glow text-xs font-bold">
                          {c.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{c.name}</span>
                          {c.favorite ? <Star className="size-3 fill-amber-glow text-amber-glow" /> : null}
                        </div>
                        <div dir="ltr" className="text-xs text-muted-foreground text-right truncate">{c.phone}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" className="size-8 text-emerald-glow" onClick={() => makeCall(c.phone, c.name)} aria-label="اتصال">
                          <Phone className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => openWhatsApp(c.whatsapp || c.phone, c.name)} aria-label="واتساب">
                          <MessageCircle className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Phone className="size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">لا جهات اتصال</p>
                  <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                    <UserPlus className="size-4" />
                    إضافة جهة
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* call logs */}
        <Card className="flex flex-col overflow-hidden lg:row-span-1">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <PhoneCall className="size-4 text-emerald-glow" />
              آخر المكالمات
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="custom-scroll h-full max-h-[28rem] lg:max-h-none">
              {logsError ? (
                <Alert variant="destructive" className="m-3">
                  <CircleAlert />
                  <AlertTitle>خطأ</AlertTitle>
                  <AlertDescription>{logsError}</AlertDescription>
                </Alert>
              ) : logsLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (logs || []).length > 0 ? (
                <ul className="divide-y">
                  {logs!.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/40 transition-colors">
                      <DirectionIcon direction={l.direction} type={l.type} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{l.name}</div>
                        <div className="flex items-center justify-between gap-2">
                          <span dir="ltr" className="text-xs text-muted-foreground text-right truncate">{l.phone}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(l.createdAt)}</span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-emerald-glow shrink-0"
                        onClick={() => { setDialed(l.phone); makeCall(l.phone, l.name); }}
                        aria-label="إعادة الاتصال"
                      >
                        <Phone className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <PhoneCall className="size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">لا سجل مكالمات</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* add contact dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة جهة اتصال سريعة</DialogTitle>
            <DialogDescription>أدخل الاسم ورقم الهاتف. يمكنك تعديل التفاصيل لاحقاً.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="c-name">الاسم *</Label>
              <Input id="c-name" value={newContact.name} onChange={(e) => setNewContact((c) => ({ ...c, name: e.target.value }))} placeholder="الاسم الكامل" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-phone">رقم الهاتف *</Label>
              <Input id="c-phone" dir="ltr" value={newContact.phone} onChange={(e) => setNewContact((c) => ({ ...c, phone: e.target.value }))} placeholder="+963..." className="text-right" />
            </div>
            <div className="grid gap-1.5">
              <Label>العلاقة</Label>
              <Select defaultValue="other">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATION_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={addContact} disabled={submitting}>
              {submitting ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DirectionIcon({ direction, type }: { direction: string; type: string }) {
  if (type === "whatsapp") return <MessageCircle className="size-4 text-emerald-glow shrink-0" />;
  if (direction === "incoming") return <PhoneIncoming className="size-4 text-emerald-glow shrink-0" />;
  if (direction === "missed") return <PhoneMissed className="size-4 text-destructive shrink-0" />;
  return <PhoneOutgoing className="size-4 text-amber-glow shrink-0" />;
}
