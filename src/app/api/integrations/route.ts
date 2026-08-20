import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

const VALID_SERVICES = [
  "google_calendar",
  "google_drive",
  "telegram",
  "email",
  "github",
  "google_contacts",
  "cloud_sync",
];

// GET: returns all integrations
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], meta: { count: 0, connected: 0, availableServices: VALID_SERVICES } });
    }
    const userId = user.id;
    const integrations = await db.integration.findMany({
      where: { userId },
      orderBy: { service: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: integrations,
      meta: {
        count: integrations.length,
        connected: integrations.filter((i) => i.connected).length,
        availableServices: VALID_SERVICES,
      },
    });
  } catch (error) {
    console.error("GET integrations error:", error);
    return NextResponse.json(
      { success: false, error: "فشل جلب التكاملات" },
      { status: 500 }
    );
  }
}

// POST: create or update an integration (upsert by service)
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
    const { id, service, name, connected, config, lastSync } = body;

    if (!service) {
      return NextResponse.json(
        { success: false, error: "الخدمة مطلوبة" },
        { status: 400 }
      );
    }

    if (!VALID_SERVICES.includes(service)) {
      return NextResponse.json(
        {
          success: false,
          error: `خدمة غير مدعومة. الخدمات المتاحة: ${VALID_SERVICES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const configString =
      config === undefined || config === null
        ? null
        : typeof config === "string"
        ? config
        : JSON.stringify(config);

    const lastSyncDate = lastSync ? new Date(lastSync) : null;

    // If id is provided, update that specific integration (ownership-checked)
    if (id) {
      const existing = await db.integration.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return NextResponse.json(
          { success: false, error: "غير مصرح" },
          { status: 403 }
        );
      }
      const updated = await db.integration.update({
        where: { id },
        data: {
          service,
          name: name || service,
          connected: connected !== undefined ? Boolean(connected) : undefined,
          config: configString,
          lastSync: lastSyncDate,
        },
      });
      await logActivity(
        "update",
        "integration",
        `تم تحديث تكامل: ${updated.name} (${service})`,
        userId
      );
      return NextResponse.json({ success: true, data: updated });
    }

    // Otherwise upsert by (userId, service) — multi-tenant unique
    const integration = await db.integration.upsert({
      where: { userId_service: { userId, service } },
      update: {
        name: name || service,
        connected: connected !== undefined ? Boolean(connected) : undefined,
        config: configString !== null ? configString : undefined,
        lastSync: lastSyncDate || undefined,
      },
      create: {
        userId,
        service,
        name: name || service,
        connected: connected !== undefined ? Boolean(connected) : false,
        config: configString,
        lastSync: lastSyncDate,
      },
    });
    await logActivity(
      "upsert",
      "integration",
      `تم حفظ تكامل: ${integration.name} (${service})`,
      userId
    );

    return NextResponse.json(
      { success: true, data: integration },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST integration error:", error);
    return NextResponse.json(
      { success: false, error: "فشل حفظ التكامل" },
      { status: 500 }
    );
  }
}

// PUT: toggle the connected state (and optionally update lastSync)
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
    const { id, connected, lastSync } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "المعرف مطلوب" },
        { status: 400 }
      );
    }

    // Ownership check
    const existing = await db.integration.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    if (connected !== undefined) {
      data.connected = Boolean(connected);
    }
    if (lastSync !== undefined) {
      data.lastSync = lastSync ? new Date(lastSync) : null;
    } else if (connected === true) {
      // When connecting, refresh lastSync automatically
      data.lastSync = new Date();
    }

    const updated = await db.integration.update({
      where: { id },
      data,
    });

    await logActivity(
      "toggle",
      "integration",
      `${updated.connected ? "ربط" : "فصل"} تكامل: ${updated.name} (${updated.service})`,
      userId
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT integration error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تحديث التكامل" },
      { status: 500 }
    );
  }
}

// DELETE: remove an integration by id
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

    const existing = await db.integration.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "غير مصرح" },
        { status: 403 }
      );
    }

    const integration = await db.integration.delete({ where: { id } });
    await logActivity(
      "delete",
      "integration",
      `تم حذف تكامل: ${integration.name} (${integration.service})`,
      userId
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE integration error:", error);
    return NextResponse.json(
      { success: false, error: "فشل حذف التكامل" },
      { status: 500 }
    );
  }
}
