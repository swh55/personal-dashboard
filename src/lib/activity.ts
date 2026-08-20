import { db } from "@/lib/db";

/**
 * Log an activity entry. Now requires a userId so each user's activity log
 * is isolated (the ActivityLog table is multi-tenant).
 */
export async function logActivity(
  action: string,
  entity: string,
  message: string,
  userId?: string | null
): Promise<void> {
  if (!userId) {
    // Guest mode — no activity log persisted to the cloud.
    // The local fetch interceptor has its own logActivity for guests.
    return;
  }
  try {
    await db.activityLog.create({
      data: { action, entity, message, userId },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export interface ActivityEntry {
  id: string;
  userId: string;
  action: string;
  entity: string;
  message: string;
  createdAt: Date;
}
