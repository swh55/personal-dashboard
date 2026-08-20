import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], stats: { total: 0, upcoming: 0, completed: 0, cancelled: 0 } });
    }
    const userId = user.id;
    const meetings = await db.meeting.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startDate: "asc" },
    });
    const now = new Date();
    const stats = {
      total: meetings.length,
      upcoming: meetings.filter((m) => new Date(m.startDate) > now && m.status === "scheduled").length,
      completed: meetings.filter((m) => m.status === "completed").length,
      cancelled: meetings.filter((m) => m.status === "cancelled").length,
    };
    return NextResponse.json({ success: true, data: meetings, stats });
  } catch (error) {
    console.error("GET meetings error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الاجتماعات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { title, agenda, notes, location, participants, startDate, endDate, status } = await req.json();
    if (!title || !startDate) return NextResponse.json({ success: false, error: "العنوان والتاريخ مطلوبان" }, { status: 400 });
    const meeting = await db.meeting.create({
      data: {
        title,
        agenda: agenda || null,
        notes: notes || null,
        location: location || null,
        participants: participants || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: status || "scheduled",
        userId,
      },
    });
    await logActivity("create", "meeting", `أضيف اجتماع: ${title}`, userId);
    return NextResponse.json({ success: true, data: meeting }, { status: 201 });
  } catch (error) {
    console.error("POST meeting error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة الاجتماع" }, { status: 500 });
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
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const existing = await db.meeting.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    const meeting = await db.meeting.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: meeting });
  } catch (error) {
    console.error("PUT meeting error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الاجتماع" }, { status: 500 });
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
    const existing = await db.meeting.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    if (force) await db.meeting.delete({ where: { id } });
    else await db.meeting.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE meeting error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف الاجتماع" }, { status: 500 });
  }
}
