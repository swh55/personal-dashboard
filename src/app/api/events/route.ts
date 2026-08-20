import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [] });
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = { userId, deletedAt: null };
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate.gte = new Date(from);
      if (to) where.startDate.lte = new Date(to);
    }

    const events = await db.event.findMany({
      where,
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error("GET events error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الأحداث" }, { status: 500 });
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
    const { title, description, startDate, endDate, allDay, type, color, location } = body;

    if (!title || !startDate) {
      return NextResponse.json({ success: false, error: "العنوان وتاريخ البدء مطلوبان" }, { status: 400 });
    }

    const event = await db.event.create({
      data: {
        title,
        description: description || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        allDay: allDay || false,
        type: type || "personal",
        color: color || "emerald",
        location: location || null,
        userId,
      },
    });

    await logActivity("create", "event", `أضيف حدث: ${title}`, userId);
    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error("POST event error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة الحدث" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    const event = await db.event.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error("PUT event error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الحدث" }, { status: 500 });
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
    // Ownership check applies to both soft and hard delete
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    if (force) {
      await db.event.delete({ where: { id } });
    } else {
      await db.event.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE event error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف الحدث" }, { status: 500 });
  }
}
