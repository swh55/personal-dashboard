import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], stats: { totalOwed: 0, totalOwe: 0, count: 0 } });
    }
    const userId = user.id;
    const debts = await db.debt.findMany({
      where: { userId, settled: false, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const totalOwed = debts.filter(d => d.type === "owed").reduce((s, d) => s + (d.currency === "usd" ? d.amount * 12500 : d.amount), 0);
    const totalOwe = debts.filter(d => d.type === "owe").reduce((s, d) => s + (d.currency === "usd" ? d.amount * 12500 : d.amount), 0);
    return NextResponse.json({ success: true, data: debts, stats: { totalOwed, totalOwe, count: debts.length } });
  } catch (error) {
    console.error("GET debts error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الديون" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { personName, amount, currency, type, description, dueDate } = await req.json();
    if (!personName || !amount) return NextResponse.json({ success: false, error: "الاسم والمبلغ مطلوبان" }, { status: 400 });
    const debt = await db.debt.create({ data: { personName, amount: Number(amount), currency: currency || "syp", type: type || "owed", description, dueDate: dueDate ? new Date(dueDate) : null, userId } });

    // ربط تلقائي بالتقويم
    if (dueDate) {
      try {
        await db.event.create({
          data: {
            title: `استحقاق دين: ${personName}`,
            description: `${amount} ${currency} - ${description || ""}`,
            startDate: new Date(dueDate),
            type: "personal",
            color: "amber",
            userId,
          },
        });
      } catch {}
    }

    await logActivity("create", "debt", `أضيف دين: ${personName} (${amount} ${currency})`, userId);
    return NextResponse.json({ success: true, data: debt }, { status: 201 });
  } catch (error) {
    console.error("POST debt error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة الدين" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (data.settled) data.settledAt = new Date();
    const existing = await db.debt.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    const debt = await db.debt.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: debt });
  } catch (error) {
    console.error("PUT debt error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الدين" }, { status: 500 });
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
    const existing = await db.debt.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    await db.debt.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE debt error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف الدين" }, { status: 500 });
  }
}
