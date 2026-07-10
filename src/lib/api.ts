"use client";

import * as React from "react";

/** Generic fetcher for SWR-like usage. */
export async function fetcher<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Simple data hook with loading/error states. */
export function useApi<T = any>(url: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [raw, setRaw] = React.useState<any>(null);
  const [loading, setLoading] = React.useState<boolean>(!!url);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!url) {
      setData(null);
      setRaw(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await fetcher<{ success: boolean; data?: T; error?: string; [k: string]: any }>(url);
      setRaw(json);
      if (json.success === false) {
        setError(json.error || "فشل تحميل البيانات");
        setData(null);
      } else {
        setData((json.data as T) ?? (json as unknown as T));
      }
    } catch (e: any) {
      setError(e.message || "خطأ في الشبكة");
      setData(null);
      setRaw(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return { data, raw, loading, error, reload, setData };
}

/** Format a date for Arabic display. */
export function formatDate(date: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ar-SY", opts || { year: "numeric", month: "long", day: "numeric" });
}

/** Format time for Arabic display. */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" });
}

/** Format date+time together. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** Relative time ago (Arabic). */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "الآن";
  const min = Math.floor(sec / 60);
  if (min < 60) return `قبل ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `قبل ${day} يوم`;
  const month = Math.floor(day / 30);
  if (month < 12) return `قبل ${month} شهر`;
  return `قبل ${Math.floor(month / 12)} سنة`;
}

/** Days until a date (negative = past). */
export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Toast helper using sonner. */
export { toast } from "sonner";
