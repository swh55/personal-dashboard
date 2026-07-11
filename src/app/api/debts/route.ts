import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET() {
  try {
    const debts = await db.debt.findMany({
      where: { settled: false, deletedAt: null },
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
    const { personName, amount, currency, type, description, dueDate } = await req.json();
    if (!personName || !amount) return NextResponse.json({ success: false, error: "الاسم والمبلغ مطلوبان" }, { status: 400 });
    const debt = await db.debt.create({ data: { personName, amount: Number(amount), currency: currency || "syp", type: type || "owed", description, dueDate: dueDate ? new Date(dueDate) : null } });

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
          },
        });
      } catch {}
    }

    await logActivity("create", "debt", `أضيف دين: ${personName} (${amount} ${currency})`);
    return NextResponse.json({ success: true, data: debt }, { status: 201 });
  } catch (error) {
    console.error("POST debt error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة الدين" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (data.settled) data.settledAt = new Date();
    const debt = await db.debt.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: debt });
  } catch (error) {
    console.error("PUT debt error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الدين" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    await db.debt.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE debt error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف الدين" }, { status: 500 });
  }
}
