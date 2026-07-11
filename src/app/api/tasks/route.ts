import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const tasks = await db.task.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: { project: true },
    });

    const stats = {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === "todo").length,
      doing: tasks.filter((t) => t.status === "doing").length,
      done: tasks.filter((t) => t.status === "done").length,
      high: tasks.filter((t) => t.priority === "high").length,
      overdue: tasks.filter(
        (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()
      ).length,
    };

    return NextResponse.json({ success: true, data: tasks, stats });
  } catch (error) {
    console.error("GET tasks error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب المهام" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, status, priority, category, dueDate, projectId } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: "العنوان مطلوب" }, { status: 400 });
    }

    const task = await db.task.create({
      data: {
        title,
        description: description || null,
        status: status || "todo",
        priority: priority || "medium",
        category: category || "general",
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
      },
    });

    await logActivity("create", "task", `أضيف مهمة: ${title}`);
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    console.error("POST task error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة المهمة" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    const task = await db.task.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("PUT task error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث المهمة" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const force = searchParams.get("force") === "true";
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (force) {
      await db.task.delete({ where: { id } });
    } else {
      await db.task.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE task error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف المهمة" }, { status: 500 });
  }
}
