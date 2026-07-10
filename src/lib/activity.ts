import { db } from "@/lib/db";

export async function logActivity(
  action: string,
  entity: string,
  message: string
): Promise<void> {
  try {
    await db.activityLog.create({
      data: { action, entity, message },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export interface ActivityEntry {
  id: string;
  action: string;
  entity: string;
  message: string;
  createdAt: Date;
}
