// GET /api/sync/pull
//
// One-shot download of ALL the authenticated user's data from the cloud.
// Used for:
//   - Multi-device sync: open the app on a new device → pull all your data
//   - Recovery: restore from cloud after a local reset
//   - Periodic backup export
//
// The response is a single JSON object keyed by collection name. The client
// can call this after login to hydrate its local cache.
//
// Security: userId derived from session — never from query string.
// Returns 401 for guests (they have no cloud data).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "يلزم تسجيل الدخول للمزامنة" },
      { status: 401 }
    );
  }
  const userId = user.id;

  try {
    const [
      contacts,
      callLogs,
      notes,
      events,
      tasks,
      expenses,
      budgets,
      assets,
      accounts,
      debts,
      projects,
      meetings,
      occasions,
      diaryEntries,
      habits,
      medications,
      sleepLogs,
      pantryItems,
      waitingItems,
      savedLocations,
      contactReminders,
      happinessLogs,
      quranLogs,
      integrations,
      activityLogs,
      scheduledMessages,
      automationRules,
      suggestions,
      appSettings,
    ] = await Promise.all([
      db.contact.findMany({ where: { userId } }),
      db.callLog.findMany({ where: { userId } }),
      db.note.findMany({ where: { userId } }),
      db.event.findMany({ where: { userId } }),
      db.task.findMany({ where: { userId } }),
      db.expense.findMany({ where: { userId } }),
      db.budget.findMany({ where: { userId } }),
      db.asset.findMany({ where: { userId } }),
      db.account.findMany({ where: { userId } }),
      db.debt.findMany({ where: { userId } }),
      db.project.findMany({ where: { userId } }),
      db.meeting.findMany({ where: { userId } }),
      db.occasion.findMany({ where: { userId } }),
      db.diaryEntry.findMany({ where: { userId } }),
      db.habit.findMany({ where: { userId } }),
      db.medication.findMany({ where: { userId } }),
      db.sleepLog.findMany({ where: { userId } }),
      db.pantryItem.findMany({ where: { userId } }),
      db.waitingItem.findMany({ where: { userId } }),
      db.savedLocation.findMany({ where: { userId } }),
      db.contactReminder.findMany({ where: { userId } }),
      db.happinessLog.findMany({ where: { userId } }),
      db.quranLog.findMany({ where: { userId } }),
      db.integration.findMany({ where: { userId } }),
      db.activityLog.findMany({ where: { userId }, take: 200, orderBy: { createdAt: "desc" } }),
      db.scheduledMessage.findMany({ where: { userId } }),
      db.automationRule.findMany({ where: { userId } }),
      db.suggestion.findMany({ where: { userId } }),
      db.appSetting.findMany({ where: { userId } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        contacts,
        callLogs,
        notes,
        events,
        tasks,
        expenses,
        budgets,
        assets,
        accounts,
        debts,
        projects,
        meetings,
        occasions,
        diaryEntries,
        habits,
        medications,
        sleepLogs,
        pantryItems,
        waitingItems,
        savedLocations,
        contactReminders,
        happinessLogs,
        quranLogs,
        integrations,
        activityLogs,
        scheduledMessages,
        automationRules,
        suggestions,
        appSettings,
      },
      pulledAt: new Date().toISOString(),
      userId,
    });
  } catch (err) {
    console.error("[sync/pull] error:", err);
    return NextResponse.json(
      { success: false, error: "فشل سحب البيانات" },
      { status: 500 }
    );
  }
}
