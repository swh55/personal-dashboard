import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

type ChecklistInput = { text: string; done?: boolean; order?: number } | string;

/**
 * Compute the "effective" progress of a single project.
 *  - If the project has checklist items: doneItems / totalItems * 100
 *  - Otherwise: the manual `progress` field (0-100)
 */
function effectiveProgress(
  progress: number,
  checklist: { done: boolean }[]
): number {
  if (checklist.length === 0) return progress;
  const done = checklist.filter((c) => c.done).length;
  return Math.round((done / checklist.length) * 100);
}

/**
 * Normalize the incoming checklist payload into Prisma-ready create objects.
 * Accepts either a plain string (the text) or an object { text, done, order }.
 */
function normalizeChecklist(items: ChecklistInput[] | undefined | null) {
  if (!Array.isArray(items)) return null;
  return items
    .map((raw, i) => {
      const text = typeof raw === "string" ? raw.trim() : String(raw?.text ?? "").trim();
      if (!text) return null;
      return {
        text,
        done: typeof raw === "object" && raw ? Boolean(raw.done) : false,
        order: typeof raw === "object" && raw && typeof raw.order === "number" ? raw.order : i,
      };
    })
    .filter((x): x is { text: string; done: boolean; order: number } => x !== null);
}

// ----------------------------------------------------------------------------
// GET — list all projects for the current user
// ----------------------------------------------------------------------------
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: true,
        data: [],
        stats: { total: 0, active: 0, completed: 0, paused: 0, avgProgress: 0 },
      });
    }
    const userId = user.id;
    const projects = await db.project.findMany({
      where: { userId, deletedAt: null },
      include: {
        _count: { select: { tasks: true } },
        checklist: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Effective per-project progress: checklist-aware if a checklist exists.
    const withProgress = projects.map((p) => ({
      ...p,
      effectiveProgress: effectiveProgress(p.progress, p.checklist),
    }));

    const stats = {
      total: withProgress.length,
      active: withProgress.filter((p) => p.status === "active").length,
      completed: withProgress.filter((p) => p.status === "completed").length,
      paused: withProgress.filter((p) => p.status === "paused").length,
      avgProgress: withProgress.length
        ? Math.round(
            withProgress.reduce((s, p) => s + p.effectiveProgress, 0) /
              withProgress.length
          )
        : 0,
    };
    return NextResponse.json({ success: true, data: withProgress, stats });
  } catch (error) {
    console.error("GET projects error:", error);
    return NextResponse.json(
      { success: false, error: "فشل جلب المشاريع" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// POST — create a new project (optionally with an initial checklist)
// ----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const userId = user.id;
    const {
      name,
      description,
      status,
      color,
      progress,
      startDate,
      endDate,
      checklist,
    } = await req.json();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "الاسم مطلوب" },
        { status: 400 }
      );
    }

    const checklistItems = normalizeChecklist(checklist);

    const project = await db.project.create({
      data: {
        name,
        description: description || null,
        status: status || "active",
        color: color || "emerald",
        progress: Number(progress) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId,
        ...(checklistItems && checklistItems.length > 0
          ? { checklist: { create: checklistItems } }
          : {}),
      },
      include: { checklist: { orderBy: { order: "asc" } } },
    });
    await logActivity("create", "project", `أضيف مشروع: ${name}`, userId);
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    console.error("POST project error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إضافة المشروع" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// PUT — update a project (optionally replace the entire checklist)
// ----------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const userId = user.id;
    const { id, checklist, ...data } = await req.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرف مطلوب" },
        { status: 400 }
      );
    }
    if (data.progress !== undefined) data.progress = Number(data.progress);
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    // If a `checklist` array was sent, replace the entire checklist.
    // We treat `checklist === undefined` as "leave it alone" so existing
    // routes that only update other fields don't wipe the items.
    const hasChecklist = Array.isArray(checklist);
    const checklistItems = hasChecklist ? normalizeChecklist(checklist) : null;

    const project = await db.project.update({
      where: { id },
      data: {
        ...data,
        ...(hasChecklist
          ? {
              checklist: {
                deleteMany: {},
                create: checklistItems || [],
              },
            }
          : {}),
      },
      include: { checklist: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    console.error("PUT project error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحديث المشروع" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// DELETE — soft delete a project (or hard delete with ?force=true)
// ----------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const force = searchParams.get("force") === "true";
    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرف مطلوب" },
        { status: 400 }
      );
    }
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }
    if (force) await db.project.delete({ where: { id } });
    else await db.project.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE project error:", error);
    return NextResponse.json(
      { success: false, error: "فشل حذف المشروع" },
      { status: 500 }
    );
  }
}
