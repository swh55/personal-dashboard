import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [] });
    }
    const userId = user.id;
    const locations = await db.savedLocation.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error("GET locations error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الأماكن" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { name, address, lat, lng, icon, color } = await req.json();
    if (!name || lat === undefined || lng === undefined) {
      return NextResponse.json({ success: false, error: "الاسم والإحداثيات مطلوبة" }, { status: 400 });
    }
    const location = await db.savedLocation.create({
      data: { name, address: address || "", lat: Number(lat), lng: Number(lng), icon: icon || "MapPin", color: color || "blue", userId },
    });
    return NextResponse.json({ success: true, data: location }, { status: 201 });
  } catch (error) {
    console.error("POST location error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة المكان" }, { status: 500 });
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
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    const existing = await db.savedLocation.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    await db.savedLocation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE location error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
