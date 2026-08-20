import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUpcomingHolidays, isHoliday } from "@/lib/holidays";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET: aggregates smart notifications from various sources
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], stats: { total: 0, critical: 0, warning: 0, info: 0 } });
    }
    const userId = user.id;
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const next7Days = new Date(now);
    next7Days.setDate(next7Days.getDate() + 7);

    const [todayEvents, overdueTasks, soonTasks, dueDebts, dueReminders, lowStockPantry, upcomingOccasions, todayHoliday] = await Promise.all([
      db.event.findMany({ where: { userId, startDate: { gte: now, lte: todayEnd }, deletedAt: null }, orderBy: { startDate: "asc" } }),
      db.task.findMany({ where: { userId, status: { not: "done" }, dueDate: { lt: now }, deletedAt: null }, orderBy: { dueDate: "asc" } }),
      db.task.findMany({ where: { userId, status: { not: "done" }, dueDate: { gte: now, lte: next7Days }, deletedAt: null }, orderBy: { dueDate: "asc" } }),
      db.debt.findMany({ where: { userId, settled: false, dueDate: { lte: next7Days }, deletedAt: null }, orderBy: { dueDate: "asc" } }),
      db.contactReminder.findMany({ where: { userId, active: true, nextReminder: { lte: next7Days } }, orderBy: { nextReminder: "asc" } }),
      db.pantryItem.findMany({ where: { userId } }),
      db.occasion.findMany({ where: { userId, date: { gte: now, lte: next7Days } }, orderBy: { date: "asc" } }),
      Promise.resolve(isHoliday(now)),
    ]);

    const notifications: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      severity: "info" | "warning" | "critical";
      createdAt: string;
    }> = [];

    // Today events
    for (const e of todayEvents) {
      notifications.push({
        id: `event-${e.id}`,
        type: "event",
        title: "حدث اليوم",
        message: `${e.title} في ${e.startDate.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}`,
        severity: "info",
        createdAt: e.startDate.toISOString(),
      });
    }

    // Overdue tasks (critical)
    for (const t of overdueTasks.slice(0, 5)) {
      const days = Math.ceil((now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `task-overdue-${t.id}`,
        type: "task-overdue",
        title: "مهمة متأخرة",
        message: `"${t.title}" متأخرة بـ ${days} يوم`,
        severity: "critical",
        createdAt: t.dueDate!.toISOString(),
      });
    }

    // Soon tasks (warning)
    for (const t of soonTasks.slice(0, 5)) {
      const days = Math.ceil((new Date(t.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `task-soon-${t.id}`,
        type: "task-soon",
        title: "موعد نهائي قريب",
        message: `"${t.title}" خلال ${days} يوم`,
        severity: "warning",
        createdAt: t.dueDate!.toISOString(),
      });
    }

    // Due debts
    for (const d of dueDebts) {
      notifications.push({
        id: `debt-${d.id}`,
        type: "debt",
        title: "استحقاق دين",
        message: `دين ${d.personName} يستحق قريباً (${d.amount} ${d.currency})`,
        severity: "warning",
        createdAt: d.dueDate!.toISOString(),
      });
    }

    // Due contact reminders
    for (const r of dueReminders.slice(0, 5)) {
      notifications.push({
        id: `reminder-${r.id}`,
        type: "reminder",
        title: "تذكير تواصل",
        message: `حان وقت التواصل مع ${r.contactName}`,
        severity: "info",
        createdAt: r.nextReminder!.toISOString(),
      });
    }

    // Low stock pantry
    const lowStock = lowStockPantry.filter((p) => p.quantity <= p.lowStock);
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

    // Upcoming occasions
    for (const o of upcomingOccasions) {
      notifications.push({
        id: `occasion-${o.id}`,
        type: "occasion",
        title: "مناسبة قادمة",
        message: `${o.title} قريباً`,
        severity: "info",
        createdAt: o.date.toISOString(),
      });
    }

    // Holiday today
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

    // Upcoming holidays
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

    return NextResponse.json({ success: true, data: notifications, stats });
  } catch (error) {
    console.error("GET smart-notifications error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الإشعارات" }, { status: 500 });
  }
}
