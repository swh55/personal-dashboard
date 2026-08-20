import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [] });
    }
    const userId = user.id;
    const logs = await db.callLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { contact: true },
    });
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("GET calllogs error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب سجل المكالمات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const body = await req.json();
    const { contactId, name, phone, type, direction, note } = body;

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: "الاسم والهاتف مطلوبان" }, { status: 400 });
    }

    const log = await db.callLog.create({
      data: {
        contactId: contactId || null,
        name,
        phone,
        type: type || "call",
        direction: direction || "outgoing",
        note: note || null,
        userId,
      },
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error("POST calllog error:", error);
    return NextResponse.json({ success: false, error: "فشل تسجيل المكالمة" }, { status: 500 });
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

    if (!id) {
      // حذف الكل — scoped to this user only
      await db.callLog.deleteMany({ where: { userId } });
      return NextResponse.json({ success: true });
    }

    const existing = await db.callLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    await db.callLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE calllog error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف السجل" }, { status: 500 });
  }
}
