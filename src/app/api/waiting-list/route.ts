import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET: returns all waiting items ordered by priority (higher first)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], meta: { count: 0, ready: 0, pending: 0 } });
    }
    const userId = user.id;
    const searchParams = req.nextUrl.searchParams;
    const readyOnly = searchParams.get("ready") === "true";
    const pendingOnly = searchParams.get("pending") === "true";

    const where: Record<string, unknown> = { userId };
    if (readyOnly) {
      where.ready = true;
    } else if (pendingOnly) {
      where.ready = false;
    }

    const items = await db.waitingItem.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: items,
      meta: {
        count: items.length,
        ready: items.filter((i) => i.ready).length,
        pending: items.filter((i) => !i.ready).length,
      },
    });
  } catch (error) {
    console.error("GET waiting-list error:", error);
    return NextResponse.json(
      { success: false, error: "فشل جلب قائمة الانتظار" },
      { status: 500 }
    );
  }
}

// POST: create a new waiting item
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
    const body = await req.json();
    const { title, description, priority, ready } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "العنوان مطلوب" },
        { status: 400 }
      );
    }

    const item = await db.waitingItem.create({
      data: {
        title,
        description: description || null,
        priority: priority !== undefined ? Number(priority) : 0,
        ready: ready !== undefined ? Boolean(ready) : false,
        userId,
      },
    });

    await logActivity(
      "create",
      "waiting_item",
      `تمت إضافة عنصر لقائمة الانتظار: ${title}`,
      userId
    );
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error("POST waiting-list error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إضافة عنصر قائمة الانتظار" },
      { status: 500 }
    );
  }
}

// PUT: update a waiting item or toggle its ready state
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
    const body = await req.json();
    const { id, ready, priority, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرف مطلوب" },
        { status: 400 }
      );
    }

    // Ownership check
    const existing = await db.waitingItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = { ...rest };
    if (ready !== undefined) {
      data.ready = Boolean(ready);
    }
    if (priority !== undefined) {
      data.priority = Number(priority);
    }

    const updated = await db.waitingItem.update({
      where: { id },
      data,
    });

    if (ready !== undefined) {
      await logActivity(
        "toggle",
        "waiting_item",
        `${ready ? "تمييز كجاهز" : "تمييز كغير جاهز"}: ${updated.title}`,
        userId
      );
    } else {
      await logActivity(
        "update",
        "waiting_item",
        `تم تحديث عنصر: ${updated.title}`,
        userId
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT waiting-list error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحديث عنصر قائمة الانتظار" },
      { status: 500 }
    );
  }
}

// DELETE: remove a waiting item by id
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
    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرف مطلوب" },
        { status: 400 }
      );
    }

    const existing = await db.waitingItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    const item = await db.waitingItem.delete({ where: { id } });
    await logActivity(
      "delete",
      "waiting_item",
      `تم حذف عنصر: ${item.title}`,
      userId
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE waiting-list error:", error);
    return NextResponse.json(
      { success: false, error: "فشل حذف عنصر قائمة الانتظار" },
      { status: 500 }
    );
  }
}
