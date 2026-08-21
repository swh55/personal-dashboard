import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Verify ownership of the project and return it; null otherwise. */
async function getOwnedProject(projectId: string, userId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== userId || project.deletedAt) return null;
  return project;
}

/**
 * Sync the parent project's manual `progress` field with the checklist
 * completion ratio. Called after every checklist mutation so consumers that
 * only read `project.progress` (e.g. dashboards, lists) stay accurate.
 */
async function syncProjectProgress(projectId: string) {
  const items = await db.projectChecklistItem.findMany({
    where: { projectId },
    select: { done: true },
  });
  const total = items.length;
  const progress = total === 0
    ? 0
    : Math.round((items.filter((i) => i.done).length / total) * 100);
  await db.project.update({
    where: { id: projectId },
    data: { progress },
  });
  return { total, done: items.filter((i) => i.done).length, progress };
}

// ----------------------------------------------------------------------------
// POST — add a checklist item to a project
// Body: { text: string, order?: number }
// ----------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const { id: projectId } = await params;
    const project = await getOwnedProject(projectId, user.id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }
    const { text, order } = await req.json();
    const trimmed = typeof text === "string" ? text.trim() : "";
    if (!trimmed) {
      return NextResponse.json(
        { success: false, error: "النص مطلوب" },
        { status: 400 }
      );
    }
    // Determine the next order index if not provided.
    let nextOrder = typeof order === "number" ? order : 0;
    if (typeof order !== "number") {
      const last = await db.projectChecklistItem.findFirst({
        where: { projectId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      nextOrder = (last?.order ?? -1) + 1;
    }
    const item = await db.projectChecklistItem.create({
      data: { projectId, text: trimmed, order: nextOrder },
    });
    const progress = await syncProjectProgress(projectId);
    await logActivity(
      "create",
      "project-checklist",
      `أضفت بندًا لقائمة المشروع: ${project.name}`,
      user.id
    );
    return NextResponse.json(
      { success: true, data: item, progress: progress.progress },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST checklist error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إضافة البند" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// PUT — update a checklist item (toggle done / rename text / reorder)
// Body: { id: string, text?: string, done?: boolean, order?: number }
// ----------------------------------------------------------------------------
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const { id: projectId } = await params;
    const project = await getOwnedProject(projectId, user.id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }
    const body = await req.json();
    const itemId: string | undefined = body.id;
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "معرف البند مطلوب" },
        { status: 400 }
      );
    }

    // Verify the item belongs to this project (avoids cross-project edits).
    const existing = await db.projectChecklistItem.findUnique({
      where: { id: itemId },
    });
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    const update: { text?: string; done?: boolean; order?: number } = {};
    if (typeof body.text === "string") {
      const trimmed = body.text.trim();
      if (!trimmed) {
        return NextResponse.json(
          { success: false, error: "النص لا يمكن أن يكون فارغًا" },
          { status: 400 }
        );
      }
      update.text = trimmed;
    }
    if (typeof body.done === "boolean") update.done = body.done;
    if (typeof body.order === "number") update.order = body.order;

    const item = await db.projectChecklistItem.update({
      where: { id: itemId },
      data: update,
    });
    const progress = await syncProjectProgress(projectId);
    return NextResponse.json({
      success: true,
      data: item,
      progress: progress.progress,
    });
  } catch (error) {
    console.error("PUT checklist error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحديث البند" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// DELETE — remove a checklist item
// Query: ?itemId=<id>
// ----------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const { id: projectId } = await params;
    const project = await getOwnedProject(projectId, user.id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "معرف البند مطلوب" },
        { status: 400 }
      );
    }
    const existing = await db.projectChecklistItem.findUnique({
      where: { id: itemId },
    });
    if (!existing || existing.projectId !== projectId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }
    await db.projectChecklistItem.delete({ where: { id: itemId } });
    const progress = await syncProjectProgress(projectId);
    return NextResponse.json({ success: true, progress: progress.progress });
  } catch (error) {
    console.error("DELETE checklist error:", error);
    return NextResponse.json(
      { success: false, error: "فشل حذف البند" },
      { status: 500 }
    );
  }
}
