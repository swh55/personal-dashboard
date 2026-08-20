// Multi-user seed script.
// In a multi-tenant cloud DB we do NOT seed sample data — every user starts
// with an empty account and creates their own data. The only "seed" is a
// no-op that confirms the DB is reachable.
//
// Run with: bun run seed

import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  console.log("🌱 Multi-user database — no global seed data.");
  const userCount = await db.user.count();
  const tableCount = await db.$queryRawUnsafe(
    "SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname = 'public'"
  ) as Array<{ count: number }>;
  console.log(`   Users: ${userCount}`);
  console.log(`   Tables: ${tableCount[0]?.count ?? "?"}`);
  console.log("✅ Database is reachable and ready for new users.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
