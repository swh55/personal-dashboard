import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = { deletedAt: null };
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
      },
    });

    await logActivity("create", "event", `أضيف حدث: ${title}`);
    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error("POST event error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة الحدث" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const event = await db.event.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error("PUT event error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الحدث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const force = searchParams.get("force") === "true";
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
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
