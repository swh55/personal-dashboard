import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const occasions = await db.occasion.findMany({ orderBy: { date: "asc" } });
    return NextResponse.json({ success: true, data: occasions });
  } catch (error) {
    console.error("GET occasions error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب المناسبات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, date, type, recurring, note } = body;

    if (!title || !date) {
      return NextResponse.json({ success: false, error: "العنوان والتاريخ مطلوبان" }, { status: 400 });
    }

    const occasion = await db.occasion.create({
      data: {
        title,
        date: new Date(date),
        type: type || "birthday",
        recurring: recurring !== undefined ? recurring : true,
        note: note || null,
      },
    });

    return NextResponse.json({ success: true, data: occasion }, { status: 201 });
  } catch (error) {
    console.error("POST occasion error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة المناسبة" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    }

    if (data.date) data.date = new Date(data.date);

    const occasion = await db.occasion.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: occasion });
  } catch (error) {
    console.error("PUT occasion error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث المناسبة" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    }

    await db.occasion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE occasion error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف المناسبة" }, { status: 500 });
  }
}
