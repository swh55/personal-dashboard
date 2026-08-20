import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 100);
    const entity = searchParams.get("entity");

    const where: any = { userId };
    if (entity) where.entity = entity;

    const logs = await db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, data: logs, count: logs.length });
  } catch (error) {
    console.error("GET activity error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب السجل" }, { status: 500 });
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
    const before = searchParams.get("before");
    const where: any = { userId };
    if (before) where.createdAt = { lt: new Date(before) };
    await db.activityLog.deleteMany({ where });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE activity error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
