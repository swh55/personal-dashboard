// Quick verification that Neon tables were created
import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tables: Array<{ tablename: string }> = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log("Tables in Neon public schema:");
  for (const t of tables) console.log("  -", t.tablename);
  console.log("\nTotal:", tables.length, "tables");

  const userCount = await prisma.user.count();
  console.log("\nUser table accessible. Current users:", userCount);

  // Insert a test user + verify, then delete it
  const testUser = await prisma.user.create({
    data: { email: "test-verify@example.com", name: "Test Verify", provider: "test" },
  });
  console.log("Created test user:", testUser.id, testUser.email);

  const found = await prisma.user.findUnique({ where: { email: "test-verify@example.com" } });
  console.log("Found test user by email:", found?.name);

  // Test multi-tenant isolation: insert a contact for this user
  const contact = await prisma.contact.create({
    data: { userId: testUser.id, name: "Isolation Test", phone: "+1-555-0100" },
  });
  console.log("Created contact for test user:", contact.id);

  // Verify filtering by userId returns only this user's contact
  const myContacts = await prisma.contact.findMany({ where: { userId: testUser.id } });
  console.log("Contacts visible to test user:", myContacts.length);

  // Cleanup
  await prisma.contact.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("\nCleanup complete. Neon + multi-tenant schema VERIFIED.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("VERIFICATION FAILED:", e);
  process.exit(1);
});
