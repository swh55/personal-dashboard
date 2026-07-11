import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

// GET: returns medications + sleep logs + health stats
export async function GET() {
  try {
    const [medications, sleepLogs] = await Promise.all([
      db.medication.findMany({ where: { deletedAt: null }, orderBy: { startDate: "desc" } }),
      db.sleepLog.findMany({ orderBy: { date: "desc" }, take: 14 }),
    ]);

    const avgSleep = sleepLogs.length
      ? Math.round(sleepLogs.reduce((s, l) => s + l.duration, 0) / sleepLogs.length)
      : 0;
    const avgQuality = sleepLogs.length
      ? sleepLogs.reduce((s, l) => {
          const map: Record<string, number> = { poor: 1, fair: 2, good: 3, excellent: 4 };
          return s + (map[l.quality] || 2);
        }, 0) / sleepLogs.length
      : 0;

    return NextResponse.json({
      success: true,
      data: { medications, sleepLogs },
      stats: {
        medicationsActive: medications.filter((m) => m.active).length,
        avgSleepMinutes: avgSleep,
        avgSleepHours: +(avgSleep / 60).toFixed(1),
        avgQuality: +avgQuality.toFixed(1),
        sleepLogsCount: sleepLogs.length,
      },
    });
  } catch (error) {
    console.error("GET health error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب بيانات الصحة" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, ...data } = body;

    if (type === "medication") {
      const { name, dosage, frequency, startDate, endDate, notes } = data;
      if (!name) return NextResponse.json({ success: false, error: "الاسم مطلوب" }, { status: 400 });
      const med = await db.medication.create({
        data: {
          name,
          dosage: dosage || null,
          frequency: frequency || "daily",
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : null,
          notes: notes || null,
        },
      });
      await logActivity("create", "medication", `أضيف دواء: ${name}`);
      return NextResponse.json({ success: true, data: med }, { status: 201 });
    }

    if (type === "sleep") {
      const { date, bedtime, wakeTime, quality, note } = data;
      const d = date ? new Date(date) : new Date();
      d.setHours(0, 0, 0, 0);
      const bt = bedtime ? new Date(bedtime) : null;
      const wt = wakeTime ? new Date(wakeTime) : null;
      const duration = bt && wt ? Math.round((wt.getTime() - bt.getTime()) / 60000) : 0;
      const log = await db.sleepLog.create({
        data: { date: d, bedtime: bt, wakeTime: wt, duration, quality: quality || "good", note: note || null },
      });
      return NextResponse.json({ success: true, data: log }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: "نوع غير معروف" }, { status: 400 });
  } catch (error) {
    console.error("POST health error:", error);
    return NextResponse.json({ success: false, error: "فشل الإضافة" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, id, ...data } = body;
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });

    if (type === "medication") {
      if (data.startDate) data.startDate = new Date(data.startDate);
      if (data.endDate) data.endDate = new Date(data.endDate);
      const med = await db.medication.update({ where: { id }, data });
      return NextResponse.json({ success: true, data: med });
    }
    return NextResponse.json({ success: false, error: "نوع غير معروف" }, { status: 400 });
  } catch (error) {
    console.error("PUT health error:", error);
    return NextResponse.json({ success: false, error: "فشل التحديث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });

    if (type === "medication") {
      await db.medication.update({ where: { id }, data: { deletedAt: new Date() } });
    } else if (type === "sleep") {
      await db.sleepLog.delete({ where: { id } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE health error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
