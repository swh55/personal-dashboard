"use client";

// Fetch interceptor for the offline APK mode.
//
// When the app is running inside a Capacitor native shell (or when the
// localStorage flag `force-local-mode` is set), we replace `window.fetch`
// with a thin layer that routes every `/api/*` request to an in-memory
// handler backed by the localStorage `db`. The rest of the app keeps
// using the exact same `fetch("/api/...")` calls — it has no idea it's
// running locally.

import { db, genId, initDB } from "./db";
import {
  getUpcomingHolidays,
  isHoliday,
  type Holiday,
} from "@/lib/holidays";

const USD_TO_SYP = 12500;

// ----------------------------------------------------------------------------
// Response helpers
// ----------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function ok(data: unknown, extra?: Record<string, unknown>, status = 200): Response {
  return json({ success: true, data, ...(extra || {}) }, status);
}

function fail(error: string, status = 500): Response {
  return json({ success: false, error }, status);
}

// ----------------------------------------------------------------------------
// URL / body parsing helpers
// ----------------------------------------------------------------------------

interface ParsedRequest {
  pathname: string;
  search: URLSearchParams;
  method: string;
  body: any;
}

async function parseRequest(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ParsedRequest> {
  let urlStr: string;
  let method = (init?.method || "GET").toUpperCase();
  let body: any = undefined;

  if (input instanceof Request) {
    urlStr = input.url;
    if (!init) {
      method = (input.method || "GET").toUpperCase();
      try {
        body = await input.json();
      } catch {
        try {
          const text = await input.text();
          body = text ? safeJson(text) : undefined;
        } catch {
          /* ignore */
        }
      }
    }
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else {
    urlStr = input as string;
  }

  if (init?.body && body === undefined) {
    if (typeof init.body === "string") {
      body = safeJson(init.body);
    } else if (init.body instanceof FormData) {
      const obj: Record<string, unknown> = {};
      init.body.forEach((value, key) => {
        obj[key] = value;
      });
      body = obj;
    } else if (init.body instanceof Blob) {
      try {
        body = safeJson(await init.body.text());
      } catch {
        body = undefined;
      }
    }
  }

  // Strip the protocol + host if present so we only route on the path.
  let url: URL;
  try {
    url = new URL(urlStr, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  } catch {
    url = new URL("http://localhost" + urlStr);
  }

  return {
    pathname: url.pathname,
    search: url.searchParams,
    method,
    body,
  };
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ----------------------------------------------------------------------------
// Misc helpers shared by handlers
// ----------------------------------------------------------------------------

function nowISO(): string {
  return new Date().toISOString();
}

function toSYP(amount: number, currency: string): number {
  return currency === "usd" ? amount * USD_TO_SYP : amount;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ----------------------------------------------------------------------------
// CRUD endpoint factory
// ----------------------------------------------------------------------------

interface CrudConfig {
  collection: string;
  softDelete?: boolean;
  /** Default orderBy applied to GET list. */
  orderBy?: (items: any[]) => any[];
  /** Extra filters based on query params. */
  filter?: (items: any[], search: URLSearchParams) => any[];
  /** Transform the GET payload (e.g. add stats). */
  transformGet?: (items: any[], search: URLSearchParams) => Record<string, unknown>;
  /** Custom create payload (defaults to the body). */
  createPayload?: (body: any) => any;
  /** Activity log message on create. */
  createLog?: (item: any) => string;
  /** Validation: returns an error string or null. */
  validateCreate?: (body: any) => string | null;
  /** Validation for updates. */
  validateUpdate?: (body: any) => string | null;
  /** Transform PUT body before applying. */
  transformUpdate?: (body: any) => any;
  /** Status code for POST. */
  createStatus?: number;
}

function crudHandler(cfg: CrudConfig) {
  return async (req: ParsedRequest): Promise<Response> => {
    const items = db.getCollection(cfg.collection);

    if (req.method === "GET") {
      let visible = items.filter((i) => i.deletedAt == null);
      if (cfg.filter) visible = cfg.filter(visible, req.search);
      if (cfg.orderBy) visible = cfg.orderBy(visible);
      const extra = cfg.transformGet ? cfg.transformGet(visible, req.search) : {};
      return ok(visible, extra);
    }

    if (req.method === "POST") {
      if (cfg.validateCreate) {
        const err = cfg.validateCreate(req.body);
        if (err) return fail(err, 400);
      }
      const payload = cfg.createPayload ? cfg.createPayload(req.body) : req.body;
      const created = db.insert(cfg.collection, payload);
      if (cfg.createLog) db.logActivity("create", cfg.collection, cfg.createLog(created));
      return ok(created, undefined, cfg.createStatus ?? 201);
    }

    if (req.method === "PUT") {
      if (cfg.validateUpdate) {
        const err = cfg.validateUpdate(req.body);
        if (err) return fail(err, 400);
      }
      const { id, ...rest } = req.body || {};
      if (!id) return fail("المعرف مطلوب", 400);
      const patch = cfg.transformUpdate ? cfg.transformUpdate(rest) : rest;
      const updated = db.update(cfg.collection, id, patch);
      if (!updated) return fail("العنصر غير موجود", 404);
      return ok(updated);
    }

    if (req.method === "DELETE") {
      const id = req.search.get("id");
      const force = req.search.get("force") === "true";
      if (!id) return fail("المعرف مطلوب", 400);
      if (cfg.softDelete && !force) {
        const okFlag = db.softDelete(cfg.collection, id);
        if (!okFlag) return fail("العنصر غير موجود", 404);
      } else {
        const okFlag = db.remove(cfg.collection, id);
        if (!okFlag) return fail("العنصر غير موجود", 404);
      }
      return json({ success: true });
    }

    return fail("الطريقة غير مدعومة", 405);
  };
}

// ----------------------------------------------------------------------------
// Endpoint handlers
// ----------------------------------------------------------------------------

// ---- /api/calllogs ---------------------------------------------------------
async function calllogsRoute(req: ParsedRequest): Promise<Response> {
  if (req.method === "GET") {
    const logs = db
      .getCollection("callLogs")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
    // Enrich with contact info (like Prisma's `include: { contact: true }`)
    const contacts = db.getCollection("contacts");
    const data = logs.map((l) => ({
      ...l,
      contact: l.contactId ? contacts.find((c) => c.id === l.contactId) || null : null,
    }));
    return ok(data);
  }
  if (req.method === "POST") {
    const { contactId, name, phone, type, direction, note } = req.body || {};
    if (!name || !phone) return fail("الاسم والهاتف مطلوبان", 400);
    const log = db.insert("callLogs", {
      contactId: contactId || null,
      name,
      phone,
      type: type || "call",
      direction: direction || "outgoing",
      note: note || null,
    });
    db.logActivity("create", "calllog", `تم تسجيل مكالمة: ${name}`);
    return ok(log, 201);
  }
  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) {
      db.setCollection("callLogs", []);
      return ok(null);
    }
    db.remove("callLogs", id);
    return ok(null);
  }
  return fail("Method not allowed", 405);
}

// ---- /api/contacts ----------------------------------------------------------
// Special: GET enriches each contact with `_count.calls` like Prisma's
// `include: { _count: { select: { calls: true } } }`.
async function contactsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("contacts");

  if (req.method === "GET") {
    const relation = req.search.get("relation");
    const favorite = req.search.get("favorite");
    let visible = items.filter((i) => i.deletedAt == null);
    if (relation) visible = visible.filter((i) => i.relation === relation);
    if (favorite === "true") visible = visible.filter((i) => i.favorite);
    visible.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.name.localeCompare(b.name, "ar");
    });
    const calls = db.getCollection("callLogs");
    const data = visible.map((c) => ({
      ...c,
      _count: { calls: calls.filter((cl) => cl.contactId === c.id).length },
    }));
    return ok(data);
  }

  if (req.method === "POST") {
    const b = req.body || {};
    if (!b.name || !b.phone) return fail("الاسم والهاتف مطلوبان", 400);
    const created = db.insert("contacts", {
      name: b.name,
      phone: b.phone,
      whatsapp: b.whatsapp || null,
      email: b.email || null,
      relation: b.relation || "other",
      category: b.category || null,
      note: b.note || null,
      favorite: b.favorite || false,
      avatar: b.avatar || null,
      deletedAt: null,
    });
    db.logActivity("create", "contact", `أضيف جهة اتصال: ${created.name}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const updated = db.update("contacts", id, rest);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    const force = req.search.get("force") === "true";
    if (!id) return fail("المعرف مطلوب", 400);
    if (force) db.remove("contacts", id);
    else db.softDelete("contacts", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/notes -------------------------------------------------------------
const notesHandler = crudHandler({
  collection: "notes",
  softDelete: true,
  orderBy: (items) =>
    items.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
  validateCreate: (b) => (!b?.title || !b?.content ? "العنوان والمحتوى مطلوبان" : null),
  createPayload: (b) => ({
    title: b.title,
    content: b.content,
    color: b.color || "default",
    pinned: b.pinned || false,
    deletedAt: null,
  }),
  createLog: (n) => `أضيف ملاحظة: ${n.title}`,
  createStatus: 201,
});

// ---- /api/tasks -------------------------------------------------------------
async function tasksRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("tasks");

  if (req.method === "GET") {
    const status = req.search.get("status");
    const category = req.search.get("category");
    const priority = req.search.get("priority");
    let visible = items.filter((i) => i.deletedAt == null);
    if (status) visible = visible.filter((i) => i.status === status);
    if (category) visible = visible.filter((i) => i.category === category);
    if (priority) visible = visible.filter((i) => i.priority === priority);

    const projects = db.getCollection("projects");
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    visible.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 99;
      const pb = priorityOrder[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    const data = visible.map((t) => ({
      ...t,
      project: projects.find((p) => p.id === t.projectId) || null,
    }));

    const stats = {
      total: visible.length,
      todo: visible.filter((t) => t.status === "todo").length,
      doing: visible.filter((t) => t.status === "doing").length,
      done: visible.filter((t) => t.status === "done").length,
      high: visible.filter((t) => t.priority === "high").length,
      overdue: visible.filter(
        (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()
      ).length,
    };
    return ok(data, { stats });
  }

  if (req.method === "POST") {
    if (!req.body?.title) return fail("العنوان مطلوب", 400);
    const payload = {
      title: req.body.title,
      description: req.body.description || null,
      status: req.body.status || "todo",
      priority: req.body.priority || "medium",
      category: req.body.category || "general",
      dueDate: req.body.dueDate ? new Date(req.body.dueDate).toISOString() : null,
      projectId: req.body.projectId || null,
      deletedAt: null,
    };
    const created = db.insert("tasks", payload);
    db.logActivity("create", "task", `أضيف مهمة: ${created.title}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.dueDate) patch.dueDate = new Date(patch.dueDate).toISOString();
    const updated = db.update("tasks", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    const force = req.search.get("force") === "true";
    if (!id) return fail("المعرف مطلوب", 400);
    if (force) db.remove("tasks", id);
    else db.softDelete("tasks", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/events ------------------------------------------------------------
async function eventsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("events");

  if (req.method === "GET") {
    const from = req.search.get("from");
    const to = req.search.get("to");
    let visible = items.filter((i) => i.deletedAt == null);
    if (from) {
      const f = new Date(from).getTime();
      visible = visible.filter((i) => new Date(i.startDate).getTime() >= f);
    }
    if (to) {
      const t = new Date(to).getTime();
      visible = visible.filter((i) => new Date(i.startDate).getTime() <= t);
    }
    visible.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return ok(visible);
  }

  if (req.method === "POST") {
    if (!req.body?.title || !req.body?.startDate) return fail("العنوان وتاريخ البدء مطلوبان", 400);
    const payload = {
      title: req.body.title,
      description: req.body.description || null,
      startDate: new Date(req.body.startDate).toISOString(),
      endDate: req.body.endDate ? new Date(req.body.endDate).toISOString() : null,
      allDay: req.body.allDay || false,
      type: req.body.type || "personal",
      color: req.body.color || "emerald",
      location: req.body.location || null,
      deletedAt: null,
    };
    const created = db.insert("events", payload);
    db.logActivity("create", "event", `أضيف حدث: ${created.title}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.startDate) patch.startDate = new Date(patch.startDate).toISOString();
    if (patch.endDate) patch.endDate = new Date(patch.endDate).toISOString();
    const updated = db.update("events", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    const force = req.search.get("force") === "true";
    if (!id) return fail("المعرف مطلوب", 400);
    if (force) db.remove("events", id);
    else db.softDelete("events", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/expenses ----------------------------------------------------------
async function expensesRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("expenses");

  if (req.method === "GET") {
    const category = req.search.get("category");
    const from = req.search.get("from");
    const to = req.search.get("to");
    let visible = items.filter((i) => i.deletedAt == null);
    if (category) visible = visible.filter((i) => i.category === category);
    if (from) {
      const f = new Date(from).getTime();
      visible = visible.filter((i) => new Date(i.date).getTime() >= f);
    }
    if (to) {
      const t = new Date(to).getTime();
      visible = visible.filter((i) => new Date(i.date).getTime() <= t);
    }
    visible.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalSYP = visible.filter((e) => e.currency === "syp").reduce((s, e) => s + e.amount, 0);
    const totalUSD = visible.filter((e) => e.currency === "usd").reduce((s, e) => s + e.amount, 0);

    const byCategory: Record<string, { syp: number; usd: number; count: number }> = {};
    for (const e of visible) {
      if (!byCategory[e.category]) byCategory[e.category] = { syp: 0, usd: 0, count: 0 };
      if (e.currency === "syp") byCategory[e.category].syp += e.amount;
      else byCategory[e.category].usd += e.amount;
      byCategory[e.category].count++;
    }

    return ok(visible, {
      stats: { totalSYP, totalUSD, count: visible.length, byCategory },
    });
  }

  if (req.method === "POST") {
    if (!req.body?.amount) return fail("المبلغ مطلوب", 400);
    const payload = {
      amount: Number(req.body.amount),
      currency: req.body.currency || "syp",
      category: req.body.category || "general",
      description: req.body.description || null,
      date: req.body.date ? new Date(req.body.date).toISOString() : nowISO(),
      deletedAt: null,
    };
    const created = db.insert("expenses", payload);
    db.logActivity("create", "expense", `تسجيل مصروف: ${payload.amount} ${payload.currency}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.amount !== undefined) patch.amount = Number(patch.amount);
    if (patch.date) patch.date = new Date(patch.date).toISOString();
    const updated = db.update("expenses", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    const force = req.search.get("force") === "true";
    if (!id) return fail("المعرف مطلوب", 400);
    if (force) db.remove("expenses", id);
    else db.softDelete("expenses", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/accounts ----------------------------------------------------------
async function accountsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("accounts");

  if (req.method === "GET") {
    const sorted = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const totalSYP = sorted.filter((a) => a.currency === "syp").reduce((s, a) => s + a.balance, 0);
    const totalUSD = sorted.filter((a) => a.currency === "usd").reduce((s, a) => s + a.balance, 0);
    return ok(sorted, { stats: { totalSYP, totalUSD, count: sorted.length } });
  }

  if (req.method === "POST") {
    if (!req.body?.name) return fail("الاسم مطلوب", 400);
    const created = db.insert("accounts", {
      name: req.body.name,
      balance: Number(req.body.balance) || 0,
      currency: req.body.currency || "syp",
      type: req.body.type || "bank",
      institution: req.body.institution || null,
    });
    db.logActivity("create", "account", `أضيف حساب: ${created.name}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.balance !== undefined) patch.balance = Number(patch.balance);
    const updated = db.update("accounts", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.remove("accounts", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/projects ----------------------------------------------------------
async function projectsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("projects");
  const tasks = db.getCollection("tasks");

  if (req.method === "GET") {
    let visible = items.filter((i) => i.deletedAt == null);
    visible.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const data = visible.map((p) => ({
      ...p,
      _count: { tasks: tasks.filter((t) => t.projectId === p.id && t.deletedAt == null).length },
    }));
    const stats = {
      total: visible.length,
      active: visible.filter((p) => p.status === "active").length,
      completed: visible.filter((p) => p.status === "completed").length,
      paused: visible.filter((p) => p.status === "paused").length,
      avgProgress: visible.length
        ? Math.round(visible.reduce((s, p) => s + p.progress, 0) / visible.length)
        : 0,
    };
    return ok(data, { stats });
  }

  if (req.method === "POST") {
    if (!req.body?.name) return fail("الاسم مطلوب", 400);
    const created = db.insert("projects", {
      name: req.body.name,
      description: req.body.description || null,
      status: req.body.status || "active",
      color: req.body.color || "emerald",
      progress: Number(req.body.progress) || 0,
      startDate: req.body.startDate ? new Date(req.body.startDate).toISOString() : null,
      endDate: req.body.endDate ? new Date(req.body.endDate).toISOString() : null,
      deletedAt: null,
    });
    db.logActivity("create", "project", `أضيف مشروع: ${created.name}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.progress !== undefined) patch.progress = Number(patch.progress);
    if (patch.startDate) patch.startDate = new Date(patch.startDate).toISOString();
    if (patch.endDate) patch.endDate = new Date(patch.endDate).toISOString();
    const updated = db.update("projects", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    const force = req.search.get("force") === "true";
    if (!id) return fail("المعرف مطلوب", 400);
    if (force) db.remove("projects", id);
    else db.softDelete("projects", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/meetings ----------------------------------------------------------
async function meetingsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("meetings");

  if (req.method === "GET") {
    let visible = items.filter((i) => i.deletedAt == null);
    visible.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const now = new Date();
    const stats = {
      total: visible.length,
      upcoming: visible.filter((m) => new Date(m.startDate) > now && m.status === "scheduled").length,
      completed: visible.filter((m) => m.status === "completed").length,
      cancelled: visible.filter((m) => m.status === "cancelled").length,
    };
    return ok(visible, { stats });
  }

  if (req.method === "POST") {
    if (!req.body?.title || !req.body?.startDate) return fail("العنوان والتاريخ مطلوبان", 400);
    const created = db.insert("meetings", {
      title: req.body.title,
      agenda: req.body.agenda || null,
      notes: req.body.notes || null,
      location: req.body.location || null,
      participants: req.body.participants || null,
      startDate: new Date(req.body.startDate).toISOString(),
      endDate: req.body.endDate ? new Date(req.body.endDate).toISOString() : null,
      status: req.body.status || "scheduled",
      deletedAt: null,
    });
    db.logActivity("create", "meeting", `أضيف اجتماع: ${created.title}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.startDate) patch.startDate = new Date(patch.startDate).toISOString();
    if (patch.endDate) patch.endDate = new Date(patch.endDate).toISOString();
    const updated = db.update("meetings", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    const force = req.search.get("force") === "true";
    if (!id) return fail("المعرف مطلوب", 400);
    if (force) db.remove("meetings", id);
    else db.softDelete("meetings", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/occasions ---------------------------------------------------------
const occasionsHandler = crudHandler({
  collection: "occasions",
  orderBy: (items) => items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  validateCreate: (b) => (!b?.title || !b?.date ? "العنوان والتاريخ مطلوبان" : null),
  createPayload: (b) => ({
    title: b.title,
    date: new Date(b.date).toISOString(),
    type: b.type || "birthday",
    recurring: b.recurring !== undefined ? b.recurring : true,
    note: b.note || null,
  }),
  transformUpdate: (rest) => {
    const patch = { ...rest };
    if (patch.date) patch.date = new Date(patch.date).toISOString();
    return patch;
  },
  createStatus: 201,
});

// ---- /api/diary -------------------------------------------------------------
async function diaryRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("diaryEntries");

  if (req.method === "GET") {
    let visible = items.filter((i) => i.deletedAt == null);
    visible.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return ok(visible);
  }

  if (req.method === "POST") {
    if (!req.body?.content) return fail("المحتوى مطلوب", 400);
    const created = db.insert("diaryEntries", {
      title: req.body.title,
      content: req.body.content,
      mood: req.body.mood || "neutral",
      weather: req.body.weather,
      date: req.body.date ? new Date(req.body.date).toISOString() : nowISO(),
      deletedAt: null,
    });
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.date) patch.date = new Date(patch.date).toISOString();
    const updated = db.update("diaryEntries", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.softDelete("diaryEntries", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/locations ---------------------------------------------------------
async function locationsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("savedLocations");

  if (req.method === "GET") {
    const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok(sorted);
  }

  if (req.method === "POST") {
    const b = req.body || {};
    if (!b?.name || b.lat === undefined || b.lng === undefined) return fail("الاسم والإحداثيات مطلوبة", 400);
    const created = db.insert("savedLocations", {
      name: b.name,
      address: b.address || "",
      lat: Number(b.lat),
      lng: Number(b.lng),
      icon: b.icon || "MapPin",
      color: b.color || "blue",
    });
    return ok(created, undefined, 201);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.remove("savedLocations", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/pantry ------------------------------------------------------------
async function pantryRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("pantryItems");

  if (req.method === "GET") {
    const lowOnly = req.search.get("low") === "true";
    const sorted = [...items].sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name, "ar");
    });
    const filtered = lowOnly ? sorted.filter((i) => i.quantity <= i.lowStock) : sorted;
    return ok(filtered, {
      stats: {
        count: filtered.length,
        totalItems: items.length,
        lowStockCount: items.filter((i) => i.quantity <= i.lowStock).length,
      },
    });
  }

  if (req.method === "POST") {
    if (!req.body?.name) return fail("الاسم مطلوب", 400);
    const created = db.insert("pantryItems", {
      name: req.body.name,
      quantity: Number(req.body.quantity) || 1,
      unit: req.body.unit || "piece",
      lowStock: Number(req.body.lowStock) || 1,
      category: req.body.category || "other",
    });
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, quantity, lowStock, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch: Record<string, unknown> = { ...rest };
    if (quantity !== undefined) patch.quantity = Number(quantity);
    if (lowStock !== undefined) patch.lowStock = Number(lowStock);
    const updated = db.update("pantryItems", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.remove("pantryItems", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/waiting-list ------------------------------------------------------
async function waitingListRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("waitingItems");

  if (req.method === "GET") {
    const readyOnly = req.search.get("ready") === "true";
    const pendingOnly = req.search.get("pending") === "true";
    let visible = [...items];
    if (readyOnly) visible = visible.filter((i) => i.ready);
    else if (pendingOnly) visible = visible.filter((i) => !i.ready);
    visible.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return ok(visible, {
      meta: {
        count: visible.length,
        ready: visible.filter((i) => i.ready).length,
        pending: visible.filter((i) => !i.ready).length,
      },
    });
  }

  if (req.method === "POST") {
    if (!req.body?.title) return fail("العنوان مطلوب", 400);
    const created = db.insert("waitingItems", {
      title: req.body.title,
      description: req.body.description || null,
      priority: req.body.priority !== undefined ? Number(req.body.priority) : 0,
      ready: req.body.ready !== undefined ? Boolean(req.body.ready) : false,
    });
    db.logActivity("create", "waiting_item", `تمت إضافة عنصر لقائمة الانتظار: ${created.title}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ready, priority, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch: Record<string, unknown> = { ...rest };
    if (ready !== undefined) patch.ready = Boolean(ready);
    if (priority !== undefined) patch.priority = Number(priority);
    const updated = db.update("waitingItems", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    if (ready !== undefined) {
      db.logActivity("toggle", "waiting_item", `${ready ? "تمييز كجاهز" : "تمييز كغير جاهز"}: ${updated.title}`);
    } else {
      db.logActivity("update", "waiting_item", `تم تحديث عنصر: ${updated.title}`);
    }
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    const item = db.findById("waitingItems", id);
    db.remove("waitingItems", id);
    if (item) db.logActivity("delete", "waiting_item", `تم حذف عنصر: ${item.title}`);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/integrations ------------------------------------------------------
const VALID_SERVICES = [
  "google_calendar",
  "google_drive",
  "telegram",
  "email",
  "github",
  "google_contacts",
  "cloud_sync",
];

async function integrationsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("integrations");

  if (req.method === "GET") {
    const sorted = [...items].sort((a, b) => a.service.localeCompare(b.service));
    return ok(sorted, {
      meta: {
        count: sorted.length,
        connected: sorted.filter((i) => i.connected).length,
        availableServices: VALID_SERVICES,
      },
    });
  }

  if (req.method === "POST") {
    const b = req.body || {};
    if (!b.service) return fail("الخدمة مطلوبة", 400);
    if (!VALID_SERVICES.includes(b.service)) {
      return fail(`خدمة غير مدعومة. الخدمات المتاحة: ${VALID_SERVICES.join(", ")}`, 400);
    }
    const configString =
      b.config === undefined || b.config === null
        ? null
        : typeof b.config === "string"
        ? b.config
        : JSON.stringify(b.config);
    const lastSync = b.lastSync ? new Date(b.lastSync).toISOString() : null;

    if (b.id) {
      const updated = db.update("integrations", b.id, {
        service: b.service,
        name: b.name || b.service,
        connected: b.connected !== undefined ? Boolean(b.connected) : undefined,
        config: configString,
        lastSync,
      });
      if (updated) db.logActivity("update", "integration", `تم تحديث تكامل: ${updated.name} (${b.service})`);
      return ok(updated);
    }

    const existing = items.find((i) => i.service === b.service);
    let integration: any;
    if (existing) {
      integration = db.update("integrations", existing.id, {
        name: b.name || existing.name,
        connected: b.connected !== undefined ? Boolean(b.connected) : existing.connected,
        config: configString !== null ? configString : existing.config,
        lastSync: lastSync || existing.lastSync,
      });
      db.logActivity("update", "integration", `تم تحديث تكامل: ${integration?.name} (${b.service})`);
    } else {
      integration = db.insert("integrations", {
        service: b.service,
        name: b.name || b.service,
        connected: b.connected !== undefined ? Boolean(b.connected) : false,
        config: configString,
        lastSync,
      });
      db.logActivity("create", "integration", `تمت إضافة تكامل: ${integration.name} (${b.service})`);
    }
    return ok(integration, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, connected, lastSync } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch: Record<string, unknown> = {};
    if (connected !== undefined) patch.connected = Boolean(connected);
    if (lastSync !== undefined) patch.lastSync = lastSync ? new Date(lastSync).toISOString() : null;
    else if (connected === true) patch.lastSync = nowISO();
    const updated = db.update("integrations", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    db.logActivity("toggle", "integration", `${updated.connected ? "ربط" : "فصل"} تكامل: ${updated.name} (${updated.service})`);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    const item = db.findById("integrations", id);
    db.remove("integrations", id);
    if (item) db.logActivity("delete", "integration", `تم حذف تكامل: ${item.name} (${item.service})`);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/automation --------------------------------------------------------
async function automationRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("automationRules");

  if (req.method === "GET") {
    const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok(sorted);
  }

  if (req.method === "POST") {
    const b = req.body || {};
    if (!b.name || !b.trigger || !b.action) return fail("الاسم، المحفّز، والإجراء مطلوبة", 400);
    const created = db.insert("automationRules", {
      name: b.name,
      trigger: b.trigger,
      action: b.action,
      config: b.config ? (typeof b.config === "string" ? b.config : JSON.stringify(b.config)) : null,
      active: b.active !== undefined ? Boolean(b.active) : true,
    });
    db.logActivity("create", "automation", `أضيف قاعدة أتمتة: ${created.name}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.config && typeof patch.config !== "string") patch.config = JSON.stringify(patch.config);
    if (patch.active !== undefined) patch.active = Boolean(patch.active);
    const updated = db.update("automationRules", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.remove("automationRules", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/scheduled-messages ------------------------------------------------
async function scheduledMessagesRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("scheduledMessages");

  if (req.method === "GET") {
    let visible = items.filter((i) => i.deletedAt == null);
    visible.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return ok(visible);
  }

  if (req.method === "POST") {
    const b = req.body || {};
    if (!b.recipient || !b.message || !b.scheduledAt) return fail("المستلم، الرسالة، والوقت مطلوبة", 400);
    const created = db.insert("scheduledMessages", {
      recipient: b.recipient,
      message: b.message,
      channel: b.channel || "whatsapp",
      scheduledAt: new Date(b.scheduledAt).toISOString(),
      sent: false,
      sentAt: null,
      deletedAt: null,
    });
    db.logActivity("create", "scheduled_message", `جدولة رسالة إلى ${b.recipient}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const patch = { ...rest };
    if (patch.scheduledAt) patch.scheduledAt = new Date(patch.scheduledAt).toISOString();
    const updated = db.update("scheduledMessages", id, patch);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    const force = req.search.get("force") === "true";
    if (!id) return fail("المعرف مطلوب", 400);
    if (force) db.remove("scheduledMessages", id);
    else db.softDelete("scheduledMessages", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/suggestions -------------------------------------------------------
async function suggestionsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("suggestions");

  if (req.method === "GET") {
    const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok(sorted);
  }

  if (req.method === "POST") {
    if (!req.body?.title) return fail("العنوان مطلوب", 400);
    const created = db.insert("suggestions", {
      title: req.body.title,
      content: req.body.content || "",
      category: req.body.category || "general",
      status: "pending",
    });
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, status } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const updated = db.update("suggestions", id, { status: status || "pending" });
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.remove("suggestions", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/activity ----------------------------------------------------------
async function activityRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("activityLogs");

  if (req.method === "GET") {
    const limit = Number(req.search.get("limit") || 100);
    const entity = req.search.get("entity");
    let visible = [...items];
    if (entity) visible = visible.filter((i) => i.entity === entity);
    visible.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    visible = visible.slice(0, limit);
    return ok(visible, { count: visible.length });
  }

  if (req.method === "DELETE") {
    const before = req.search.get("before");
    if (before) {
      const cutoff = new Date(before).getTime();
      const kept = items.filter((i) => new Date(i.createdAt).getTime() >= cutoff);
      db.setCollection("activityLogs", kept);
    } else {
      db.setCollection("activityLogs", []);
    }
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/dashboard ---------------------------------------------------------
async function dashboardRoute(req: ParsedRequest): Promise<Response> {
  if (req.method !== "GET") return fail("الطريقة غير مدعومة", 405);

  const today = startOfToday();
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const events = db.getCollection("events");
  const todayEvents = events
    .filter((e) => {
      const sd = new Date(e.startDate);
      return sd >= today && sd <= todayEnd;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const tasks = db.getCollection("tasks").filter((t) => t.deletedAt == null);
  const pendingTasks = tasks.filter((t) => t.status !== "done").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const byCategoryMap: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status === "done") continue;
    byCategoryMap[t.category] = (byCategoryMap[t.category] || 0) + 1;
  }
  const tasksByCategory = Object.entries(byCategoryMap).map(([category, count]) => ({
    category,
    _count: count,
  }));

  const contacts = db.getCollection("contacts").filter((c) => c.deletedAt == null);
  const assets = db.getCollection("assets");
  const totalAssetsValue = assets.reduce((s, a) => s + a.amount, 0);

  const occasions = db
    .getCollection("occasions")
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingHolidays: Holiday[] = getUpcomingHolidays(5);
  const todayHoliday = isHoliday(today);

  const recentCalls = db
    .getCollection("callLogs")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return ok({
    todayEvents,
    taskStats: {
      pending: pendingTasks,
      done: doneTasks,
      total: pendingTasks + doneTasks,
      byCategory: tasksByCategory,
    },
    contactStats: {
      total: contacts.length,
      favorites: contacts.filter((c) => c.favorite).length,
    },
    assets,
    totalAssetsValue,
    occasions,
    upcomingHolidays,
    todayHoliday,
    recentCalls,
  });
}

// ---- /api/finances ----------------------------------------------------------
async function financesRoute(req: ParsedRequest): Promise<Response> {
  if (req.method !== "GET") return fail("الطريقة غير مدعومة", 405);

  const assets = db.getCollection("assets");
  const accounts = db.getCollection("accounts");
  const debts = db
    .getCollection("debts")
    .filter((d) => !d.settled && d.deletedAt == null);
  const expenses = db.getCollection("expenses").filter((e) => e.deletedAt == null);
  const budgets = db.getCollection("budgets");

  const totalAssets = assets.reduce((s, a) => s + toSYP(a.amount, a.currency), 0);
  const totalAccounts = accounts.reduce((s, a) => s + toSYP(a.balance, a.currency), 0);
  const totalOwed = debts
    .filter((d) => d.type === "owed")
    .reduce((s, d) => s + toSYP(d.amount, d.currency), 0);
  const totalOwe = debts
    .filter((d) => d.type === "owe")
    .reduce((s, d) => s + toSYP(d.amount, d.currency), 0);
  const netWorth = totalAssets + totalAccounts + totalOwed - totalOwe;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthExpenses = expenses.filter((e) => new Date(e.date) >= monthStart);
  const monthSpend = monthExpenses.reduce((s, e) => s + toSYP(e.amount, e.currency), 0);

  return ok({
    assets,
    accounts,
    debts,
    budgets,
    totalAssets,
    totalAccounts,
    totalOwed,
    totalOwe,
    netWorth,
    monthSpend,
    monthExpenseCount: monthExpenses.length,
  });
}

// ---- /api/health ------------------------------------------------------------
async function healthRoute(req: ParsedRequest): Promise<Response> {
  if (req.method === "GET") {
    const medications = db
      .getCollection("medications")
      .filter((m) => m.deletedAt == null)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    const sleepLogs = db
      .getCollection("sleepLogs")
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 14);

    const avgSleep = sleepLogs.length
      ? Math.round(sleepLogs.reduce((s, l) => s + l.duration, 0) / sleepLogs.length)
      : 0;
    const qualityMap: Record<string, number> = { poor: 1, fair: 2, good: 3, excellent: 4 };
    const avgQuality = sleepLogs.length
      ? sleepLogs.reduce((s, l) => s + (qualityMap[l.quality] || 2), 0) / sleepLogs.length
      : 0;

    return ok(
      { medications, sleepLogs },
      {
        stats: {
          medicationsActive: medications.filter((m) => m.active).length,
          avgSleepMinutes: avgSleep,
          avgSleepHours: +(avgSleep / 60).toFixed(1),
          avgQuality: +avgQuality.toFixed(1),
          sleepLogsCount: sleepLogs.length,
        },
      }
    );
  }

  if (req.method === "POST") {
    const { type, ...data } = req.body || {};
    if (type === "medication") {
      if (!data.name) return fail("الاسم مطلوب", 400);
      const created = db.insert("medications", {
        name: data.name,
        dosage: data.dosage || null,
        frequency: data.frequency || "daily",
        startDate: data.startDate ? new Date(data.startDate).toISOString() : nowISO(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
        notes: data.notes || null,
        active: true,
        deletedAt: null,
      });
      db.logActivity("create", "medication", `أضيف دواء: ${created.name}`);
      return ok(created, undefined, 201);
    }
    if (type === "sleep") {
      const d = data.date ? new Date(data.date) : new Date();
      d.setHours(0, 0, 0, 0);
      const bt = data.bedtime ? new Date(data.bedtime) : null;
      const wt = data.wakeTime ? new Date(data.wakeTime) : null;
      const duration = bt && wt ? Math.round((wt.getTime() - bt.getTime()) / 60000) : 0;
      const created = db.insert("sleepLogs", {
        date: d.toISOString(),
        bedtime: bt ? bt.toISOString() : null,
        wakeTime: wt ? wt.toISOString() : null,
        duration,
        quality: data.quality || "good",
        note: data.note || null,
      });
      return ok(created, undefined, 201);
    }
    return fail("نوع غير معروف", 400);
  }

  if (req.method === "PUT") {
    const { type, id, ...data } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    if (type === "medication") {
      const patch = { ...data };
      if (patch.startDate) patch.startDate = new Date(patch.startDate).toISOString();
      if (patch.endDate) patch.endDate = new Date(patch.endDate).toISOString();
      const updated = db.update("medications", id, patch);
      if (!updated) return fail("العنصر غير موجود", 404);
      return ok(updated);
    }
    return fail("نوع غير معروف", 400);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    const type = req.search.get("type");
    if (!id) return fail("المعرف مطلوب", 400);
    if (type === "medication") db.softDelete("medications", id);
    else if (type === "sleep") db.remove("sleepLogs", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/habits ------------------------------------------------------------
function computeStreak(logs: Array<{ date: string }>): number {
  if (!logs.length) return 0;
  const sorted = logs
    .map((l) => {
      const d = new Date(l.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
    .sort((a, b) => b - a);
  const today = startOfToday();
  let streak = 0;
  let cursor = today.getTime();
  if (sorted[0] !== cursor) {
    const yesterday = cursor - 86400000;
    if (sorted[0] !== yesterday) return 0;
    cursor = yesterday;
  }
  for (const ts of sorted) {
    if (ts === cursor) {
      streak++;
      cursor -= 86400000;
    } else if (ts < cursor) {
      break;
    }
  }
  return streak;
}

async function habitsRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("habits");

  if (req.method === "GET") {
    const today = startOfToday();
    const sorted = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const data = sorted.map((h) => {
      const logs = (h.logs || []).slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);
      const todayLog = logs.find((l: any) => {
        const ld = new Date(l.date);
        ld.setHours(0, 0, 0, 0);
        return ld.getTime() === today.getTime();
      });
      const streak = computeStreak(logs);
      const last7 = logs.filter((l: any) => {
        const ld = new Date(l.date);
        const diff = (today.getTime() - ld.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff < 7;
      }).length;
      return { ...h, logs, todayDone: !!todayLog, todayValue: todayLog?.value || 0, streak, last7Days: last7 };
    });
    const stats = {
      total: sorted.length,
      active: sorted.filter((h) => h.active).length,
      doneToday: data.filter((h) => h.todayDone).length,
      bestStreak: Math.max(0, ...data.map((h) => h.streak)),
    };
    return ok(data, { stats });
  }

  if (req.method === "POST") {
    if (!req.body?.name) return fail("الاسم مطلوب", 400);
    const created = db.insert("habits", {
      name: req.body.name,
      description: req.body.description || null,
      frequency: req.body.frequency || "daily",
      target: Number(req.body.target) || 1,
      color: req.body.color || "emerald",
      icon: req.body.icon || "CheckCircle",
      active: true,
      logs: [],
    });
    db.logActivity("create", "habit", `أضيف عادة: ${created.name}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, log, ...data } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    if (log !== undefined) {
      const habit = db.findById("habits", id);
      if (!habit) return fail("العنصر غير موجود", 404);
      const today = startOfToday();
      const logs: any[] = habit.logs || [];
      const existingIdx = logs.findIndex((l: any) => {
        const d = new Date(l.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
      if (existingIdx >= 0) {
        logs.splice(existingIdx, 1);
        db.update("habits", id, { logs });
        return ok({ logged: false });
      }
      logs.push({
        id: genId(),
        habitId: id,
        date: today.toISOString(),
        value: 1,
        note: "",
        createdAt: today.toISOString(),
      });
      db.update("habits", id, { logs });
      return ok({ logged: true });
    }
    const updated = db.update("habits", id, data);
    if (!updated) return fail("العنصر غير موجود", 404);
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.remove("habits", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/contact-reminders -------------------------------------------------
function computeNextReminder(lastContacted: string | null, frequency: string): string | null {
  const base = lastContacted ? new Date(lastContacted) : new Date();
  const next = new Date(base);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next.toISOString();
}

async function contactRemindersRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("contactReminders");

  if (req.method === "GET") {
    const activeOnly = req.search.get("active") !== "false";
    const dueOnly = req.search.get("due") === "true";
    let visible = [...items];
    if (activeOnly) visible = visible.filter((r) => r.active);
    if (dueOnly) visible = visible.filter((r) => r.nextReminder && new Date(r.nextReminder) <= new Date());
    visible.sort((a, b) => new Date(a.nextReminder).getTime() - new Date(b.nextReminder).getTime());

    const now = new Date();
    const data = visible.map((r) => {
      const nextReminder = r.nextReminder ? new Date(r.nextReminder) : null;
      const overdue = nextReminder !== null && nextReminder.getTime() < now.getTime();
      const daysUntilDue = nextReminder
        ? Math.ceil((nextReminder.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return { ...r, overdue, daysUntilDue };
    });
    return ok(data, {
      meta: { count: data.length, overdue: data.filter((r) => r.overdue).length },
    });
  }

  if (req.method === "POST") {
    const b = req.body || {};
    if (!b.contactName) return fail("اسم جهة الاتصال مطلوب", 400);
    const freq = ["daily", "weekly", "monthly"].includes(b.frequency) ? b.frequency : "weekly";
    const lastContacted = b.lastContacted ? new Date(b.lastContacted).toISOString() : null;
    const nextReminder = b.nextReminder
      ? new Date(b.nextReminder).toISOString()
      : computeNextReminder(lastContacted, freq);
    const created = db.insert("contactReminders", {
      contactId: b.contactId || null,
      contactName: b.contactName,
      frequency: freq,
      lastContacted,
      nextReminder,
      active: b.active !== undefined ? Boolean(b.active) : true,
    });
    db.logActivity("create", "contact_reminder", `تمت إضافة تذكير تواصل لـ: ${b.contactName}`);
    return ok(created, undefined, 201);
  }

  if (req.method === "PUT") {
    const { id, lastContacted, frequency, nextReminder, active, ...rest } = req.body || {};
    if (!id) return fail("المعرف مطلوب", 400);
    const existing = db.findById("contactReminders", id);
    if (!existing) return fail("العنصر غير موجود", 404);
    const patch: Record<string, unknown> = { ...rest };
    if (active !== undefined) patch.active = Boolean(active);
    if (frequency !== undefined) patch.frequency = ["daily", "weekly", "monthly"].includes(frequency) ? frequency : "weekly";
    if (lastContacted !== undefined) {
      patch.lastContacted = lastContacted ? new Date(lastContacted).toISOString() : null;
      const freq = (patch.frequency as string) || existing.frequency || "weekly";
      patch.nextReminder = nextReminder
        ? new Date(nextReminder).toISOString()
        : computeNextReminder(
            patch.lastContacted as string | null,
            freq
          );
    } else if (nextReminder !== undefined) {
      patch.nextReminder = nextReminder ? new Date(nextReminder).toISOString() : null;
    }
    const updated = db.update("contactReminders", id, patch);
    if (lastContacted !== undefined) {
      db.logActivity("update", "contact_reminder", `تم تحديث آخر تواصل مع: ${updated?.contactName}`);
    } else if (active !== undefined) {
      db.logActivity("toggle", "contact_reminder", `${active ? "تفعيل" : "تعطيل"} تذكير: ${updated?.contactName}`);
    }
    return ok(updated);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    const item = db.findById("contactReminders", id);
    db.remove("contactReminders", id);
    if (item) db.logActivity("delete", "contact_reminder", `تم حذف تذكير تواصل لـ: ${item.contactName}`);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/happiness ---------------------------------------------------------
async function happinessRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("happinessLogs");

  if (req.method === "GET") {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    const logs = items
      .filter((l) => new Date(l.date) >= startDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const scores = logs.map((l) => l.score);
    const average = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;
    const factorSums: Record<string, number> = {};
    const factorCounts: Record<string, number> = {};
    logs.forEach((l) => {
      if (!l.factors) return;
      try {
        const parsed = JSON.parse(l.factors);
        Object.entries(parsed).forEach(([k, v]) => {
          if (typeof v === "number") {
            factorSums[k] = (factorSums[k] || 0) + v;
            factorCounts[k] = (factorCounts[k] || 0) + 1;
          }
        });
      } catch {
        /* ignore */
      }
    });
    const factorAverages: Record<string, number> = {};
    Object.keys(factorSums).forEach((k) => {
      factorAverages[k] = +(factorSums[k] / factorCounts[k]).toFixed(2);
    });
    return ok(logs, {
      stats: {
        count: logs.length,
        average,
        max: scores.length ? Math.max(...scores) : 0,
        min: scores.length ? Math.min(...scores) : 0,
        factorAverages,
      },
    });
  }

  if (req.method === "POST") {
    const { score, factors, note, date } = req.body || {};
    if (score === undefined) return fail("النتيجة مطلوبة (1-10)", 400);
    const finalScore = Math.max(1, Math.min(10, Number(score)));
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const factorsStr =
      factors && typeof factors === "object" ? JSON.stringify(factors) : factors || null;
    const existing = items.find((l) => {
      const d = new Date(l.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === targetDate.getTime();
    });
    let log: any;
    if (existing) {
      log = db.update("happinessLogs", existing.id, {
        score: finalScore,
        factors: factorsStr,
        note: note || null,
      });
    } else {
      log = db.insert("happinessLogs", {
        date: targetDate.toISOString(),
        score: finalScore,
        factors: factorsStr,
        note: note || null,
      });
    }
    return ok(log, undefined, 201);
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/quran -------------------------------------------------------------
const SURAHS = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس",
];

async function quranRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("quranLogs");

  if (req.method === "GET") {
    const logs = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalAyahs = logs.reduce((s, l) => s + (l.toAyah - l.fromAyah + 1), 0);
    const surahsRead = new Set(logs.map((l) => l.surah)).size;
    return ok(logs, {
      stats: { totalAyahs, surahsRead, sessions: logs.length, surahNames: SURAHS },
    });
  }

  if (req.method === "POST") {
    const { surah, fromAyah, toAyah, juz, note } = req.body || {};
    if (!surah || !fromAyah || !toAyah) return fail("السورة والآيات مطلوبة", 400);
    const created = db.insert("quranLogs", {
      surah: Number(surah),
      fromAyah: Number(fromAyah),
      toAyah: Number(toAyah),
      juz: juz ? Number(juz) : null,
      note,
      date: nowISO(),
    });
    return ok(created, undefined, 201);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.remove("quranLogs", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/budget ------------------------------------------------------------
async function budgetRoute(req: ParsedRequest): Promise<Response> {
  const items = db.getCollection("budgets");

  if (req.method === "GET") {
    const now = new Date();
    const m = req.search.get("month") ? Number(req.search.get("month")) : now.getMonth() + 1;
    const y = req.search.get("year") ? Number(req.search.get("year")) : now.getFullYear();
    const budgets = items.filter((b) => b.month === m && b.year === y);

    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
    const expenses = db
      .getCollection("expenses")
      .filter((e) => {
        const d = new Date(e.date);
        return d >= monthStart && d <= monthEnd && e.deletedAt == null;
      });

    const data = budgets.map((b) => {
      const spent = expenses
        .filter((e) => e.category === b.category)
        .reduce((s, e) => s + toSYP(e.amount, e.currency), 0);
      const percent = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
      return {
        ...b,
        spent,
        remaining: b.limit - spent,
        percent,
        status: percent >= 100 ? "exceeded" : percent >= 80 ? "warning" : "ok",
      };
    });

    const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
    const totalSpent = data.reduce((s, d) => s + d.spent, 0);
    return ok(data, {
      stats: {
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        percent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
        month: m,
        year: y,
      },
    });
  }

  if (req.method === "POST") {
    const { category, limit, month, year } = req.body || {};
    if (!category || !limit) return fail("الفئة والحد مطلوبان", 400);
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    const existing = items.find((b) => b.category === category && b.month === m && b.year === y);
    let budget: any;
    if (existing) {
      budget = db.update("budgets", existing.id, { limit: Number(limit) });
    } else {
      budget = db.insert("budgets", { category, limit: Number(limit), month: m, year: y });
    }
    return ok(budget, undefined, 201);
  }

  if (req.method === "DELETE") {
    const id = req.search.get("id");
    if (!id) return fail("المعرف مطلوب", 400);
    db.remove("budgets", id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/recycle-bin -------------------------------------------------------
const RECYCLE_TYPES: Record<string, string> = {
  contact: "contacts",
  note: "notes",
  task: "tasks",
  event: "events",
  expense: "expenses",
  debt: "debts",
  project: "projects",
  meeting: "meetings",
  diary: "diaryEntries",
  medication: "medications",
};

async function recycleBinRoute(req: ParsedRequest): Promise<Response> {
  if (req.method === "GET") {
    const grouped: Record<string, any[]> = {};
    let total = 0;
    for (const [type, collection] of Object.entries(RECYCLE_TYPES)) {
      const items = db
        .getCollection(collection)
        .filter((i) => i.deletedAt != null)
        .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
      grouped[type] = items;
      total += items.length;
    }
    return ok(grouped, { total });
  }

  if (req.method === "PUT") {
    const { type, id } = req.body || {};
    if (!type || !id) return fail("النوع والمعرف مطلوبان", 400);
    const collection = RECYCLE_TYPES[type];
    if (!collection) return fail("نوع غير معروف", 400);
    db.restore(collection, id);
    return json({ success: true });
  }

  if (req.method === "DELETE") {
    const type = req.search.get("type");
    const id = req.search.get("id");
    if (!type || !id) return fail("النوع والمعرف مطلوبان", 400);
    const collection = RECYCLE_TYPES[type];
    if (!collection) return fail("نوع غير معروف", 400);
    db.remove(collection, id);
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/analytics ---------------------------------------------------------
async function analyticsRoute(req: ParsedRequest): Promise<Response> {
  if (req.method !== "GET") return fail("الطريقة غير مدعومة", 405);

  const days = Number(req.search.get("days") || 30);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const expenses = db
    .getCollection("expenses")
    .filter((e) => new Date(e.date) >= since && e.deletedAt == null);
  const tasks = db.getCollection("tasks").filter((t) => t.deletedAt == null);
  const contacts = db.getCollection("contacts").filter((c) => c.deletedAt == null).length;
  const events = db.getCollection("events").filter((e) => e.deletedAt == null).length;
  const callLogs = db.getCollection("callLogs").length;
  const diary = db.getCollection("diaryEntries").filter((d) => d.deletedAt == null).length;
  const happiness = db.getCollection("happinessLogs").filter((h) => new Date(h.date) >= since);

  const byDay: Record<string, number> = {};
  for (const e of expenses) {
    const key = toISODate(new Date(e.date));
    byDay[key] = (byDay[key] || 0) + toSYP(e.amount, e.currency);
  }
  const spendingTrend = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, total]) => ({ date, total: Math.round(total) }));

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + toSYP(e.amount, e.currency);
  }
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, total]) => ({ category, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total);

  const taskStats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    todo: tasks.filter((t) => t.status === "todo").length,
    completionRate: tasks.length
      ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100)
      : 0,
  };

  const taskByCategory: Record<string, { total: number; done: number }> = {};
  for (const t of tasks) {
    if (!taskByCategory[t.category]) taskByCategory[t.category] = { total: 0, done: 0 };
    taskByCategory[t.category].total++;
    if (t.status === "done") taskByCategory[t.category].done++;
  }

  const happinessTrend = happiness
    .map((h) => ({ date: toISODate(new Date(h.date)), score: h.score }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const avgHappiness = happiness.length
    ? +(happiness.reduce((s, h) => s + h.score, 0) / happiness.length).toFixed(2)
    : 0;

  return ok({
    spendingTrend,
    categoryBreakdown,
    taskStats,
    taskByCategory,
    happinessTrend,
    overview: {
      totalExpenses: expenses.length,
      totalSpend: Math.round(expenses.reduce((s, e) => s + toSYP(e.amount, e.currency), 0)),
      contacts,
      events,
      callLogs,
      diary,
      avgHappiness,
    },
  });
}

// ---- /api/gamification ------------------------------------------------------
async function gamificationRoute(req: ParsedRequest): Promise<Response> {
  if (req.method !== "GET") return fail("الطريقة غير مدعومة", 405);

  const tasks = db.getCollection("tasks").filter((t) => t.deletedAt == null);
  const habits = db.getCollection("habits");
  const contacts = db.getCollection("contacts").filter((c) => c.deletedAt == null).length;
  const events = db.getCollection("events").filter((e) => e.deletedAt == null).length;
  const notes = db.getCollection("notes").filter((n) => n.deletedAt == null).length;

  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const points =
    doneTasks * 10 +
    habits.reduce((s, h) => s + (h.logs?.length || 0) * 5, 0) +
    contacts * 2 +
    events * 3 +
    notes * 4;
  const level = Math.floor(points / 100) + 1;
  const pointsInLevel = points % 100;
  const pointsToNext = 100 - pointsInLevel;

  const achievements = [
    { id: "first-task", name: "الخطوة الأولى", description: "أكمل أول مهمة", icon: "🎯", unlocked: doneTasks >= 1, progress: Math.min(doneTasks, 1) },
    { id: "task-master-10", name: "منجز المهام", description: "أكمل 10 مهام", icon: "🏆", unlocked: doneTasks >= 10, progress: Math.min(doneTasks, 10) },
    { id: "task-master-50", name: "أسطورة الإنجاز", description: "أكمل 50 مهمة", icon: "👑", unlocked: doneTasks >= 50, progress: Math.min(doneTasks, 50) },
    { id: "habit-7", name: "أسبوع مثالي", description: "حافظ على عادة 7 أيام", icon: "🔥", unlocked: habits.some((h) => (h.logs?.length || 0) >= 7), progress: Math.max(0, ...habits.map((h) => h.logs?.length || 0)) },
    { id: "habit-30", name: "شهر الالتزام", description: "حافظ على عادة 30 يوم", icon: "💎", unlocked: habits.some((h) => (h.logs?.length || 0) >= 30), progress: Math.max(0, ...habits.map((h) => h.logs?.length || 0)) },
    { id: "connector", name: "اجتماعي", description: "أضف 10 جهات اتصال", icon: "🤝", unlocked: contacts >= 10, progress: Math.min(contacts, 10) },
    { id: "organizer", name: "منظم", description: "أنشئ 5 أحداث", icon: "📅", unlocked: events >= 5, progress: Math.min(events, 5) },
    { id: "writer", name: "كاتب", description: "اكتب 10 ملاحظات", icon: "✍️", unlocked: notes >= 10, progress: Math.min(notes, 10) },
  ];

  const today = startOfToday();
  const habitStreaks = habits.map((h) => {
    const sorted = (h.logs || []).map((l: any) => new Date(l.date).getTime()).sort((a: number, b: number) => b - a);
    let streak = 0;
    let cursor = today.getTime();
    if (sorted[0] !== cursor) {
      const yesterday = cursor - 86400000;
      if (sorted[0] !== yesterday) return { habitId: h.id, name: h.name, streak: 0 };
      cursor = yesterday;
    }
    for (const ts of sorted) {
      if (ts === cursor) {
        streak++;
        cursor -= 86400000;
      } else if (ts < cursor) break;
    }
    return { habitId: h.id, name: h.name, streak };
  });

  return ok({
    points,
    level,
    pointsInLevel,
    pointsToNext,
    achievements,
    habitStreaks: habitStreaks.sort((a, b) => b.streak - a.streak).slice(0, 5),
    stats: {
      doneTasks,
      totalTasks: tasks.length,
      habitLogs: habits.reduce((s, h) => s + (h.logs?.length || 0), 0),
      contacts,
      events,
      notes,
    },
  });
}

// ---- /api/smart-notifications ----------------------------------------------
async function smartNotificationsRoute(req: ParsedRequest): Promise<Response> {
  if (req.method !== "GET") return fail("الطريقة غير مدعومة", 405);

  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const next7Days = new Date(now);
  next7Days.setDate(next7Days.getDate() + 7);

  const events = db.getCollection("events");
  const tasks = db.getCollection("tasks");
  const debts = db.getCollection("debts");
  const reminders = db.getCollection("contactReminders");
  const pantry = db.getCollection("pantryItems");
  const occasions = db.getCollection("occasions");

  const todayEvents = events
    .filter((e) => e.deletedAt == null && new Date(e.startDate) >= now && new Date(e.startDate) <= todayEnd)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const overdueTasks = tasks
    .filter((t) => t.deletedAt == null && t.status !== "done" && t.dueDate && new Date(t.dueDate) < now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const soonTasks = tasks
    .filter((t) => t.deletedAt == null && t.status !== "done" && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= next7Days)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const dueDebts = debts
    .filter((d) => d.deletedAt == null && !d.settled && d.dueDate && new Date(d.dueDate) <= next7Days)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const dueReminders = reminders
    .filter((r) => r.active && r.nextReminder && new Date(r.nextReminder) <= next7Days)
    .sort((a, b) => new Date(a.nextReminder).getTime() - new Date(b.nextReminder).getTime());
  const upcomingOccasions = occasions
    .filter((o) => new Date(o.date) >= now && new Date(o.date) <= next7Days)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const todayHoliday = isHoliday(now);

  const notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    severity: "info" | "warning" | "critical";
    createdAt: string;
  }> = [];

  for (const e of todayEvents) {
    notifications.push({
      id: `event-${e.id}`,
      type: "event",
      title: "حدث اليوم",
      message: `${e.title} في ${new Date(e.startDate).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}`,
      severity: "info",
      createdAt: e.startDate,
    });
  }

  for (const t of overdueTasks.slice(0, 5)) {
    const days = Math.ceil((now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    notifications.push({
      id: `task-overdue-${t.id}`,
      type: "task-overdue",
      title: "مهمة متأخرة",
      message: `"${t.title}" متأخرة بـ ${days} يوم`,
      severity: "critical",
      createdAt: t.dueDate,
    });
  }

  for (const t of soonTasks.slice(0, 5)) {
    const days = Math.ceil((new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    notifications.push({
      id: `task-soon-${t.id}`,
      type: "task-soon",
      title: "موعد نهائي قريب",
      message: `"${t.title}" خلال ${days} يوم`,
      severity: "warning",
      createdAt: t.dueDate,
    });
  }

  for (const d of dueDebts) {
    notifications.push({
      id: `debt-${d.id}`,
      type: "debt",
      title: "استحقاق دين",
      message: `دين ${d.personName} يستحق قريباً (${d.amount} ${d.currency})`,
      severity: "warning",
      createdAt: d.dueDate,
    });
  }

  for (const r of dueReminders.slice(0, 5)) {
    notifications.push({
      id: `reminder-${r.id}`,
      type: "reminder",
      title: "تذكير تواصل",
      message: `حان وقت التواصل مع ${r.contactName}`,
      severity: "info",
      createdAt: r.nextReminder,
    });
  }

  const lowStock = pantry.filter((p) => p.quantity <= p.lowStock);
  if (lowStock.length > 0) {
    notifications.push({
      id: `pantry-low`,
      type: "pantry",
      title: "مخزون منخفض",
      message: `${lowStock.length} عناصر بحاجة لإعادة التعبئة: ${lowStock.slice(0, 3).map((p) => p.name).join("، ")}${lowStock.length > 3 ? "..." : ""}`,
      severity: "warning",
      createdAt: now.toISOString(),
    });
  }

  for (const o of upcomingOccasions) {
    notifications.push({
      id: `occasion-${o.id}`,
      type: "occasion",
      title: "مناسبة قادمة",
      message: `${o.title} قريباً`,
      severity: "info",
      createdAt: o.date,
    });
  }

  if (todayHoliday) {
    notifications.unshift({
      id: `holiday-today`,
      type: "holiday",
      title: "عطلة اليوم",
      message: todayHoliday.name,
      severity: "info",
      createdAt: now.toISOString(),
    });
  }

  const upcoming = getUpcomingHolidays(3);
  for (const h of upcoming) {
    const days = Math.ceil((new Date(h.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 7) {
      notifications.push({
        id: `holiday-${h.date}`,
        type: "holiday",
        title: "عطلة قادمة",
        message: `${h.name} خلال ${days} يوم`,
        severity: "info",
        createdAt: h.date,
      });
    }
  }

  const stats = {
    total: notifications.length,
    critical: notifications.filter((n) => n.severity === "critical").length,
    warning: notifications.filter((n) => n.severity === "warning").length,
    info: notifications.filter((n) => n.severity === "info").length,
  };

  return ok(notifications, { stats });
}

// ---- /api/home --------------------------------------------------------------
async function homeRoute(req: ParsedRequest): Promise<Response> {
  if (req.method !== "GET") return fail("الطريقة غير مدعومة", 405);

  const pantry = [...db.getCollection("pantryItems")].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name, "ar");
  });
  const waitingList = [...db.getCollection("waitingItems")].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const lowStock = pantry.filter((p) => p.quantity <= p.lowStock);
  const byCategory: Record<string, number> = {};
  for (const p of pantry) byCategory[p.category] = (byCategory[p.category] || 0) + 1;

  return ok({
    pantry,
    waitingList,
    lowStock,
    stats: {
      totalItems: pantry.length,
      lowStockCount: lowStock.length,
      waitingReady: waitingList.filter((w) => w.ready).length,
      waitingPending: waitingList.filter((w) => !w.ready).length,
      byCategory,
    },
  });
}

// ---- /api/appearance --------------------------------------------------------
const APPEARANCE_KEYS = [
  "theme",
  "accent",
  "username",
  "pinEnabled",
  "pinCode",
  "city",
  "lat",
  "lng",
  "timezone",
  "exchangeRate",
  "aiApiKey",
  "aiModel",
  "aiBaseUrl",
] as const;

async function appearanceRoute(req: ParsedRequest): Promise<Response> {
  const settings = db.getCollection("appSettings");
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  if (req.method === "GET") {
    return ok({
      theme: map.theme || "dark",
      accent: map.accent || "emerald",
      username: map.username || "",
      pinEnabled: map.pinEnabled === "true",
      ...(map.pinCode ? { pinCode: map.pinCode } : {}),
      city: map.city || "حلب",
      lat: map.lat !== undefined ? Number(map.lat) : 36.2021,
      lng: map.lng !== undefined ? Number(map.lng) : 37.1343,
      timezone: map.timezone || "Asia/Damascus",
      exchangeRate:
        map.exchangeRate !== undefined ? Number(map.exchangeRate) : 12500,
      aiApiKey: map.aiApiKey || "2c7a65f8bee345fb80eee4575deb5bbf.3WE0RlXGJ2CZicJT",
      aiModel: map.aiModel || "glm-4.5-flash",
      aiBaseUrl: map.aiBaseUrl || "https://api.z.ai/api/paas/v4",
    });
  }

  if (req.method === "PUT") {
    const b = req.body || {};
    const updates: Array<[string, string]> = [];
    for (const key of APPEARANCE_KEYS) {
      if (b[key] === undefined) continue;
      const v = b[key];
      updates.push([key, typeof v === "string" ? v : String(v)]);
    }

    for (const [key, value] of updates) {
      const existing = settings.find((s) => s.key === key);
      if (existing) db.update("appSettings", existing.id, { value });
      else db.insert("appSettings", { key, value });
    }
    return json({ success: true });
  }

  return fail("الطريقة غير مدعومة", 405);
}

// ---- /api/weather -----------------------------------------------------------
async function weatherRoute(_req: ParsedRequest): Promise<Response> {
  // Read city/lat/lng from appSettings (with sensible defaults).
  const settingsMap: Record<string, string> = {};
  for (const s of db.getCollection("appSettings")) settingsMap[s.key] = s.value;
  const city = settingsMap.city || "حلب";
  const lat =
    settingsMap.lat !== undefined && settingsMap.lat !== ""
      ? Number(settingsMap.lat)
      : 36.2021;
  const lng =
    settingsMap.lng !== undefined && settingsMap.lng !== ""
      ? Number(settingsMap.lng)
      : 37.1343;
  const timezone = settingsMap.timezone || "Asia/Damascus";

  // Try live open-meteo data first; fall back to a static response if offline.
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
      `&timezone=${encodeURIComponent(timezone)}&forecast_days=5`;
    const realFetch = getOriginalFetch();
    const res = await realFetch(url);
    if (res.ok) {
      const data = await res.json();
      const weatherDescriptions: Record<number, { ar: string; icon: string }> = {
        0: { ar: "سماء صافية", icon: "Sun" },
        1: { ar: "صافي غالباً", icon: "Sun" },
        2: { ar: "غائم جزئياً", icon: "CloudSun" },
        3: { ar: "غائم", icon: "Cloud" },
        45: { ar: "ضباب", icon: "CloudFog" },
        48: { ar: "ضباب متجمد", icon: "CloudFog" },
        51: { ar: "رذاذ خفيف", icon: "CloudDrizzle" },
        53: { ar: "رذاذ متوسط", icon: "CloudDrizzle" },
        55: { ar: "رذاذ كثيف", icon: "CloudDrizzle" },
        61: { ar: "أمطار خفيفة", icon: "CloudRain" },
        63: { ar: "أمطار متوسطة", icon: "CloudRain" },
        65: { ar: "أمطار غزيرة", icon: "CloudRain" },
        71: { ar: "ثلوج خفيفة", icon: "CloudSnow" },
        73: { ar: "ثلوج متوسطة", icon: "CloudSnow" },
        75: { ar: "ثلوج كثيفة", icon: "CloudSnow" },
        80: { ar: "زخات مطر", icon: "CloudRain" },
        81: { ar: "زخات مطر قوية", icon: "CloudRain" },
        82: { ar: "زخات مطر عنيفة", icon: "CloudRainWind" },
        95: { ar: "عاصفة رعدية", icon: "CloudLightning" },
        96: { ar: "عاصفة رعدية مع بَرَد", icon: "CloudLightning" },
        99: { ar: "عاصفة رعدية شديدة", icon: "CloudLightning" },
      };
      const current = data.current;
      const info = weatherDescriptions[current.weather_code] || {
        ar: "غير معروف",
        icon: "Cloud",
      };
      const daily = data.daily;
      const forecast = daily.time.map((time: string, i: number) => ({
        date: time,
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i]),
        weatherCode: daily.weather_code[i],
        weather:
          weatherDescriptions[daily.weather_code[i]] || { ar: "—", icon: "Cloud" },
        sunrise: daily.sunrise[i],
        sunset: daily.sunset[i],
      }));
      return ok({
        current: {
          temperature: Math.round(current.temperature_2m),
          apparentTemperature: Math.round(current.apparent_temperature),
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          windDirection: current.wind_direction_10m,
          pressure: Math.round(current.pressure_msl),
          weatherCode: current.weather_code,
          weatherDescription: info.ar,
          weatherIcon: info.icon,
        },
        forecast,
        city,
        timezone,
      });
    }
  } catch (err) {
    // Offline — fall through to static fallback.
    console.warn("[local] weather fetch failed, using fallback:", err);
  }

  return ok({
    current: {
      temperature: 24,
      apparentTemperature: 24,
      humidity: 50,
      windSpeed: 10,
      weatherDescription: "سماء صافية",
      weatherIcon: "Sun",
    },
    forecast: [],
    city,
    timezone,
  });
}

// ---- /api/ai/chat -----------------------------------------------------------
async function aiChatRoute(req: ParsedRequest): Promise<Response> {
  if (req.method !== "POST") return fail("الطريقة غير مدعومة", 405);
  const { message, context } = req.body || {};
  if (!message) return fail("الرسالة مطلوبة", 400);

  // Read AI API key + model + base URL from appSettings.
  const settingsMap: Record<string, string> = {};
  for (const s of db.getCollection("appSettings")) settingsMap[s.key] = s.value;
  const apiKey = settingsMap.aiApiKey || "2c7a65f8bee345fb80eee4575deb5bbf.3WE0RlXGJ2CZicJT";
  const model = settingsMap.aiModel || "glm-4.5-flash";
  const baseUrl =
    settingsMap.aiBaseUrl || "https://api.z.ai/api/paas/v4";

  // If a real API key is set, attempt a real API call.
  if (apiKey) {
    try {
      // Dynamic system prompt — use the user's saved name from settings,
      // or a generic "المستخدم" if unset. Never hardcode a personal identity.
      const userName = settingsMap.username || "المستخدم";
      const systemPrompt =
        `أنت مساعد شخصي ذكي لمستخدم اسمه ${userName}. أجب بالعربية الفصحى المبسطة، كن مختصراً ومفيداً، واستخدم الرموز التعبيرية باعتدال.`;
      const realFetch = getOriginalFetch();
      const res = await realFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply) {
          return json({ success: true, response: reply });
        }
      }
      // API call failed — return a helpful error message
      const errBody = await res.text().catch(() => "");
      console.warn("[local] AI API call failed:", res.status, errBody);
      let errMsg = `فشل الاتصال بخدمة الذكاء الاصطناعي (HTTP ${res.status})`;
      if (res.status === 401 || res.status === 403) {
        errMsg = "مفتاح API غير صحيح أو غير مصرّح به. يرجى التحقق من المفتاح في الإعدادات.";
      } else if (res.status === 429) {
        errMsg = "تم تجاوز حد الطلبات. يرجى المحاولة لاحقاً.";
      } else if (res.status === 404) {
        errMsg = `لم يتم العثور على النموذج "${model}". تحقق من اسم النموذج في الإعدادات.`;
      }
      return json({ success: false, error: errMsg, response: errMsg });
    } catch (err: any) {
      console.warn("[local] AI API call error:", err);
      const errMsg = `تعذر الاتصال بخدمة الذكاء الاصطناعي: ${err.message || "خطأ في الشبكة"}. تحقق من اتصالك بالإنترنت.`;
      return json({ success: false, error: errMsg, response: errMsg });
    }
  }

  // No API key set → tell the user to configure it
  const ctxHint = context?.includeData
    ? " لاحظت أنك طلبت تضمين بياناتك، لكن يتطلب ذلك مفتاح API."
    : "";
  return json({
    success: true,
    response:
      `مرحباً! استلمت رسالتك: "${message}".` +
      ctxHint +
      " ⚠️ لم يتم ضبط مفتاح API بعد. للحصول على ردود ذكية متكاملة، يرجى الذهاب إلى الإعدادات → إعدادات الذكاء الاصطناعي وإدخال مفتاح API الخاص بك.",
  });
}

// ---- /api/ai-insights -------------------------------------------------------
async function aiInsightsRoute(req: ParsedRequest): Promise<Response> {
  if (req.method !== "GET") return fail("الطريقة غير مدعومة", 405);

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const expenses = db
    .getCollection("expenses")
    .filter((e) => new Date(e.date) >= thirtyDaysAgo && e.deletedAt == null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const tasks = db.getCollection("tasks").filter((t) => t.deletedAt == null);
  const budgets = db
    .getCollection("budgets")
    .filter((b) => b.month === currentMonth && b.year === currentYear);

  // Spending patterns (simplified)
  const byCategory: Record<string, { total: number; count: number }> = {};
  for (const e of expenses) {
    const value = toSYP(e.amount, e.currency);
    if (!byCategory[e.category]) byCategory[e.category] = { total: 0, count: 0 };
    byCategory[e.category].total += value;
    byCategory[e.category].count += 1;
  }
  const spendingPatterns = Object.entries(byCategory).map(([category, info]) => {
    const budget = budgets.find((b) => b.category === category);
    const percentOfBudget = budget && budget.limit > 0 ? Math.round((info.total / budget.limit) * 100) : null;
    let insight = "إنفاق مستقر";
    if (percentOfBudget !== null) {
      if (percentOfBudget >= 100) insight = `تجاوزت الميزانية المخصصة لهذه الفئة بمقدار ${percentOfBudget - 100}%`;
      else if (percentOfBudget >= 80) insight = `اقتربت من حد الميزانية (${percentOfBudget}%)`;
      else insight = `ضمن الميزانية (${percentOfBudget}% من الحد)`;
    }
    return {
      category,
      total: Math.round(info.total),
      count: info.count,
      average: Math.round(info.total / info.count),
      budget: budget ? budget.limit : null,
      percentOfBudget,
      trend: "stable" as const,
      insight,
    };
  }).sort((a, b) => b.total - a.total);

  // Task suggestions (simplified)
  const pending = tasks.filter((t) => t.status !== "done");
  const taskSuggestions: any[] = [];
  const overdue = pending.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  for (const t of overdue) {
    const daysLate = Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
    taskSuggestions.push({
      type: "overdue",
      title: `إنجاز المهمة المتأخرة: ${t.title}`,
      reason: `متأخرة بمقدار ${daysLate} يوم${t.priority === "high" ? " — ذات أولوية عالية" : ""}`,
      priority: t.priority === "high" ? "high" : "medium",
      relatedTaskId: t.id,
    });
  }
  for (const t of pending.filter((t) => t.priority === "high").slice(0, 5)) {
    taskSuggestions.push({
      type: "high_priority",
      title: `التركيز على: ${t.title}`,
      reason: "مهمة ذات أولوية عالية بانتظار الإنجاز",
      priority: "high",
      relatedTaskId: t.id,
    });
  }

  // Predictive alerts (simplified)
  const monthExpenses = expenses.filter((e) => new Date(e.date) >= monthStart);
  const totalSpentThisMonth = monthExpenses.reduce((s, e) => s + toSYP(e.amount, e.currency), 0);
  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const predictiveAlerts: any[] = [];
  if (totalBudget > 0 && totalSpentThisMonth > totalBudget) {
    predictiveAlerts.push({
      severity: "critical",
      type: "budget_exceeded",
      title: "تجاوز الميزانية الشهرية",
      message: `تجاوزت إجمالي الميزانية بمقدار ${Math.round(totalSpentThisMonth - totalBudget)} ل.س`,
    });
  }
  const overdueCount = overdue.length;
  if (overdueCount > 0) {
    predictiveAlerts.push({
      severity: "critical",
      type: "overdue_tasks",
      title: "مهام متأخرة",
      message: `لديك ${overdueCount} مهمة تجاوزت موعدها النهائي`,
    });
  }

  return ok(
    {
      spendingPatterns,
      taskSuggestions,
      bestTimes: [],
      predictiveAlerts,
    },
    {
      meta: {
        generatedAt: now.toISOString(),
        dataRange: {
          expensesFrom: thirtyDaysAgo.toISOString(),
          expensesTo: now.toISOString(),
        },
        counts: {
          expenses: expenses.length,
          tasks: tasks.length,
          budgets: budgets.length,
        },
      },
    }
  );
}

// ---- /api/sync/* ------------------------------------------------------------
async function syncOfflineRoute(_req: ParsedRequest): Promise<Response> {
  return json(
    { success: false, error: "المزامنة تتطلب اتصالاً بالإنترنت" },
    401
  );
}

// ----------------------------------------------------------------------------
// Routing
// ----------------------------------------------------------------------------

type RouteHandler = (req: ParsedRequest) => Promise<Response>;

interface RouteEntry {
  /** Exact pathname (without query). */
  path: string;
  handler: RouteHandler;
}

const ROUTES: RouteEntry[] = [
  { path: "/api/calllogs", handler: calllogsRoute },
  { path: "/api/contacts", handler: contactsRoute },
  { path: "/api/notes", handler: notesHandler },
  { path: "/api/tasks", handler: tasksRoute },
  { path: "/api/events", handler: eventsRoute },
  { path: "/api/expenses", handler: expensesRoute },
  { path: "/api/accounts", handler: accountsRoute },
  { path: "/api/projects", handler: projectsRoute },
  { path: "/api/meetings", handler: meetingsRoute },
  { path: "/api/occasions", handler: occasionsHandler },
  { path: "/api/diary", handler: diaryRoute },
  { path: "/api/locations", handler: locationsRoute },
  { path: "/api/pantry", handler: pantryRoute },
  { path: "/api/waiting-list", handler: waitingListRoute },
  { path: "/api/integrations", handler: integrationsRoute },
  { path: "/api/automation", handler: automationRoute },
  { path: "/api/scheduled-messages", handler: scheduledMessagesRoute },
  { path: "/api/suggestions", handler: suggestionsRoute },
  { path: "/api/activity", handler: activityRoute },
  { path: "/api/dashboard", handler: dashboardRoute },
  { path: "/api/finances", handler: financesRoute },
  { path: "/api/health", handler: healthRoute },
  { path: "/api/habits", handler: habitsRoute },
  { path: "/api/contact-reminders", handler: contactRemindersRoute },
  { path: "/api/happiness", handler: happinessRoute },
  { path: "/api/quran", handler: quranRoute },
  { path: "/api/budget", handler: budgetRoute },
  { path: "/api/recycle-bin", handler: recycleBinRoute },
  { path: "/api/analytics", handler: analyticsRoute },
  { path: "/api/gamification", handler: gamificationRoute },
  { path: "/api/smart-notifications", handler: smartNotificationsRoute },
  { path: "/api/home", handler: homeRoute },
  { path: "/api/appearance", handler: appearanceRoute },
  { path: "/api/weather", handler: weatherRoute },
  { path: "/api/ai/chat", handler: aiChatRoute },
  { path: "/api/ai-insights", handler: aiInsightsRoute },
  { path: "/api/sync/contacts", handler: syncOfflineRoute },
  { path: "/api/sync/calendar", handler: syncOfflineRoute },
  { path: "/api/sync/drive", handler: syncOfflineRoute },
];

/**
 * Main entry point: route a parsed request to the matching handler.
 * Exported so tests can call it directly without going through fetch.
 */
export async function localApiHandler(
  url: string,
  init?: RequestInit
): Promise<Response> {
  try {
    const req = await parseRequest(url, init);
    const route = ROUTES.find((r) => r.path === req.pathname);
    if (!route) {
      return fail(`المسار غير موجود: ${req.pathname}`, 404);
    }
    return await route.handler(req);
  } catch (e) {
    console.error("localApiHandler error:", e);
    return fail("خطأ داخلي في المعالج المحلي", 500);
  }
}

// ----------------------------------------------------------------------------
// Fetch interceptor installation
// ----------------------------------------------------------------------------

let originalFetch: typeof window.fetch | null = null;
let installed = false;

/**
 * Get the original (un-intercepted) fetch function.
 * Use this for external API calls (e.g. AI chat, weather) that must NOT
 * be routed through the local interceptor.
 */
export function getOriginalFetch(): typeof window.fetch {
  return originalFetch || window.fetch.bind(window);
}

/**
 * Check whether the current client is an authenticated web user.
 *
 * NextAuth's session cookie is HttpOnly (correctly — we never want JS to
 * read the actual token), so document.cookie can't see it. The Next.js
 * middleware sets a non-HttpOnly `x-authed=1` cookie that mirrors the
 * presence of the session cookie — we read THAT instead.
 *
 * As a fallback (for the brief window between page-load and the first
 * middleware-set cookie, or if middleware is disabled), we also check a
 * localStorage flag that the AuthButton sets after useSession() resolves.
 *
 * This is a hint, not a security control — the server still enforces
 * authentication on every request via the signed JWT.
 */
function isAuthenticatedWebUser(): boolean {
  if (typeof window === "undefined") return false;
  // Primary: middleware-set non-HttpOnly cookie (available at module-load)
  if (typeof document !== "undefined" && document.cookie) {
    if (document.cookie.includes("x-authed=1")) return true;
  }
  // Fallback: localStorage flag set by AuthButton after session resolves
  try {
    if (window.localStorage.getItem("auth-session") === "1") return true;
  } catch {
    // ignore
  }
  return false;
}

function shouldIntercept(): boolean {
  if (typeof window === "undefined") return false;
  // APK build: NEXT_PUBLIC_APK_MODE is baked into the bundle as "true"
  const isApkMode = process.env.NEXT_PUBLIC_APK_MODE === "true";
  // Capacitor native shell (Android/iOS)
  const isNative =
    (window as any).capacitor?.isNative === true ||
    (window as any).capacitor?.platform === "android";
  // Manual override for browser testing (use try/catch to avoid minifier issues)
  let forceLocal = false;
  try {
    forceLocal = window.localStorage.getItem("force-local-mode") === "true";
  } catch {
    // localStorage not available
  }
  // APK / native / forced → always intercept (offline-first shell)
  if (isApkMode || isNative || forceLocal) return true;
  // Normal web: intercept ONLY for guests (no auth-session flag).
  // Authenticated users get real cloud data.
  return !isAuthenticatedWebUser();
}

/** Install the fetch interceptor. Safe to call multiple times. */
export function installFetchInterceptor(): void {
  if (typeof window === "undefined") return;
  if (installed) return;
  if (!shouldIntercept()) return;

  // Make sure the DB is seeded before serving any request.
  initDB();

  originalFetch = window.fetch.bind(window);
  installed = true;

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let urlStr: string;
    if (input instanceof Request) urlStr = input.url;
    else if (input instanceof URL) urlStr = input.toString();
    else urlStr = input as string;

    // SECURITY: Never intercept auth routes — let NextAuth handle them.
    if (urlStr.startsWith("/api/auth/")) {
      return originalFetch!(input as RequestInfo, init);
    }

    // If the user just authenticated mid-session (the AuthButton set the
    // auth-session flag after this interceptor was installed), stop
    // intercepting app data so writes go to the cloud.
    if (isAuthenticatedWebUser()) {
      return originalFetch!(input as RequestInfo, init);
    }

    // SIMPLE RULE: Only intercept if the URL is RELATIVE (starts with /)
    // AND starts with /api/. Everything else (full URLs with protocol)
    // goes to the original fetch.
    if (urlStr.startsWith("/api/")) {
      return localApiHandler(urlStr, init);
    }

    // All other requests (external APIs, assets, etc.) use original fetch
    return originalFetch!(input as RequestInfo, init);
  }) as typeof window.fetch;

  // Signal to useApi that the interceptor is ready
  (window as any).__localModeReady = true;
}

/** Remove the interceptor and restore the original fetch (mainly for tests). */
export function uninstallFetchInterceptor(): void {
  if (typeof window === "undefined") return;
  if (!installed || !originalFetch) return;
  window.fetch = originalFetch;
  originalFetch = null;
  installed = false;
}

/** Returns true if the interceptor is currently active. */
export function isInterceptorInstalled(): boolean {
  return installed;
}
