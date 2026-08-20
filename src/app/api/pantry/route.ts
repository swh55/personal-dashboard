import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// 3. مخزون المطبخ
// GET: جلب كل عناصر المخزون
// POST: إنشاء عنصر جديد
// PUT: تحديث الكمية (أو باقي الحقول)
// DELETE: حذف عنصر حسب المعرف

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], stats: { count: 0, totalItems: 0, lowStockCount: 0 } });
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const lowOnly = searchParams.get("low") === "true";

    const items = await db.pantryItem.findMany({
      where: { userId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const filtered = lowOnly
      ? items.filter((i) => i.quantity <= i.lowStock)
      : items;

    return NextResponse.json({
      success: true,
      data: filtered,
      stats: {
        count: filtered.length,
        totalItems: items.length,
        lowStockCount: items.filter((i) => i.quantity <= i.lowStock).length,
      },
    });
  } catch (error) {
    console.error("GET pantry error:", error);
    return NextResponse.json(
      { success: false, error: "فشل جلب مخزون المطبخ" },
      { status: 500 }
    );
  }
}

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
    const { name, quantity, unit, lowStock, category } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "الاسم مطلوب" },
        { status: 400 }
      );
    }

    const item = await db.pantryItem.create({
      data: {
        name,
        quantity: Number(quantity) || 1,
        unit: unit || "piece",
        lowStock: Number(lowStock) || 1,
        category: category || "other",
        userId,
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error("POST pantry error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إضافة عنصر المخزون" },
      { status: 500 }
    );
  }
}

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
    const { id, quantity, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرف مطلوب" },
        { status: 400 }
      );
    }

    const existing = await db.pantryItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = { ...rest };
    if (quantity !== undefined) data.quantity = Number(quantity);
    if (rest.lowStock !== undefined) data.lowStock = Number(rest.lowStock);

    const item = await db.pantryItem.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("PUT pantry error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحديث عنصر المخزون" },
      { status: 500 }
    );
  }
}

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

    const existing = await db.pantryItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    await db.pantryItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE pantry error:", error);
    return NextResponse.json(
      { success: false, error: "فشل حذف عنصر المخزون" },
      { status: 500 }
    );
  }
}
