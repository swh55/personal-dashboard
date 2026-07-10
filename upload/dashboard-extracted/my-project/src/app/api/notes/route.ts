import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET() {
  try {
    const notes = await db.note.findMany({
      where: { deletedAt: null },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    console.error("GET notes error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الملاحظات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, color, pinned } = body;

    if (!title || !content) {
      return NextResponse.json({ success: false, error: "العنوان والمحتوى مطلوبان" }, { status: 400 });
    }

    const note = await db.note.create({
      data: {
        title,
        content,
        color: color || "default",
        pinned: pinned || false,
      },
    });

    await logActivity("create", "note", `أضيف ملاحظة: ${title}`);
    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error) {
    console.error("POST note error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة الملاحظة" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    }

    const note = await db.note.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    console.error("PUT note error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الملاحظة" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const force = searchParams.get("force") === "true";

    if (!id) {
      return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    }

    if (force) {
      await db.note.delete({ where: { id } });
    } else {
      await db.note.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE note error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف الملاحظة" }, { status: 500 });
  }
}
