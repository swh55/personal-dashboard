import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { USD_TO_SYP } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET: aggregated analytics across all entities
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: { spendingTrend: [], categoryBreakdown: [], taskStats: { total: 0, done: 0, doing: 0, todo: 0, completionRate: 0 }, taskByCategory: {}, happinessTrend: [], overview: { totalExpenses: 0, totalSpend: 0, contacts: 0, events: 0, callLogs: 0, diary: 0, avgHappiness: 0 } } });
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") || 30);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [expenses, tasks, contacts, events, callLogs, diary, happiness] = await Promise.all([
      db.expense.findMany({ where: { userId, date: { gte: since }, deletedAt: null } }),
      db.task.findMany({ where: { userId, deletedAt: null } }),
      db.contact.count({ where: { userId, deletedAt: null } }),
      db.event.count({ where: { userId, deletedAt: null } }),
      db.callLog.count({ where: { userId } }),
      db.diaryEntry.count({ where: { userId, deletedAt: null } }),
      db.happinessLog.findMany({ where: { userId, date: { gte: since } } }),
    ]);

    const toSYP = (amount: number, currency: string) =>
      currency === "usd" ? amount * USD_TO_SYP : amount;

    // Spending by day
    const byDay: Record<string, number> = {};
    for (const e of expenses) {
      const key = new Date(e.date).toISOString().split("T")[0];
      byDay[key] = (byDay[key] || 0) + toSYP(e.amount, e.currency);
    }
    const spendingTrend = Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date, total: Math.round(total) }));

    // Spending by category
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + toSYP(e.amount, e.currency);
    }
    const categoryBreakdown = Object.entries(byCategory)
      .map(([category, total]) => ({ category, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);

    // Task completion
    const taskStats = {
      total: tasks.length,
      done: tasks.filter((t) => t.status === "done").length,
      doing: tasks.filter((t) => t.status === "doing").length,
      todo: tasks.filter((t) => t.status === "todo").length,
      completionRate: tasks.length
        ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100)
        : 0,
    };

    // Task completion by category
    const taskByCategory: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!taskByCategory[t.category]) taskByCategory[t.category] = { total: 0, done: 0 };
      taskByCategory[t.category].total++;
      if (t.status === "done") taskByCategory[t.category].done++;
    }

    // Happiness trend
    const happinessTrend = happiness
      .map((h) => ({ date: new Date(h.date).toISOString().split("T")[0], score: h.score }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const avgHappiness = happiness.length
      ? +(happiness.reduce((s, h) => s + h.score, 0) / happiness.length).toFixed(2)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error) {
    console.error("GET analytics error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب التحليلات" }, { status: 500 });
  }
}
