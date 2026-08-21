// =============================================================================
// v1 API — entity schemas (zod) + CRUD configs
// =============================================================================
// Single source of truth for every sync-enabled entity's validation schema
// and CRUD configuration. Route files are thin imports of these configs.
//
// ALL schemas use .strict() so unknown fields are rejected — this is the
// mass-assignment defence. Server-managed fields (id, userId, createdAt,
// updatedAt, version, deletedAt) are never accepted from the client.

import { z } from "zod";
import { db } from "@/lib/db";
import type { CrudConfig } from "./crud";

// ---------------------------------------------------------------------------
// Shared primitive helpers
// ---------------------------------------------------------------------------
const opt = <T>(s: z.ZodType<T>) => s.optional().nullable();
const str = z.string();
const nonEmpty = z.string().min(1).max(10000);
const enumOf = <T extends string>(vals: readonly T[]) => z.enum(vals);
const dateStr = z.string().datetime({ offset: true }).or(z.string().datetime());
const optDate = opt(dateStr);

// ---------------------------------------------------------------------------
// TASKS
// ---------------------------------------------------------------------------
export const taskCreate = z.object({
  title: nonEmpty.max(500),
  description: opt(str.max(20000)),
  status: enumOf(["todo", "doing", "done"]).default("todo"),
  priority: enumOf(["low", "medium", "high"]).default("medium"),
  category: str.max(100).default("general"),
  dueDate: optDate,
  projectId: opt(str.min(1).max(100)),
}).strict();

export const taskUpdate = z.object({
  title: nonEmpty.max(500).optional(),
  description: opt(str.max(20000)),
  status: enumOf(["todo", "doing", "done"]).optional(),
  priority: enumOf(["low", "medium", "high"]).optional(),
  category: str.max(100).optional(),
  dueDate: optDate,
  projectId: opt(str.min(1).max(100)),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const tasksConfig: CrudConfig = {
  model: db.task,
  entity: "task",
  entityLabel: "مهمة",
  createSchema: taskCreate,
  updateSchema: taskUpdate,
  filterableFields: ["status", "priority", "category", "projectId"],
  sortableFields: ["createdAt", "updatedAt", "priority", "dueDate", "status"],
  searchableFields: ["title", "description"],
  defaultInclude: { project: true },
  defaultSort: { field: "createdAt", dir: "desc" },
};

// ---------------------------------------------------------------------------
// CONTACTS
// ---------------------------------------------------------------------------
export const contactCreate = z.object({
  name: nonEmpty.max(200),
  phone: nonEmpty.max(50),
  whatsapp: opt(str.max(50)),
  email: opt(str.email().max(200)),
  relation: enumOf(["family", "friend", "work", "business", "other"]).default("other"),
  category: opt(str.max(100)),
  note: opt(str.max(5000)),
  favorite: z.boolean().default(false),
  avatar: opt(str.max(2000)),
}).strict();

export const contactUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  phone: nonEmpty.max(50).optional(),
  whatsapp: opt(str.max(50)),
  email: opt(str.email().max(200)),
  relation: enumOf(["family", "friend", "work", "business", "other"]).optional(),
  category: opt(str.max(100)),
  note: opt(str.max(5000)),
  favorite: z.boolean().optional(),
  avatar: opt(str.max(2000)),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const contactsConfig: CrudConfig = {
  model: db.contact,
  entity: "contact",
  entityLabel: "جهة اتصال",
  createSchema: contactCreate,
  updateSchema: contactUpdate,
  filterableFields: ["relation", "category", "favorite"],
  sortableFields: ["createdAt", "updatedAt", "name"],
  searchableFields: ["name", "phone", "whatsapp", "email", "note"],
  defaultSort: { field: "name", dir: "asc" },
};

// ---------------------------------------------------------------------------
// NOTES
// ---------------------------------------------------------------------------
export const noteCreate = z.object({
  title: nonEmpty.max(500),
  content: str.max(100000),
  color: enumOf(["default", "yellow", "green", "blue", "red", "purple"]).default("default"),
  pinned: z.boolean().default(false),
}).strict();

export const noteUpdate = z.object({
  title: nonEmpty.max(500).optional(),
  content: str.max(100000).optional(),
  color: enumOf(["default", "yellow", "green", "blue", "red", "purple"]).optional(),
  pinned: z.boolean().optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const notesConfig: CrudConfig = {
  model: db.note,
  entity: "note",
  entityLabel: "ملاحظة",
  createSchema: noteCreate,
  updateSchema: noteUpdate,
  filterableFields: ["color", "pinned"],
  sortableFields: ["createdAt", "updatedAt", "title"],
  searchableFields: ["title", "content"],
  defaultSort: { field: "pinned", dir: "desc" },
};

// ---------------------------------------------------------------------------
// EVENTS
// ---------------------------------------------------------------------------
export const eventCreate = z.object({
  title: nonEmpty.max(500),
  description: opt(str.max(20000)),
  startDate: dateStr,
  endDate: optDate,
  allDay: z.boolean().default(false),
  type: enumOf(["work", "personal", "family", "health", "other"]).default("personal"),
  color: enumOf(["emerald", "amber", "rose", "blue", "violet", "slate"]).default("emerald"),
  location: opt(str.max(500)),
}).strict();

export const eventUpdate = z.object({
  title: nonEmpty.max(500).optional(),
  description: opt(str.max(20000)),
  startDate: dateStr.optional(),
  endDate: optDate,
  allDay: z.boolean().optional(),
  type: enumOf(["work", "personal", "family", "health", "other"]).optional(),
  color: enumOf(["emerald", "amber", "rose", "blue", "violet", "slate"]).optional(),
  location: opt(str.max(500)),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const eventsConfig: CrudConfig = {
  model: db.event,
  entity: "event",
  entityLabel: "حدث",
  createSchema: eventCreate,
  updateSchema: eventUpdate,
  filterableFields: ["type", "color"],
  sortableFields: ["startDate", "createdAt", "updatedAt"],
  searchableFields: ["title", "description", "location"],
  defaultSort: { field: "startDate", dir: "asc" },
};

// ---------------------------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------------------------
export const expenseCreate = z.object({
  amount: z.number().finite(),
  currency: enumOf(["syp", "usd"]).default("syp"),
  category: str.max(100).default("general"),
  description: opt(str.max(2000)),
  date: optDate,
  accountId: opt(str.min(1).max(100)),
}).strict();

export const expenseUpdate = z.object({
  amount: z.number().finite().optional(),
  currency: enumOf(["syp", "usd"]).optional(),
  category: str.max(100).optional(),
  description: opt(str.max(2000)),
  date: optDate,
  accountId: opt(str.min(1).max(100)),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const expensesConfig: CrudConfig = {
  model: db.expense,
  entity: "expense",
  entityLabel: "مصروف",
  createSchema: expenseCreate,
  updateSchema: expenseUpdate,
  filterableFields: ["category", "currency", "accountId"],
  sortableFields: ["date", "createdAt", "amount"],
  searchableFields: ["description", "category"],
  defaultSort: { field: "date", dir: "desc" },
};

// ---------------------------------------------------------------------------
// ACCOUNTS (financial)
// ---------------------------------------------------------------------------
export const accountCreate = z.object({
  name: nonEmpty.max(200),
  balance: z.number().finite().default(0),
  currency: enumOf(["syp", "usd"]).default("syp"),
  type: enumOf(["bank", "cash", "savings", "credit"]).default("bank"),
  institution: opt(str.max(200)),
}).strict();

export const accountUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  balance: z.number().finite().optional(),
  currency: enumOf(["syp", "usd"]).optional(),
  type: enumOf(["bank", "cash", "savings", "credit"]).optional(),
  institution: opt(str.max(200)),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const accountsConfig: CrudConfig = {
  model: db.account,
  entity: "account",
  entityLabel: "حساب مالي",
  createSchema: accountCreate,
  updateSchema: accountUpdate,
  filterableFields: ["type", "currency"],
  sortableFields: ["createdAt", "updatedAt", "name", "balance"],
  searchableFields: ["name", "institution"],
  defaultSort: { field: "createdAt", dir: "asc" },
};

// ---------------------------------------------------------------------------
// ASSETS
// ---------------------------------------------------------------------------
export const assetCreate = z.object({
  name: nonEmpty.max(200),
  amount: z.number().finite(),
  currency: enumOf(["syp", "usd"]).default("syp"),
  type: enumOf(["cash", "bank", "real-estate", "gold", "stocks", "other"]).default("cash"),
  description: opt(str.max(2000)),
}).strict();

export const assetUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  amount: z.number().finite().optional(),
  currency: enumOf(["syp", "usd"]).optional(),
  type: enumOf(["cash", "bank", "real-estate", "gold", "stocks", "other"]).optional(),
  description: opt(str.max(2000)),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const assetsConfig: CrudConfig = {
  model: db.asset,
  entity: "asset",
  entityLabel: "أصل",
  createSchema: assetCreate,
  updateSchema: assetUpdate,
  filterableFields: ["type", "currency"],
  sortableFields: ["createdAt", "updatedAt", "name", "amount"],
  searchableFields: ["name", "description"],
  defaultSort: { field: "createdAt", dir: "desc" },
};

// ---------------------------------------------------------------------------
// DEBTS
// ---------------------------------------------------------------------------
export const debtCreate = z.object({
  personName: nonEmpty.max(200),
  amount: z.number().finite(),
  currency: enumOf(["syp", "usd"]).default("syp"),
  type: enumOf(["owed", "owe"]).default("owed"),
  description: opt(str.max(2000)),
  dueDate: optDate,
  settled: z.boolean().default(false),
}).strict();

export const debtUpdate = z.object({
  personName: nonEmpty.max(200).optional(),
  amount: z.number().finite().optional(),
  currency: enumOf(["syp", "usd"]).optional(),
  type: enumOf(["owed", "owe"]).optional(),
  description: opt(str.max(2000)),
  dueDate: optDate,
  settled: z.boolean().optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const debtsConfig: CrudConfig = {
  model: db.debt,
  entity: "debt",
  entityLabel: "دين",
  createSchema: debtCreate,
  updateSchema: debtUpdate,
  filterableFields: ["type", "currency", "settled"],
  sortableFields: ["createdAt", "dueDate", "amount"],
  searchableFields: ["personName", "description"],
  defaultSort: { field: "createdAt", dir: "desc" },
};

// ---------------------------------------------------------------------------
// BUDGETS
// ---------------------------------------------------------------------------
export const budgetCreate = z.object({
  category: nonEmpty.max(100),
  limit: z.number().finite().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
}).strict();

export const budgetUpdate = z.object({
  category: nonEmpty.max(100).optional(),
  limit: z.number().finite().positive().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const budgetsConfig: CrudConfig = {
  model: db.budget,
  entity: "budget",
  entityLabel: "ميزانية",
  createSchema: budgetCreate,
  updateSchema: budgetUpdate,
  filterableFields: ["category", "month", "year"],
  sortableFields: ["createdAt", "year", "month"],
  defaultSort: { field: "year", dir: "desc" },
};

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------
export const projectCreate = z.object({
  name: nonEmpty.max(200),
  description: opt(str.max(20000)),
  status: enumOf(["active", "paused", "completed", "archived"]).default("active"),
  color: str.max(50).default("emerald"),
  progress: z.number().int().min(0).max(100).default(0),
  startDate: optDate,
  endDate: optDate,
}).strict();

export const projectUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  description: opt(str.max(20000)),
  status: enumOf(["active", "paused", "completed", "archived"]).optional(),
  color: str.max(50).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  startDate: optDate,
  endDate: optDate,
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const projectsConfig: CrudConfig = {
  model: db.project,
  entity: "project",
  entityLabel: "مشروع",
  createSchema: projectCreate,
  updateSchema: projectUpdate,
  filterableFields: ["status", "color"],
  sortableFields: ["createdAt", "updatedAt", "name", "progress"],
  searchableFields: ["name", "description"],
  defaultInclude: { tasks: true, checklist: true },
  defaultSort: { field: "createdAt", dir: "desc" },
};

// ---------------------------------------------------------------------------
// MEETINGS
// ---------------------------------------------------------------------------
export const meetingCreate = z.object({
  title: nonEmpty.max(500),
  agenda: opt(str.max(20000)),
  notes: opt(str.max(20000)),
  location: opt(str.max(500)),
  participants: opt(str.max(2000)),
  startDate: dateStr,
  endDate: optDate,
  status: enumOf(["scheduled", "completed", "cancelled"]).default("scheduled"),
}).strict();

export const meetingUpdate = z.object({
  title: nonEmpty.max(500).optional(),
  agenda: opt(str.max(20000)),
  notes: opt(str.max(20000)),
  location: opt(str.max(500)),
  participants: opt(str.max(2000)),
  startDate: dateStr.optional(),
  endDate: optDate,
  status: enumOf(["scheduled", "completed", "cancelled"]).optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const meetingsConfig: CrudConfig = {
  model: db.meeting,
  entity: "meeting",
  entityLabel: "اجتماع",
  createSchema: meetingCreate,
  updateSchema: meetingUpdate,
  filterableFields: ["status"],
  sortableFields: ["startDate", "createdAt", "updatedAt"],
  searchableFields: ["title", "agenda", "notes", "location", "participants"],
  defaultSort: { field: "startDate", dir: "asc" },
};

// ---------------------------------------------------------------------------
// OCCASIONS
// ---------------------------------------------------------------------------
export const occasionCreate = z.object({
  title: nonEmpty.max(200),
  date: dateStr,
  type: enumOf(["birthday", "anniversary", "holiday", "other"]).default("birthday"),
  recurring: z.boolean().default(true),
  note: opt(str.max(2000)),
}).strict();

export const occasionUpdate = z.object({
  title: nonEmpty.max(200).optional(),
  date: dateStr.optional(),
  type: enumOf(["birthday", "anniversary", "holiday", "other"]).optional(),
  recurring: z.boolean().optional(),
  note: opt(str.max(2000)),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const occasionsConfig: CrudConfig = {
  model: db.occasion,
  entity: "occasion",
  entityLabel: "مناسبة",
  createSchema: occasionCreate,
  updateSchema: occasionUpdate,
  filterableFields: ["type", "recurring"],
  sortableFields: ["date", "createdAt"],
  searchableFields: ["title", "note"],
  defaultSort: { field: "date", dir: "asc" },
};

// ---------------------------------------------------------------------------
// DIARY
// ---------------------------------------------------------------------------
export const diaryCreate = z.object({
  title: opt(str.max(500)),
  content: str.max(100000),
  mood: enumOf(["happy", "sad", "neutral", "angry", "excited", "anxious"]).default("neutral"),
  weather: opt(str.max(50)),
  date: optDate,
}).strict();

export const diaryUpdate = z.object({
  title: opt(str.max(500)),
  content: str.max(100000).optional(),
  mood: enumOf(["happy", "sad", "neutral", "angry", "excited", "anxious"]).optional(),
  weather: opt(str.max(50)),
  date: optDate,
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const diaryConfig: CrudConfig = {
  model: db.diaryEntry,
  entity: "diaryEntry",
  entityLabel: "يومية",
  createSchema: diaryCreate,
  updateSchema: diaryUpdate,
  filterableFields: ["mood"],
  sortableFields: ["date", "createdAt", "updatedAt"],
  searchableFields: ["title", "content"],
  defaultSort: { field: "date", dir: "desc" },
};

// ---------------------------------------------------------------------------
// HABITS
// ---------------------------------------------------------------------------
export const habitCreate = z.object({
  name: nonEmpty.max(200),
  description: opt(str.max(2000)),
  frequency: enumOf(["daily", "weekly"]).default("daily"),
  target: z.number().int().min(1).max(1000).default(1),
  color: str.max(50).default("emerald"),
  icon: str.max(100).default("CheckCircle"),
  active: z.boolean().default(true),
}).strict();

export const habitUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  description: opt(str.max(2000)),
  frequency: enumOf(["daily", "weekly"]).optional(),
  target: z.number().int().min(1).max(1000).optional(),
  color: str.max(50).optional(),
  icon: str.max(100).optional(),
  active: z.boolean().optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const habitsConfig: CrudConfig = {
  model: db.habit,
  entity: "habit",
  entityLabel: "عادة",
  createSchema: habitCreate,
  updateSchema: habitUpdate,
  filterableFields: ["frequency", "active"],
  sortableFields: ["createdAt", "updatedAt", "name"],
  searchableFields: ["name", "description"],
  defaultInclude: { logs: true },
  defaultSort: { field: "createdAt", dir: "asc" },
};

// ---------------------------------------------------------------------------
// MEDICATIONS
// ---------------------------------------------------------------------------
export const medicationCreate = z.object({
  name: nonEmpty.max(200),
  dosage: opt(str.max(200)),
  frequency: str.max(100).default("daily"),
  startDate: optDate,
  endDate: optDate,
  notes: opt(str.max(2000)),
  active: z.boolean().default(true),
}).strict();

export const medicationUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  dosage: opt(str.max(200)),
  frequency: str.max(100).optional(),
  startDate: optDate,
  endDate: optDate,
  notes: opt(str.max(2000)),
  active: z.boolean().optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const medicationsConfig: CrudConfig = {
  model: db.medication,
  entity: "medication",
  entityLabel: "دواء",
  createSchema: medicationCreate,
  updateSchema: medicationUpdate,
  filterableFields: ["active", "frequency"],
  sortableFields: ["createdAt", "updatedAt", "name"],
  searchableFields: ["name", "dosage", "notes"],
  defaultSort: { field: "createdAt", dir: "asc" },
};

// ---------------------------------------------------------------------------
// PANTRY
// ---------------------------------------------------------------------------
export const pantryCreate = z.object({
  name: nonEmpty.max(200),
  quantity: z.number().int().min(0).default(1),
  unit: enumOf(["piece", "kg", "g", "l", "ml", "pack"]).default("piece"),
  lowStock: z.number().int().min(0).default(1),
  category: enumOf(["grains", "dairy", "meat", "vegetables", "fruits", "beverages", "cleaning", "other"]).default("other"),
}).strict();

export const pantryUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  quantity: z.number().int().min(0).optional(),
  unit: enumOf(["piece", "kg", "g", "l", "ml", "pack"]).optional(),
  lowStock: z.number().int().min(0).optional(),
  category: enumOf(["grains", "dairy", "meat", "vegetables", "fruits", "beverages", "cleaning", "other"]).optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const pantryConfig: CrudConfig = {
  model: db.pantryItem,
  entity: "pantryItem",
  entityLabel: "عنصر مخزن",
  createSchema: pantryCreate,
  updateSchema: pantryUpdate,
  filterableFields: ["category", "unit"],
  sortableFields: ["createdAt", "updatedAt", "name", "quantity"],
  searchableFields: ["name"],
  defaultSort: { field: "name", dir: "asc" },
};

// ---------------------------------------------------------------------------
// WAITING LIST
// ---------------------------------------------------------------------------
export const waitingCreate = z.object({
  title: nonEmpty.max(500),
  description: opt(str.max(2000)),
  priority: z.number().int().min(0).max(100).default(0),
  ready: z.boolean().default(false),
}).strict();

export const waitingUpdate = z.object({
  title: nonEmpty.max(500).optional(),
  description: opt(str.max(2000)),
  priority: z.number().int().min(0).max(100).optional(),
  ready: z.boolean().optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const waitingListConfig: CrudConfig = {
  model: db.waitingItem,
  entity: "waitingItem",
  entityLabel: "عنصر انتظار",
  createSchema: waitingCreate,
  updateSchema: waitingUpdate,
  filterableFields: ["ready", "priority"],
  sortableFields: ["priority", "createdAt", "updatedAt"],
  searchableFields: ["title", "description"],
  defaultSort: { field: "priority", dir: "desc" },
};

// ---------------------------------------------------------------------------
// LOCATIONS
// ---------------------------------------------------------------------------
export const locationCreate = z.object({
  name: nonEmpty.max(200),
  address: str.max(1000).default(""),
  lat: z.number().finite(),
  lng: z.number().finite(),
  icon: str.max(100).default("MapPin"),
  color: str.max(50).default("blue"),
}).strict();

export const locationUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  address: str.max(1000).optional(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  icon: str.max(100).optional(),
  color: str.max(50).optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const locationsConfig: CrudConfig = {
  model: db.savedLocation,
  entity: "savedLocation",
  entityLabel: "موقع محفوظ",
  createSchema: locationCreate,
  updateSchema: locationUpdate,
  filterableFields: ["color"],
  sortableFields: ["createdAt", "updatedAt", "name"],
  searchableFields: ["name", "address"],
  defaultSort: { field: "name", dir: "asc" },
};

// ---------------------------------------------------------------------------
// REMINDERS (Contact Reminders)
// ---------------------------------------------------------------------------
export const reminderCreate = z.object({
  contactId: opt(str.min(1).max(100)),
  contactName: nonEmpty.max(200),
  frequency: enumOf(["daily", "weekly", "monthly"]).default("weekly"),
  lastContacted: optDate,
  nextReminder: optDate,
  active: z.boolean().default(true),
}).strict();

export const reminderUpdate = z.object({
  contactId: opt(str.min(1).max(100)),
  contactName: nonEmpty.max(200).optional(),
  frequency: enumOf(["daily", "weekly", "monthly"]).optional(),
  lastContacted: optDate,
  nextReminder: optDate,
  active: z.boolean().optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const remindersConfig: CrudConfig = {
  model: db.contactReminder,
  entity: "contactReminder",
  entityLabel: "تذكير تواصل",
  createSchema: reminderCreate,
  updateSchema: reminderUpdate,
  filterableFields: ["frequency", "active", "contactId"],
  sortableFields: ["nextReminder", "createdAt", "updatedAt"],
  searchableFields: ["contactName"],
  defaultSort: { field: "nextReminder", dir: "asc" },
};

// ---------------------------------------------------------------------------
// SCHEDULED MESSAGES
// ---------------------------------------------------------------------------
export const scheduledMessageCreate = z.object({
  recipient: nonEmpty.max(200),
  message: str.max(10000),
  channel: enumOf(["whatsapp", "sms", "telegram", "email"]).default("whatsapp"),
  scheduledAt: dateStr,
}).strict();

export const scheduledMessageUpdate = z.object({
  recipient: nonEmpty.max(200).optional(),
  message: str.max(10000).optional(),
  channel: enumOf(["whatsapp", "sms", "telegram", "email"]).optional(),
  scheduledAt: dateStr.optional(),
  sent: z.boolean().optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const scheduledMessagesConfig: CrudConfig = {
  model: db.scheduledMessage,
  entity: "scheduledMessage",
  entityLabel: "رسالة مجدولة",
  createSchema: scheduledMessageCreate,
  updateSchema: scheduledMessageUpdate,
  filterableFields: ["channel", "sent"],
  sortableFields: ["scheduledAt", "createdAt"],
  searchableFields: ["recipient", "message"],
  defaultSort: { field: "scheduledAt", dir: "asc" },
};

// ---------------------------------------------------------------------------
// AUTOMATION
// ---------------------------------------------------------------------------
export const automationCreate = z.object({
  name: nonEmpty.max(200),
  trigger: nonEmpty.max(200),
  action: nonEmpty.max(200),
  config: opt(str.max(20000)),
  active: z.boolean().default(true),
}).strict();

export const automationUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  trigger: nonEmpty.max(200).optional(),
  action: nonEmpty.max(200).optional(),
  config: opt(str.max(20000)),
  active: z.boolean().optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const automationConfig: CrudConfig = {
  model: db.automationRule,
  entity: "automationRule",
  entityLabel: "قاعدة أتمتة",
  createSchema: automationCreate,
  updateSchema: automationUpdate,
  filterableFields: ["active", "trigger"],
  sortableFields: ["createdAt", "updatedAt", "name"],
  searchableFields: ["name", "trigger", "action"],
  defaultSort: { field: "createdAt", dir: "desc" },
};

// ---------------------------------------------------------------------------
// SUGGESTIONS
// ---------------------------------------------------------------------------
export const suggestionCreate = z.object({
  title: nonEmpty.max(500),
  content: str.max(20000),
  category: str.max(100).default("general"),
  status: enumOf(["pending", "accepted", "rejected"]).default("pending"),
}).strict();

export const suggestionUpdate = z.object({
  title: nonEmpty.max(500).optional(),
  content: str.max(20000).optional(),
  category: str.max(100).optional(),
  status: enumOf(["pending", "accepted", "rejected"]).optional(),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const suggestionsConfig: CrudConfig = {
  model: db.suggestion,
  entity: "suggestion",
  entityLabel: "اقتراح",
  createSchema: suggestionCreate,
  updateSchema: suggestionUpdate,
  filterableFields: ["category", "status"],
  sortableFields: ["createdAt", "updatedAt"],
  searchableFields: ["title", "content"],
  defaultSort: { field: "createdAt", dir: "desc" },
};

// ---------------------------------------------------------------------------
// INTEGRATIONS
// ---------------------------------------------------------------------------
const VALID_SERVICES = [
  "google_calendar", "google_drive", "telegram", "email",
  "github", "google_contacts", "cloud_sync",
] as const;

export const integrationCreate = z.object({
  service: enumOf(VALID_SERVICES),
  name: nonEmpty.max(200),
  connected: z.boolean().default(false),
  config: opt(str.max(20000)),
}).strict();

export const integrationUpdate = z.object({
  name: nonEmpty.max(200).optional(),
  connected: z.boolean().optional(),
  config: opt(str.max(20000)),
  lastSync: optDate,
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const integrationsConfig: CrudConfig = {
  model: db.integration,
  entity: "integration",
  entityLabel: "تكامل",
  createSchema: integrationCreate,
  updateSchema: integrationUpdate,
  filterableFields: ["service", "connected"],
  sortableFields: ["createdAt", "updatedAt", "service"],
  searchableFields: ["name", "service"],
  defaultSort: { field: "createdAt", dir: "asc" },
};

// ---------------------------------------------------------------------------
// HAPPINESS LOGS
// ---------------------------------------------------------------------------
export const happinessCreate = z.object({
  date: dateStr,
  score: z.number().int().min(1).max(10),
  factors: opt(str.max(20000)),
  note: opt(str.max(5000)),
}).strict();

export const happinessUpdate = z.object({
  date: dateStr.optional(),
  score: z.number().int().min(1).max(10).optional(),
  factors: opt(str.max(20000)),
  note: opt(str.max(5000)),
  baseVersion: z.number().int().min(1).optional(),
}).strict();

export const happinessConfig: CrudConfig = {
  model: db.happinessLog,
  entity: "happinessLog",
  entityLabel: "سجل سعادة",
  createSchema: happinessCreate,
  updateSchema: happinessUpdate,
  filterableFields: [],
  sortableFields: ["date", "createdAt"],
  searchableFields: ["note"],
  defaultSort: { field: "date", dir: "desc" },
};

// ---------------------------------------------------------------------------
// Export a registry for documentation generation
// ---------------------------------------------------------------------------
export const ENTITY_CONFIGS: Record<string, CrudConfig> = {
  tasks: tasksConfig,
  contacts: contactsConfig,
  notes: notesConfig,
  events: eventsConfig,
  expenses: expensesConfig,
  accounts: accountsConfig,
  assets: assetsConfig,
  debts: debtsConfig,
  budgets: budgetsConfig,
  projects: projectsConfig,
  meetings: meetingsConfig,
  occasions: occasionsConfig,
  diary: diaryConfig,
  habits: habitsConfig,
  medications: medicationsConfig,
  pantry: pantryConfig,
  "waiting-list": waitingListConfig,
  locations: locationsConfig,
  reminders: remindersConfig,
  "scheduled-messages": scheduledMessagesConfig,
  automation: automationConfig,
  suggestions: suggestionsConfig,
  integrations: integrationsConfig,
  happiness: happinessConfig,
};
