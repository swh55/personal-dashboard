import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const relation = searchParams.get("relation");
    const favorite = searchParams.get("favorite");

    const where: Record<string, unknown> = {};
    where.deletedAt = null;
    if (relation) where.relation = relation;
    if (favorite === "true") where.favorite = true;

    const contacts = await db.contact.findMany({
      where,
      orderBy: [{ favorite: "desc" }, { name: "asc" }],
      include: { _count: { select: { calls: true } } },
    });

    return NextResponse.json({ success: true, data: contacts });
  } catch (error) {
    console.error("GET contacts error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب جهات الاتصال" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, whatsapp, email, relation, category, note, favorite, avatar } = body;

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: "الاسم والهاتف مطلوبان" }, { status: 400 });
    }

    const contact = await db.contact.create({
      data: {
        name,
        phone,
        whatsapp: whatsapp || null,
        email: email || null,
        relation: relation || "other",
        category: category || null,
        note: note || null,
        favorite: favorite || false,
        avatar: avatar || null,
      },
    });

    await logActivity("create", "contact", `أضيف جهة اتصال: ${name}`);
    return NextResponse.json({ success: true, data: contact }, { status: 201 });
  } catch (error) {
    console.error("POST contact error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة جهة الاتصال" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    }

    const contact = await db.contact.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    console.error("PUT contact error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث جهة الاتصال" }, { status: 500 });
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
      await db.contact.delete({ where: { id } });
    } else {
      await db.contact.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE contact error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف جهة الاتصال" }, { status: 500 });
  }
}
