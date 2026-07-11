import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getValidAccessToken, uploadToGoogleDrive, listGoogleDriveFiles } from "@/lib/google-api";
import { logActivity } from "@/lib/activity";

// نسخ احتياطي إلى Google Drive
export async function POST() {
  try {
    const accessToken = await getValidAccessToken("google_drive");

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: "Google Drive غير متصل. اذهب إلى الإعدادات → تكامل Google → ربط Google",
      }, { status: 401 });
    }

    // 1. جمع كل البيانات
    const [tasks, contacts, events, notes, expenses, occasions, habits, assets, accounts, debts, projects, meetings, diary, medications, sleepLogs] = await Promise.all([
      db.task.findMany({ where: { deletedAt: null } }),
      db.contact.findMany({ where: { deletedAt: null } }),
      db.event.findMany(),
      db.note.findMany({ where: { deletedAt: null } }),
      db.expense.findMany({ where: { deletedAt: null } }),
      db.occasion.findMany(),
      db.habit.findMany({ include: { logs: true } }),
      db.asset.findMany(),
      db.account.findMany(),
      db.debt.findMany({ where: { deletedAt: null } }),
      db.project.findMany({ where: { deletedAt: null }, include: { tasks: true } }),
      db.meeting.findMany({ where: { deletedAt: null } }),
      db.diaryEntry.findMany({ where: { deletedAt: null } }),
      db.medication.findMany({ where: { deletedAt: null } }),
      db.sleepLog.findMany(),
    ]);

    const backupData = {
      backupDate: new Date().toISOString(),
      version: "1.0",
      stats: {
        tasks: tasks.length,
        contacts: contacts.length,
        events: events.length,
        notes: notes.length,
        expenses: expenses.length,
      },
      data: {
        tasks, contacts, events, notes, expenses, occasions,
        habits, assets, accounts, debts, projects, meetings,
        diary, medications, sleepLogs,
      },
    };

    // 2. رفع إلى Google Drive
    const filename = `dashboard-backup-${new Date().toISOString().split("T")[0]}.json`;
    const fileId = await uploadToGoogleDrive(
      accessToken,
      filename,
      JSON.stringify(backupData, null, 2),
      "application/json"
    );

    if (!fileId) {
      return NextResponse.json({ success: false, error: "فشل رفع النسخة الاحتياطية" }, { status: 500 });
    }

    // 3. جلب قائمة النسخ الاحتياطية السابقة
    const driveFiles = await listGoogleDriveFiles(accessToken, 10);
    const backups = driveFiles.filter(f => f.name?.startsWith("dashboard-backup-"));

    // تحديث وقت آخر مزامنة
    await db.integration.update({
      where: { service: "google_drive" },
      data: { lastSync: new Date() },
    });

    await logActivity("export", "sync", `نسخة احتياطية إلى Google Drive: ${filename}`);

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        filename,
        size: JSON.stringify(backupData).length,
        stats: backupData.stats,
        previousBackups: backups.length,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Drive backup error:", error);
    return NextResponse.json({ success: false, error: "فشل النسخ الاحتياطي" }, { status: 500 });
  }
}

// جلب قائمة النسخ الاحتياطية
export async function GET() {
  try {
    const accessToken = await getValidAccessToken("google_drive");

    if (!accessToken) {
      return NextResponse.json({ success: false, error: "Google Drive غير متصل" }, { status: 401 });
    }

    const files = await listGoogleDriveFiles(accessToken, 20);
    const backups = files
      .filter(f => f.name?.startsWith("dashboard-backup-"))
      .map(f => ({
        id: f.id,
        name: f.name,
        size: f.size ? `${(parseInt(f.size) / 1024).toFixed(1)} KB` : "—",
        modifiedTime: f.modifiedTime,
      }));

    return NextResponse.json({ success: true, data: backups });
  } catch (error) {
    console.error("Drive list error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب القائمة" }, { status: 500 });
  }
}
