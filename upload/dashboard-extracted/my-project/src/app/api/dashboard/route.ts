import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUpcomingHolidays, isHoliday } from "@/lib/holidays";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // أحداث اليوم
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayEvents = await db.event.findMany({
      where: {
        startDate: { gte: today, lte: todayEnd },
      },
      orderBy: { startDate: "asc" },
    });

    // المهام المعلقة
    const pendingTasks = await db.task.count({ where: { status: { not: "done" } } });
    const doneTasks = await db.task.count({ where: { status: "done" } });
    const tasksByCategory = await db.task.groupBy({
      by: ["category"],
      _count: true,
      where: { status: { not: "done" } },
    });

    // جهات الاتصال
    const totalContacts = await db.contact.count();
    const favoriteContacts = await db.contact.count({ where: { favorite: true } });

    // الأصول
    const assets = await db.asset.findMany();
    const totalAssetsValue = assets.reduce((acc, a) => acc + a.amount, 0);

    // المناسبات القادمة
    const occasions = await db.occasion.findMany({ orderBy: { date: "asc" } });

    // العطل القادمة
    const upcomingHolidays = getUpcomingHolidays(5);

    // هل اليوم عطلة؟
    const todayHoliday = isHoliday(today);

    // آخر المكالمات
    const recentCalls = await db.callLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        todayEvents,
        taskStats: {
          pending: pendingTasks,
          done: doneTasks,
          total: pendingTasks + doneTasks,
          byCategory: tasksByCategory,
        },
        contactStats: {
          total: totalContacts,
          favorites: favoriteContacts,
        },
        assets,
        totalAssetsValue,
        occasions,
        upcomingHolidays,
        todayHoliday,
        recentCalls,
      },
    });
  } catch (error) {
    console.error("GET dashboard error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب بيانات لوحة التحكم" }, { status: 500 });
  }
}
