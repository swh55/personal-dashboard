import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const entries = await db.diaryEntry.findMany({
      where: { deletedAt: null },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error("GET diary error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب المذكرات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, content, mood, weather, date } = await req.json();
    if (!content) return NextResponse.json({ success: false, error: "المحتوى مطلوب" }, { status: 400 });
    const entry = await db.diaryEntry.create({
      data: { title, content, mood: mood || "neutral", weather, date: date ? new Date(date) : new Date() },
    });
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("POST diary error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة المذكرة" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.date) data.date = new Date(data.date);
    const entry = await db.diaryEntry.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("PUT diary error:", error);
    return NextResponse.json({ success: false, error: "فشل التحديث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    await db.diaryEntry.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE diary error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
