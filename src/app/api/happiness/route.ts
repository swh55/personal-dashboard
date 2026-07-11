import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// 11. مؤشر السعادة اليومي
// POST: تسجيل درجة سعادة يومية (1-10) — upsert حسب التاريخ
// GET: متوسط آخر 7 أيام

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6); // آخر 7 أيام
    startDate.setHours(0, 0, 0, 0);

    const logs = await db.happinessLog.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: "desc" },
    });

    const scores = logs.map((l) => l.score);
    const average = scores.length
      ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      : 0;

    // متوسط العوامل إن وُجدت
    const factorSums: Record<string, number> = {};
    const factorCounts: Record<string, number> = {};
    logs.forEach((l) => {
      if (!l.factors) return;
      try {
        const parsed = JSON.parse(l.factors);
        Object.entries(parsed).forEach(([key, val]) => {
          if (typeof val === "number") {
            factorSums[key] = (factorSums[key] || 0) + val;
            factorCounts[key] = (factorCounts[key] || 0) + 1;
          }
        });
      } catch {
        // تجاهل JSON غير صالح
      }
    });
    const factorAverages: Record<string, number> = {};
    Object.keys(factorSums).forEach((key) => {
      factorAverages[key] = +(factorSums[key] / factorCounts[key]).toFixed(2);
    });

    return NextResponse.json({
      success: true,
      data: logs,
      stats: {
        count: logs.length,
        average,
        max: scores.length ? Math.max(...scores) : 0,
        min: scores.length ? Math.min(...scores) : 0,
        factorAverages,
      },
    });
  } catch (error) {
    console.error("GET happiness error:", error);
    return NextResponse.json(
      { success: false, error: "فشل جلب سجل السعادة" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { score, factors, note, date } = body;

    if (score === undefined) {
      return NextResponse.json(
        { success: false, error: "النتيجة مطلوبة (1-10)" },
        { status: 400 }
      );
    }

    const finalScore = Math.max(1, Math.min(10, Number(score)));
    const targetDate = date ? new Date(date) : startOfToday();
    targetDate.setHours(0, 0, 0, 0);

    const factorsStr =
      factors && typeof factors === "object"
        ? JSON.stringify(factors)
        : factors || null;

    // upsert حسب التاريخ (نتيجة واحدة لكل يوم)
    const log = await db.happinessLog.upsert({
      where: { date: targetDate },
      update: {
        score: finalScore,
        factors: factorsStr,
        note: note || null,
      },
      create: {
        date: targetDate,
        score: finalScore,
        factors: factorsStr,
        note: note || null,
      },
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error("POST happiness error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تسجيل مؤشر السعادة" },
      { status: 500 }
    );
  }
}
