import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [] });
    }
    const userId = user.id;
    const messages = await db.scheduledMessage.findMany({
      where: { userId, deletedAt: null },
      orderBy: { scheduledAt: "asc" },
    });
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error("GET scheduled-messages error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الرسائل" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { recipient, message, channel, scheduledAt } = await req.json();
    if (!recipient || !message || !scheduledAt) {
      return NextResponse.json({ success: false, error: "المستلم، الرسالة، والوقت مطلوبة" }, { status: 400 });
    }
    const msg = await db.scheduledMessage.create({
      data: {
        recipient,
        message,
        channel: channel || "whatsapp",
        scheduledAt: new Date(scheduledAt),
        userId,
      },
    });
    await logActivity("create", "scheduled_message", `جدولة رسالة إلى ${recipient}`, userId);
    return NextResponse.json({ success: true, data: msg }, { status: 201 });
  } catch (error) {
    console.error("POST scheduled-message error:", error);
    return NextResponse.json({ success: false, error: "فشل الجدولة" }, { status: 500 });
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
    if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt);
    const existing = await db.scheduledMessage.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    const msg = await db.scheduledMessage.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: msg });
  } catch (error) {
    console.error("PUT scheduled-message error:", error);
    return NextResponse.json({ success: false, error: "فشل التحديث" }, { status: 500 });
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
    const force = searchParams.get("force") === "true";
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    const existing = await db.scheduledMessage.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    if (force) await db.scheduledMessage.delete({ where: { id } });
    else await db.scheduledMessage.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE scheduled-message error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
