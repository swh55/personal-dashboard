import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 100);
    const entity = searchParams.get("entity");

    const where: any = {};
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
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before");
    const where: any = {};
    if (before) where.createdAt = { lt: new Date(before) };
    await db.activityLog.deleteMany({ where });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE activity error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
