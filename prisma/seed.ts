// Seed script — starts the database EMPTY (no sample data).
// Run with: bun run seed

import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  console.log("🌱 Resetting database to empty state...");

  await db.activityLog.deleteMany();
  await db.habitLog.deleteMany();
  await db.habit.deleteMany();
  await db.task.deleteMany();
  await db.project.deleteMany();
  await db.meeting.deleteMany();
  await db.event.deleteMany();
  await db.note.deleteMany();
  await db.expense.deleteMany();
  await db.budget.deleteMany();
  await db.asset.deleteMany();
  await db.account.deleteMany();
  await db.debt.deleteMany();
  await db.occasion.deleteMany();
  await db.diaryEntry.deleteMany();
  await db.medication.deleteMany();
  await db.sleepLog.deleteMany();
  await db.pantryItem.deleteMany();
  await db.waitingItem.deleteMany();
  await db.savedLocation.deleteMany();
  await db.contactReminder.deleteMany();
  await db.callLog.deleteMany();
  await db.contact.deleteMany();
  await db.happinessLog.deleteMany();
  await db.quranLog.deleteMany();
  await db.integration.deleteMany();
  await db.scheduledMessage.deleteMany();
  await db.automationRule.deleteMany();
  await db.suggestion.deleteMany();
  await db.appSetting.deleteMany();

  // Only create default settings
  await db.appSetting.create({ data: { key: "username", value: "المستخدم" } });
  await db.appSetting.create({ data: { key: "theme", value: "dark" } });
  await db.appSetting.create({ data: { key: "city", value: "حلب" } });
  await db.appSetting.create({ data: { key: "lat", value: "36.2021" } });
  await db.appSetting.create({ data: { key: "lng", value: "37.1343" } });
  await db.appSetting.create({ data: { key: "exchangeRate", value: "12500" } });
  await db.appSetting.create({ data: { key: "aiApiKey", value: "" } });

  console.log("✅ Database is now empty (no sample data).");
}

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
