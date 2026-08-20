import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { USD_TO_SYP } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], stats: { totalBudget: 0, totalSpent: 0, totalRemaining: 0, percent: 0 } });
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const now = new Date();
    const m = month ? Number(month) : now.getMonth() + 1;
    const y = year ? Number(year) : now.getFullYear();

    const budgets = await db.budget.findMany({ where: { userId, month: m, year: y } });

    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
    const expenses = await db.expense.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd }, deletedAt: null },
    });

    const toSYP = (amount: number, currency: string) =>
      currency === "usd" ? amount * USD_TO_SYP : amount;

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

    return NextResponse.json({
      success: true,
      data,
      stats: {
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        percent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
        month: m,
        year: y,
      },
    });
  } catch (error) {
    console.error("GET budget error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الميزانية" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { category, limit, month, year } = await req.json();
    if (!category || !limit) return NextResponse.json({ success: false, error: "الفئة والحد مطلوبان" }, { status: 400 });
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();

    // Upsert by userId+category+month+year (multi-tenant unique)
    const budget = await db.budget.upsert({
      where: { userId_category_month_year: { userId, category, month: m, year: y } },
      update: { limit: Number(limit) },
      create: { userId, category, limit: Number(limit), month: m, year: y },
    });
    return NextResponse.json({ success: true, data: budget }, { status: 201 });
  } catch (error) {
    console.error("POST budget error:", error);
    return NextResponse.json({ success: false, error: "فشل حفظ الميزانية" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    const existing = await db.budget.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    await db.budget.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE budget error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
