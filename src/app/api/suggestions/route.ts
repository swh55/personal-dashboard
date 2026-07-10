import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const suggestions = await db.suggestion.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("GET suggestions error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الاقتراحات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, content, category } = await req.json();
    if (!title) return NextResponse.json({ success: false, error: "العنوان مطلوب" }, { status: 400 });
    const suggestion = await db.suggestion.create({
      data: { title, content: content || "", category: category || "general" },
    });
    return NextResponse.json({ success: true, data: suggestion }, { status: 201 });
  } catch (error) {
    console.error("POST suggestion error:", error);
    return NextResponse.json({ success: false, error: "فشل الإضافة" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    const suggestion = await db.suggestion.update({ where: { id }, data: { status: status || "pending" } });
    return NextResponse.json({ success: true, data: suggestion });
  } catch (error) {
    console.error("PUT suggestion error:", error);
    return NextResponse.json({ success: false, error: "فشل التحديث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    await db.suggestion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE suggestion error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
