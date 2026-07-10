// User profile and app-wide constants

export const USER_PROFILE = {
  name: "عبد الله",
  city: "حلب",
  country: "سوريا",
  lat: 36.2021,
  lng: 37.1343,
  timezone: "Asia/Damascus",
  work: {
    place: "السجل التجاري",
    hours: "8 صباحاً - 3 عصراً",
    daysOff: ["الجمعة", "السبت"],
    inspectionDay: "الأربعاء",
  },
  family: {
    wife: "الحكومة",
    daughter: "سوسو",
  },
} as const;

export const USD_TO_SYP = 12500;

export const CURRENCIES = [
  { code: "syp", name: "ليرة سورية", symbol: "ل.س" },
  { code: "usd", name: "دولار أمريكي", symbol: "$" },
] as const;

export const RELATION_TYPES = [
  { value: "family", label: "عائلة" },
  { value: "friend", label: "صديق" },
  { value: "work", label: "عمل" },
  { value: "business", label: "عمل تجاري" },
  { value: "other", label: "أخرى" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "food", label: "طعام" },
  { value: "transport", label: "مواصلات" },
  { value: "bills", label: "فواتير" },
  { value: "health", label: "صحة" },
  { value: "shopping", label: "تسوق" },
  { value: "education", label: "تعليم" },
  { value: "entertainment", label: "ترفيه" },
  { value: "charity", label: "صدقة" },
  { value: "general", label: "عام" },
] as const;

export const TASK_CATEGORIES = [
  { value: "work", label: "عمل" },
  { value: "personal", label: "شخصي" },
  { value: "family", label: "عائلي" },
  { value: "health", label: "صحة" },
  { value: "finance", label: "مالية" },
  { value: "general", label: "عام" },
] as const;

export const EVENT_COLORS = [
  { value: "emerald", label: "أخضر", class: "bg-emerald-500" },
  { value: "amber", label: "كهرماني", class: "bg-amber-500" },
  { value: "rose", label: "وردي", class: "bg-rose-500" },
  { value: "blue", label: "أزرق", class: "bg-blue-500" },
  { value: "violet", label: "بنفسجي", class: "bg-violet-500" },
  { value: "slate", label: "رمادي", class: "bg-slate-500" },
] as const;

export function formatCurrency(amount: number, currency: string = "syp"): string {
  const c = CURRENCIES.find((x) => x.code === currency);
  const symbol = c?.symbol || "";
  return `${amount.toLocaleString("en-US")} ${symbol}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
