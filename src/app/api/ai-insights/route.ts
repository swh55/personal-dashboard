import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET: returns AI-powered insights computed from DB data (no external AI API)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: { spendingPatterns: [], taskSuggestions: [], bestTimes: [], predictiveAlerts: [] } });
    }
    const userId = user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Fetch all required data in parallel
    const [expenses, tasks, budgets] = await Promise.all([
      db.expense.findMany({
        where: { userId, date: { gte: thirtyDaysAgo }, deletedAt: null },
        orderBy: { date: "asc" },
      }),
      db.task.findMany({ where: { userId, deletedAt: null } }),
      db.budget.findMany({
        where: { userId, month: currentMonth, year: currentYear },
      }),
    ]);

    // ---------- Spending Patterns ----------
    const spendingPatterns = computeSpendingPatterns(expenses, budgets);

    // ---------- Task Suggestions ----------
    const taskSuggestions = computeTaskSuggestions(tasks);

    // ---------- Best Times ----------
    const bestTimes = computeBestTimes(tasks);

    // ---------- Predictive Alerts ----------
    const predictiveAlerts = computePredictiveAlerts(
      expenses,
      budgets,
      tasks,
      monthStart,
      now
    );

    return NextResponse.json({
      success: true,
      data: {
        spendingPatterns,
        taskSuggestions,
        bestTimes,
        predictiveAlerts,
      },
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
    });
  } catch (error) {
    console.error("GET ai-insights error:", error);
    return NextResponse.json(
      { success: false, error: "فشل توليد التحليلات الذكية" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const USD_TO_SYP = 12500;

function normalizeAmount(amount: number, currency: string): number {
  return currency === "usd" ? amount * USD_TO_SYP : amount;
}

function computeSpendingPatterns(
  expenses: Array<{
    amount: number;
    currency: string;
    category: string;
    description: string | null;
    date: Date;
  }>,
  budgets: Array<{ category: string; limit: number }>
) {
  const patterns: Array<{
    category: string;
    total: number;
    count: number;
    average: number;
    budget: number | null;
    percentOfBudget: number | null;
    trend: "up" | "down" | "stable";
    insight: string;
  }> = [];

  // Group by category
  const byCategory: Record<
    string,
    { total: number; count: number; dates: Date[]; descriptions: string[] }
  > = {};

  for (const e of expenses) {
    const value = normalizeAmount(e.amount, e.currency);
    if (!byCategory[e.category]) {
      byCategory[e.category] = {
        total: 0,
        count: 0,
        dates: [],
        descriptions: [],
      };
    }
    byCategory[e.category].total += value;
    byCategory[e.category].count += 1;
    byCategory[e.category].dates.push(new Date(e.date));
    if (e.description) byCategory[e.category].descriptions.push(e.description);
  }

  // Split the 30-day window into two halves to detect trend
  const now = new Date();
  const fifteenDaysAgo = new Date(now);
  fifteenDaysAgo.setDate(now.getDate() - 15);

  for (const [category, info] of Object.entries(byCategory)) {
    const recent = info.dates.filter((d) => d >= fifteenDaysAgo);
    const older = info.dates.filter((d) => d < fifteenDaysAgo);
    const recentTotal = recent.length;
    const olderTotal = older.length;

    let trend: "up" | "down" | "stable" = "stable";
    if (olderTotal > 0) {
      const ratio = recentTotal / olderTotal;
      if (ratio > 1.2) trend = "up";
      else if (ratio < 0.8) trend = "down";
    } else if (recentTotal > 0) {
      trend = "up";
    }

    const budget = budgets.find((b) => b.category === category);
    const budgetLimit = budget ? budget.limit : null;
    const percentOfBudget =
      budgetLimit && budgetLimit > 0
        ? Math.round((info.total / budgetLimit) * 100)
        : null;

    let insight = "";
    if (percentOfBudget !== null) {
      if (percentOfBudget >= 100) {
        insight = `تجاوزت الميزانية المخصصة لهذه الفئة بمقدار ${percentOfBudget - 100}%`;
      } else if (percentOfBudget >= 80) {
        insight = `اقتربت من حد الميزانية (${percentOfBudget}%)`;
      } else {
        insight = `ضمن الميزانية (${percentOfBudget}% من الحد)`;
      }
    } else if (trend === "up") {
      insight = `ارتفاع في الإنفاق مؤخراً (${recentTotal} عملية في آخر 15 يوم)`;
    } else if (trend === "down") {
      insight = `انخفاض في الإنفاق مؤخراً`;
    } else {
      insight = `إنفاق مستقر`;
    }

    patterns.push({
      category,
      total: Math.round(info.total),
      count: info.count,
      average: Math.round(info.total / info.count),
      budget: budgetLimit,
      percentOfBudget,
      trend,
      insight,
    });
  }

  // Sort by total spend descending
  patterns.sort((a, b) => b.total - a.total);
  return patterns;
}

function computeTaskSuggestions(
  tasks: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    createdAt: Date;
  }>
) {
  const suggestions: Array<{
    type: string;
    title: string;
    reason: string;
    priority: "high" | "medium" | "low";
    relatedTaskId?: string;
  }> = [];

  const pending = tasks.filter((t) => t.status !== "done");
  const now = new Date();

  // Overdue tasks
  const overdue = pending.filter(
    (t) => t.dueDate && new Date(t.dueDate).getTime() < now.getTime()
  );
  for (const t of overdue) {
    const daysLate = Math.floor(
      (now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
    );
    suggestions.push({
      type: "overdue",
      title: `إنجاز المهمة المتأخرة: ${t.title}`,
      reason: `متأخرة بمقدار ${daysLate} يوم${
        t.priority === "high" ? " — ذات أولوية عالية" : ""
      }`,
      priority: t.priority === "high" ? "high" : "medium",
      relatedTaskId: t.id,
    });
  }

  // High priority pending tasks
  const highPriority = pending.filter(
    (t) =>
      t.priority === "high" &&
      (!t.dueDate || new Date(t.dueDate).getTime() >= now.getTime())
  );
  for (const t of highPriority.slice(0, 5)) {
    suggestions.push({
      type: "high_priority",
      title: `التركيز على: ${t.title}`,
      reason: "مهمة ذات أولوية عالية بانتظار الإنجاز",
      priority: "high",
      relatedTaskId: t.id,
    });
  }

  // Tasks due soon (within 3 days)
  const soon = pending.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate).getTime();
    const diff = (due - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  });
  for (const t of soon) {
    suggestions.push({
      type: "due_soon",
      title: `استباق الموعد: ${t.title}`,
      reason: "الموعد النهائي خلال 3 أيام",
      priority: "medium",
      relatedTaskId: t.id,
    });
  }

  // Tasks stuck in "doing" for too long
  const doing = pending.filter((t) => t.status === "doing");
  for (const t of doing) {
    const daysOld = Math.floor(
      (now.getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysOld > 3) {
      suggestions.push({
        type: "stuck",
        title: `إتمام المهمة المعلقة: ${t.title}`,
        reason: `قيد التنفيذ منذ ${daysOld} يوم — قد تحتاج لتفصيل أو مساعدة`,
        priority: "medium",
        relatedTaskId: t.id,
      });
    }
  }

  // Category-based suggestion: if many pending tasks share a category
  const categoryCounts: Record<string, number> = {};
  for (const t of pending) {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  }
  for (const [category, count] of Object.entries(categoryCounts)) {
    if (count >= 4) {
      suggestions.push({
        type: "batch",
        title: `إنجاز مهام "${category}" دفعة واحدة`,
        reason: `لديك ${count} مهام معلقة في نفس الفئة — التجميع يوفر الوقت`,
        priority: "low",
      });
    }
  }

  // Sort by priority
  const order = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
  return suggestions;
}

function computeBestTimes(
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    category: string;
    updatedAt: Date;
    createdAt: Date;
  }>
) {
  // Analyze when tasks were completed (using updatedAt as a proxy for completion time)
  const done = tasks.filter((t) => t.status === "done");

  const hourBuckets: Record<number, number> = {};
  const dayBuckets: Record<number, number> = {}; // 0 = Sunday
  const dayNames = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];

  for (const t of done) {
    const completedAt = new Date(t.updatedAt);
    hourBuckets[completedAt.getHours()] =
      (hourBuckets[completedAt.getHours()] || 0) + 1;
    dayBuckets[completedAt.getDay()] =
      (dayBuckets[completedAt.getDay()] || 0) + 1;
  }

  const bestTimes: Array<{
    type: "hour" | "day";
    label: string;
    value: number;
    count: number;
    recommendation: string;
  }> = [];

  // Best hours
  const sortedHours = Object.entries(hourBuckets).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [hourStr, count] of sortedHours.slice(0, 3)) {
    const hour = Number(hourStr);
    const period = hour < 12 ? "صباحاً" : "مساءً";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    bestTimes.push({
      type: "hour",
      label: `${displayHour}:00 ${period}`,
      value: hour,
      count,
      recommendation: `أنت أكثر إنتاجية في هذه الساعة (${count} مهمة منجزة)`,
    });
  }

  // Best days
  const sortedDays = Object.entries(dayBuckets).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [dayStr, count] of sortedDays.slice(0, 3)) {
    const day = Number(dayStr);
    bestTimes.push({
      type: "day",
      label: dayNames[day],
      value: day,
      count,
      recommendation: `أنجزت ${count} مهمة في هذا اليوم — مناسب للمهام الكبيرة`,
    });
  }

  if (bestTimes.length === 0) {
    bestTimes.push({
      type: "hour",
      label: "أي وقت",
      value: -1,
      count: 0,
      recommendation:
        "لا توجد بيانات كافية بعد — ابدأ بإنجاز المهام لاكتشاف أنماطك",
    });
  }

  return bestTimes;
}

function computePredictiveAlerts(
  expenses: Array<{
    amount: number;
    currency: string;
    category: string;
    date: Date;
  }>,
  budgets: Array<{ category: string; limit: number }>,
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: Date | null;
    priority: string;
  }>,
  monthStart: Date,
  now: Date
) {
  const alerts: Array<{
    severity: "critical" | "warning" | "info";
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }> = [];

  // ---- Budget burn rate ----
  const monthExpenses = expenses.filter((e) => new Date(e.date) >= monthStart);
  const totalSpentThisMonth = monthExpenses.reduce(
    (sum, e) => sum + normalizeAmount(e.amount, e.currency),
    0
  );

  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);

  if (totalBudget > 0) {
    const daysElapsed = Math.max(
      1,
      Math.ceil((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const expectedSpend = (totalBudget / daysInMonth) * daysElapsed;
    const burnRatePercent = Math.round((totalSpentThisMonth / expectedSpend) * 100);

    if (totalSpentThisMonth > totalBudget) {
      alerts.push({
        severity: "critical",
        type: "budget_exceeded",
        title: "تجاوز الميزانية الشهرية",
        message: `تجاوزت إجمالي الميزانية بمقدار ${Math.round(
          totalSpentThisMonth - totalBudget
        )} ل.س`,
        data: {
          spent: Math.round(totalSpentThisMonth),
          budget: totalBudget,
          overBy: Math.round(totalSpentThisMonth - totalBudget),
        },
      });
    } else if (burnRatePercent > 110) {
      const projectedEndOfMonth =
        (totalSpentThisMonth / daysElapsed) *
        new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      alerts.push({
        severity: "warning",
        type: "budget_burn_rate",
        title: "معدل الإنفاق مرتفع",
        message: `تنفق ${burnRatePercent}% من المعدل المتوقع. يُتوقع وصول الإنفاق إلى ${Math.round(
          projectedEndOfMonth
        )} ل.س بنهاية الشهر (الميزانية: ${totalBudget})`,
        data: {
          burnRatePercent,
          projectedEndOfMonth: Math.round(projectedEndOfMonth),
          budget: totalBudget,
        },
      });
    } else if (burnRatePercent < 70 && daysElapsed > 10) {
      alerts.push({
        severity: "info",
        type: "budget_under",
        title: "إنفاق أقل من المتوقع",
        message: `معدل الإنفاق ${burnRatePercent}% من المتوقع — أداء جيد`,
        data: { burnRatePercent, spent: Math.round(totalSpentThisMonth) },
      });
    }
  }

  // ---- Per-category budget alerts ----
  for (const budget of budgets) {
    const spent = monthExpenses
      .filter((e) => e.category === budget.category)
      .reduce((sum, e) => sum + normalizeAmount(e.amount, e.currency), 0);
    const percent = (spent / budget.limit) * 100;
    if (percent >= 100) {
      alerts.push({
        severity: "critical",
        type: "category_budget_exceeded",
        title: `تجاوز ميزانية: ${budget.category}`,
        message: `أنفقت ${Math.round(percent)}% من ميزانية "${
          budget.category
        }"`,
        data: {
          category: budget.category,
          spent: Math.round(spent),
          limit: budget.limit,
          percent: Math.round(percent),
        },
      });
    } else if (percent >= 80) {
      alerts.push({
        severity: "warning",
        type: "category_budget_warning",
        title: `اقتراب من حد الميزانية: ${budget.category}`,
        message: `استهلكت ${Math.round(percent)}% من ميزانية "${
          budget.category
        }"`,
        data: {
          category: budget.category,
          spent: Math.round(spent),
          limit: budget.limit,
          percent: Math.round(percent),
        },
      });
    }
  }

  // ---- Upcoming deadlines ----
  const pending = tasks.filter((t) => t.status !== "done" && t.dueDate);
  const next7Days = new Date(now);
  next7Days.setDate(now.getDate() + 7);

  const upcoming = pending.filter((t) => {
    const due = new Date(t.dueDate!);
    return due >= now && due <= next7Days;
  });

  if (upcoming.length > 0) {
    const highCount = upcoming.filter((t) => t.priority === "high").length;
    alerts.push({
      severity: highCount > 0 ? "warning" : "info",
      type: "upcoming_deadlines",
      title: "مواعيد نهائية قريبة",
      message: `لديك ${upcoming.length} مهمة يجب إنجازها خلال 7 أيام${
        highCount > 0 ? ` (${highCount} ذات أولوية عالية)` : ""
      }`,
      data: {
        count: upcoming.length,
        highPriorityCount: highCount,
        tasks: upcoming.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
        })),
      },
    });
  }

  // ---- Overdue tasks ----
  const overdueCount = pending.filter(
    (t) => new Date(t.dueDate!).getTime() < now.getTime()
  ).length;
  if (overdueCount > 0) {
    alerts.push({
      severity: "critical",
      type: "overdue_tasks",
      title: "مهام متأخرة",
      message: `لديك ${overdueCount} مهمة تجاوزت موعدها النهائي`,
      data: { count: overdueCount },
    });
  }

  // ---- High spend day detection ----
  const byDay: Record<string, number> = {};
  for (const e of expenses) {
    const key = new Date(e.date).toISOString().split("T")[0];
    byDay[key] = (byDay[key] || 0) + normalizeAmount(e.amount, e.currency);
  }
  const dailyValues = Object.values(byDay);
  if (dailyValues.length > 5) {
    const avg =
      dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length;
    const spikeDay = Object.entries(byDay).find(([, v]) => v > avg * 3);
    if (spikeDay) {
      alerts.push({
        severity: "info",
        type: "spend_spike",
        title: "ارتفاع غير معتاد في الإنفاق",
        message: `يوم ${spikeDay[0]} شهد إنفاقاً ${Math.round(
          (spikeDay[1] / avg) * 100
        )}% أعلى من المتوسط اليومي`,
        data: {
          date: spikeDay[0],
          amount: Math.round(spikeDay[1]),
          average: Math.round(avg),
        },
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}
