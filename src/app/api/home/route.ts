import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: home management — pantry, waiting list, shopping list overview
export async function GET() {
  try {
    const [pantry, waitingList] = await Promise.all([
      db.pantryItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
      db.waitingItem.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "asc" }] }),
    ]);

    const lowStock = pantry.filter((p) => p.quantity <= p.lowStock);
    const byCategory: Record<string, number> = {};
    for (const p of pantry) {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        pantry,
        waitingList,
        lowStock,
        stats: {
          totalItems: pantry.length,
          lowStockCount: lowStock.length,
          waitingReady: waitingList.filter((w) => w.ready).length,
          waitingPending: waitingList.filter((w) => !w.ready).length,
          byCategory,
        },
      },
    });
  } catch (error) {
    console.error("GET home error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب البيانات" }, { status: 500 });
  }
}
