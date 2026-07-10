import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const logs = await db.callLog.findMany({
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      // حذف الكل
      await db.callLog.deleteMany({});
      return NextResponse.json({ success: true });
    }

    await db.callLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE calllog error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف السجل" }, { status: 500 });
  }
}
