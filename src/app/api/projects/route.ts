import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET() {
  try {
    const projects = await db.project.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    });
    const stats = {
      total: projects.length,
      active: projects.filter((p) => p.status === "active").length,
      completed: projects.filter((p) => p.status === "completed").length,
      paused: projects.filter((p) => p.status === "paused").length,
      avgProgress: projects.length
        ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
        : 0,
    };
    return NextResponse.json({ success: true, data: projects, stats });
  } catch (error) {
    console.error("GET projects error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب المشاريع" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, status, color, progress, startDate, endDate } = await req.json();
    if (!name) return NextResponse.json({ success: false, error: "الاسم مطلوب" }, { status: 400 });
    const project = await db.project.create({
      data: {
        name,
        description: description || null,
        status: status || "active",
        color: color || "emerald",
        progress: Number(progress) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    await logActivity("create", "project", `أضيف مشروع: ${name}`);
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    console.error("POST project error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة المشروع" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.progress !== undefined) data.progress = Number(data.progress);
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const project = await db.project.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    console.error("PUT project error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث المشروع" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const force = searchParams.get("force") === "true";
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (force) await db.project.delete({ where: { id } });
    else await db.project.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE project error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف المشروع" }, { status: 500 });
  }
}
