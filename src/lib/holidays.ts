// Syrian public holidays and special occasions
// Returns holidays in the user's timezone (Asia/Damascus)

export interface Holiday {
  date: string; // YYYY-MM-DD (Gregorian)
  name: string;
  type: "national" | "religious" | "seasonal";
}

// Fixed Gregorian holidays
const FIXED_HOLIDAYS: Holiday[] = [
  { date: "01-01", name: "رأس السنة الميلادية", type: "national" },
  { date: "03-08", name: "عيد الأم", type: "national" },
  { date: "04-17", name: "عيد الجلاء", type: "national" },
  { date: "05-01", name: "عيد العمال", type: "national" },
  { date: "05-06", name: "عيد الشهداء", type: "national" },
  { date: "06-21", name: "أطول يوم في السنة", type: "seasonal" },
  { date: "10-06", name: "عيد المعلم", type: "national" },
  { date: "12-25", name: "عيد الميلاد المجيد", type: "religious" },
];

// Approximate Islamic holidays for 2024-2026 (Hijri dates vary by moon sighting)
const ISLAMIC_HOLIDAYS_2025: Holiday[] = [
  { date: "2025-03-30", name: "بداية شهر رمضان المبارك", type: "religious" },
  { date: "2025-03-31", name: "أول أيام رمضان", type: "religious" },
  { date: "2025-04-10", name: "ليلة القدر (تقريبي)", type: "religious" },
  { date: "2025-04-30", name: "عيد الفطر المبارك", type: "religious" },
  { date: "2025-05-01", name: "ثاني أيام عيد الفطر", type: "religious" },
  { date: "2025-06-06", name: "عيد الأضحى المبارك", type: "religious" },
  { date: "2025-06-07", name: "ثاني أيام عيد الأضحى", type: "religious" },
  { date: "2025-06-27", name: "رأس السنة الهجرية", type: "religious" },
  { date: "2025-09-05", name: "المولد النبوي الشريف", type: "religious" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatMonthDay(d: Date): string {
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getAllHolidays(): Holiday[] {
  return [...FIXED_HOLIDAYS.map((h) => ({ ...h, date: h.date })), ...ISLAMIC_HOLIDAYS_2025];
}

export function isHoliday(date: Date): Holiday | null {
  const md = formatMonthDay(date);
  const full = formatDate(date);

  const fixedMatch = FIXED_HOLIDAYS.find((h) => h.date === md);
  if (fixedMatch) return { ...fixedMatch, date: full };

  const islamicMatch = ISLAMIC_HOLIDAYS_2025.find((h) => h.date === full);
  if (islamicMatch) return islamicMatch;

  return null;
}

export function getUpcomingHolidays(limit: number = 5): Holiday[] {
  const now = new Date();
  const year = now.getFullYear();
  const nextYear = year + 1;

  const all: Holiday[] = [];

  // Fixed holidays for current and next year
  for (const h of FIXED_HOLIDAYS) {
    const [m, d] = h.date.split("-");
    for (const y of [year, nextYear]) {
      const date = new Date(y, Number(m) - 1, Number(d));
      if (date >= now) {
        all.push({ ...h, date: formatDate(date) });
      }
    }
  }

  // Islamic holidays
  for (const h of ISLAMIC_HOLIDAYS_2025) {
    const date = new Date(h.date);
    if (date >= now) {
      all.push(h);
    }
  }

  all.sort((a, b) => a.date.localeCompare(b.date));
  return all.slice(0, limit);
}
