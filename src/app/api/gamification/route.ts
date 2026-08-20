import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET: gamification stats — points, levels, achievements, streaks
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: { points: 0, level: 1, pointsInLevel: 0, pointsToNext: 100, achievements: [], habitStreaks: [], stats: { doneTasks: 0, totalTasks: 0, habitLogs: 0, contacts: 0, events: 0, notes: 0 } } });
    }
    const userId = user.id;
    const [tasks, habits, contacts, events, notes] = await Promise.all([
      db.task.findMany({ where: { userId, deletedAt: null } }),
      db.habit.findMany({ where: { userId }, include: { logs: true } }),
      db.contact.count({ where: { userId, deletedAt: null } }),
      db.event.count({ where: { userId, deletedAt: null } }),
      db.note.count({ where: { userId, deletedAt: null } }),
    ]);

    const doneTasks = tasks.filter((t) => t.status === "done").length;

    // Points system
    const points =
      doneTasks * 10 +
      habits.reduce((s, h) => s + h.logs.length * 5, 0) +
      contacts * 2 +
      events * 3 +
      notes * 4;

    const level = Math.floor(points / 100) + 1;
    const pointsInLevel = points % 100;
    const pointsToNext = 100 - pointsInLevel;

    // Achievements
    const achievements = [
      { id: "first-task", name: "الخطوة الأولى", description: "أكمل أول مهمة", icon: "🎯", unlocked: doneTasks >= 1, progress: Math.min(doneTasks, 1) },
      { id: "task-master-10", name: "منجز المهام", description: "أكمل 10 مهام", icon: "🏆", unlocked: doneTasks >= 10, progress: Math.min(doneTasks, 10) },
      { id: "task-master-50", name: "أسطورة الإنجاز", description: "أكمل 50 مهمة", icon: "👑", unlocked: doneTasks >= 50, progress: Math.min(doneTasks, 50) },
      { id: "habit-7", name: "أسبوع مثالي", description: "حافظ على عادة 7 أيام", icon: "🔥", unlocked: habits.some((h) => h.logs.length >= 7), progress: Math.max(0, ...habits.map((h) => h.logs.length)) },
      { id: "habit-30", name: "شهر الالتزام", description: "حافظ على عادة 30 يوم", icon: "💎", unlocked: habits.some((h) => h.logs.length >= 30), progress: Math.max(0, ...habits.map((h) => h.logs.length)) },
      { id: "connector", name: "اجتماعي", description: "أضف 10 جهات اتصال", icon: "🤝", unlocked: contacts >= 10, progress: Math.min(contacts, 10) },
      { id: "organizer", name: "منظم", description: "أنشئ 5 أحداث", icon: "📅", unlocked: events >= 5, progress: Math.min(events, 5) },
      { id: "writer", name: "كاتب", description: "اكتب 10 ملاحظات", icon: "✍️", unlocked: notes >= 10, progress: Math.min(notes, 10) },
    ];

    // Habit streaks
    const habitStreaks = habits.map((h) => {
      const sorted = h.logs.map((l) => new Date(l.date).getTime()).sort((a, b) => b - a);
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let cursor = today.getTime();
      if (sorted[0] !== cursor) {
        const yesterday = cursor - 86400000;
        if (sorted[0] !== yesterday) return { habitId: h.id, name: h.name, streak: 0 };
        cursor = yesterday;
      }
      for (const ts of sorted) {
        if (ts === cursor) {
          streak++;
          cursor -= 86400000;
        } else if (ts < cursor) break;
      }
      return { habitId: h.id, name: h.name, streak };
    });

    return NextResponse.json({
      success: true,
      data: {
        points,
        level,
        pointsInLevel,
        pointsToNext,
        achievements,
        habitStreaks: habitStreaks.sort((a, b) => b.streak - a.streak).slice(0, 5),
        stats: {
          doneTasks,
          totalTasks: tasks.length,
          habitLogs: habits.reduce((s, h) => s + h.logs.length, 0),
          contacts,
          events,
          notes,
        },
      },
    });
  } catch (error) {
    console.error("GET gamification error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب بيانات التحفيز" }, { status: 500 });
  }
}
