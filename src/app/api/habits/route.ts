import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET() {
  try {
    const habits = await db.habit.findMany({
      include: { logs: { orderBy: { date: "desc" }, take: 30 } },
      orderBy: { createdAt: "asc" },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const data = habits.map((h) => {
      const todayLog = h.logs.find((l) => {
        const ld = new Date(l.date);
        ld.setHours(0, 0, 0, 0);
        return ld.getTime() === today.getTime();
      });
      const streak = computeStreak(h.logs);
      const last7 = h.logs.filter((l) => {
        const ld = new Date(l.date);
        const diff = (today.getTime() - ld.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff < 7;
      }).length;
      return { ...h, todayDone: !!todayLog, todayValue: todayLog?.value || 0, streak, last7Days: last7 };
    });

    const stats = {
      total: habits.length,
      active: habits.filter((h) => h.active).length,
      doneToday: data.filter((h) => h.todayDone).length,
      bestStreak: Math.max(0, ...data.map((h) => h.streak)),
    };

    return NextResponse.json({ success: true, data, stats });
  } catch (error) {
    console.error("GET habits error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب العادات" }, { status: 500 });
  }
}

function computeStreak(logs: Array<{ date: Date }>): number {
  if (!logs.length) return 0;
  const sorted = logs
    .map((l) => {
      const d = new Date(l.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
    .sort((a, b) => b - a);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let cursor = today.getTime();
  // Allow today to be missing (not yet done) — start from today or yesterday
  if (sorted[0] !== today.getTime()) {
    const yesterday = today.getTime() - 86400000;
    if (sorted[0] !== yesterday) return 0;
    cursor = yesterday;
  }
  for (const ts of sorted) {
    if (ts === cursor) {
      streak++;
      cursor -= 86400000;
    } else if (ts < cursor) {
      break;
    }
  }
  return streak;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, frequency, target, color, icon } = body;
    if (!name) return NextResponse.json({ success: false, error: "الاسم مطلوب" }, { status: 400 });
    const habit = await db.habit.create({
      data: {
        name,
        description: description || null,
        frequency: frequency || "daily",
        target: Number(target) || 1,
        color: color || "emerald",
        icon: icon || "CheckCircle",
      },
    });
    await logActivity("create", "habit", `أضيف عادة: ${name}`);
    return NextResponse.json({ success: true, data: habit }, { status: 201 });
  } catch (error) {
    console.error("POST habit error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة العادة" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, log, ...data } = body;
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });

    // Toggle today's log
    if (log !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await db.habitLog.findUnique({ where: { habitId_date: { habitId: id, date: today } } });
      if (existing) {
        await db.habitLog.delete({ where: { id: existing.id } });
        return NextResponse.json({ success: true, data: { logged: false } });
      } else {
        await db.habitLog.create({ data: { habitId: id, date: today, value: 1 } });
        return NextResponse.json({ success: true, data: { logged: true } });
      }
    }

    const habit = await db.habit.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: habit });
  } catch (error) {
    console.error("PUT habit error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث العادة" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    await db.habit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE habit error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف العادة" }, { status: 500 });
  }
}
