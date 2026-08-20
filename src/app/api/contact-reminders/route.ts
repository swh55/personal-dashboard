import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

const VALID_FREQUENCIES = ["daily", "weekly", "monthly"];

// Compute the next reminder date based on the frequency
function computeNextReminder(
  lastContacted: Date | null,
  frequency: string
): Date | null {
  const base = lastContacted || new Date();
  const next = new Date(base);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

// GET: returns active reminders (optionally filtered to those due now)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], meta: { count: 0, overdue: 0 } });
    }
    const userId = user.id;
    const searchParams = req.nextUrl.searchParams;
    const activeOnly = searchParams.get("active") !== "false";
    const dueOnly = searchParams.get("due") === "true";

    const where: Record<string, unknown> = { userId };
    if (activeOnly) {
      where.active = true;
    }
    if (dueOnly) {
      where.nextReminder = { lte: new Date() };
    }

    const reminders = await db.contactReminder.findMany({
      where,
      orderBy: { nextReminder: "asc" },
    });

    const now = new Date();
    const data = reminders.map((r) => {
      const nextReminder = r.nextReminder ? new Date(r.nextReminder) : null;
      const overdue =
        nextReminder !== null && nextReminder.getTime() < now.getTime();
      const daysUntilDue = nextReminder
        ? Math.ceil((nextReminder.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return { ...r, overdue, daysUntilDue };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        count: data.length,
        overdue: data.filter((r) => r.overdue).length,
      },
    });
  } catch (error) {
    console.error("GET contact-reminders error:", error);
    return NextResponse.json(
      { success: false, error: "فشل جلب تذكيرات التواصل" },
      { status: 500 }
    );
  }
}

// POST: create a new contact reminder
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const userId = user.id;
    const body = await req.json();
    const { contactId, contactName, frequency, lastContacted, nextReminder, active } = body;

    if (!contactName) {
      return NextResponse.json(
        { success: false, error: "اسم جهة الاتصال مطلوب" },
        { status: 400 }
      );
    }

    const freq = VALID_FREQUENCIES.includes(frequency)
      ? frequency
      : "weekly";

    const lastContactedDate = lastContacted ? new Date(lastContacted) : null;
    const nextReminderDate = nextReminder
      ? new Date(nextReminder)
      : computeNextReminder(lastContactedDate, freq);

    const reminder = await db.contactReminder.create({
      data: {
        contactId: contactId || null,
        contactName,
        frequency: freq,
        lastContacted: lastContactedDate,
        nextReminder: nextReminderDate,
        active: active !== undefined ? Boolean(active) : true,
        userId,
      },
    });

    await logActivity(
      "create",
      "contact_reminder",
      `تمت إضافة تذكير تواصل لـ: ${contactName}`,
      userId
    );
    return NextResponse.json({ success: true, data: reminder }, { status: 201 });
  } catch (error) {
    console.error("POST contact-reminder error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إنشاء تذكير التواصل" },
      { status: 500 }
    );
  }
}

// PUT: update lastContacted (and recompute nextReminder) or other fields
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const userId = user.id;
    const body = await req.json();
    const { id, lastContacted, frequency, nextReminder, active, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرف مطلوب" },
        { status: 400 }
      );
    }

    // Ownership check
    const existingRec = await db.contactReminder.findUnique({ where: { id } });
    if (!existingRec || existingRec.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = { ...rest };
    if (active !== undefined) {
      data.active = Boolean(active);
    }
    if (frequency !== undefined) {
      data.frequency = VALID_FREQUENCIES.includes(frequency)
        ? frequency
        : "weekly";
    }

    if (lastContacted !== undefined) {
      data.lastContacted = lastContacted ? new Date(lastContacted) : null;
      // Recompute nextReminder based on the new lastContacted date and frequency
      const freq =
        typeof data.frequency === "string" ? data.frequency : undefined;
      const effectiveFreq = freq || existingRec?.frequency || "weekly";
      data.nextReminder = nextReminder
        ? new Date(nextReminder)
        : computeNextReminder(
            data.lastContacted instanceof Date
              ? (data.lastContacted as Date)
              : existingRec?.lastContacted || null,
            effectiveFreq
          );
    } else if (nextReminder !== undefined) {
      data.nextReminder = nextReminder ? new Date(nextReminder) : null;
    }

    const updated = await db.contactReminder.update({
      where: { id },
      data,
    });

    if (lastContacted !== undefined) {
      await logActivity(
        "update",
        "contact_reminder",
        `تم تحديث آخر تواصل مع: ${updated.contactName}`,
        userId
      );
    } else if (active !== undefined) {
      await logActivity(
        "toggle",
        "contact_reminder",
        `${active ? "تفعيل" : "تعطيل"} تذكير: ${updated.contactName}`,
        userId
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT contact-reminder error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحديث تذكير التواصل" },
      { status: 500 }
    );
  }
}

// DELETE: remove a contact reminder by id
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرف مطلوب" },
        { status: 400 }
      );
    }

    const existing = await db.contactReminder.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    const reminder = await db.contactReminder.delete({ where: { id } });
    await logActivity(
      "delete",
      "contact_reminder",
      `تم حذف تذكير تواصل لـ: ${reminder.contactName}`,
      userId
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE contact-reminder error:", error);
    return NextResponse.json(
      { success: false, error: "فشل حذف تذكير التواصل" },
      { status: 500 }
    );
  }
}
