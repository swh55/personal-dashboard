import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const locations = await db.savedLocation.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error("GET locations error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الأماكن" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, address, lat, lng, icon, color } = await req.json();
    if (!name || lat === undefined || lng === undefined) {
      return NextResponse.json({ success: false, error: "الاسم والإحداثيات مطلوبة" }, { status: 400 });
    }
    const location = await db.savedLocation.create({
      data: { name, address: address || "", lat: Number(lat), lng: Number(lng), icon: icon || "MapPin", color: color || "blue" },
    });
    return NextResponse.json({ success: true, data: location }, { status: 201 });
  } catch (error) {
    console.error("POST location error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة المكان" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    await db.savedLocation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE location error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
