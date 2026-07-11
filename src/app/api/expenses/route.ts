import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = { deletedAt: null };
    if (category) where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const totalSYP = expenses
      .filter((e) => e.currency === "syp")
      .reduce((s, e) => s + e.amount, 0);
    const totalUSD = expenses
      .filter((e) => e.currency === "usd")
      .reduce((s, e) => s + e.amount, 0);

    // Group by category
    const byCategory: Record<string, { syp: number; usd: number; count: number }> = {};
    for (const e of expenses) {
      if (!byCategory[e.category]) byCategory[e.category] = { syp: 0, usd: 0, count: 0 };
      if (e.currency === "syp") byCategory[e.category].syp += e.amount;
      else byCategory[e.category].usd += e.amount;
      byCategory[e.category].count++;
    }

    return NextResponse.json({
      success: true,
      data: expenses,
      stats: { totalSYP, totalUSD, count: expenses.length, byCategory },
    });
  } catch (error) {
    console.error("GET expenses error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب المصروفات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency, category, description, date } = body;
    if (!amount) return NextResponse.json({ success: false, error: "المبلغ مطلوب" }, { status: 400 });

    const expense = await db.expense.create({
      data: {
        amount: Number(amount),
        currency: currency || "syp",
        category: category || "general",
        description: description || null,
        date: date ? new Date(date) : new Date(),
      },
    });
    await logActivity("create", "expense", `تسجيل مصروف: ${amount} ${currency}`);
    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error("POST expense error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة المصروف" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.amount !== undefined) data.amount = Number(data.amount);
    if (data.date) data.date = new Date(data.date);
    const expense = await db.expense.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    console.error("PUT expense error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث المصروف" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const force = searchParams.get("force") === "true";
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (force) await db.expense.delete({ where: { id } });
    else await db.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE expense error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف المصروف" }, { status: 500 });
  }
}
