import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getValidAccessToken, listGoogleCalendarEvents, createGoogleCalendarEvent } from "@/lib/google-api";
import { logActivity } from "@/lib/activity";

// مزامنة الأحداث بين Google Calendar وقاعدة البيانات
export async function POST() {
  try {
    const accessToken = await getValidAccessToken("google_calendar");

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: "Google Calendar غير متصل. اذهب إلى الإعدادات → تكامل Google → ربط Google",
      }, { status: 401 });
    }

    // 1. جلب الأحداث من Google Calendar
    const googleEvents = await listGoogleCalendarEvents(accessToken);

    // 2. استيراد أحداث Google إلى قاعدة البيانات (التي غير موجودة)
    let imported = 0;
    for (const gEvent of googleEvents) {
      // تحقق من عدم وجود الحدث مسبقاً (بعنوان مطابق)
      const title = gEvent.summary || "بدون عنوان";
      const startDate = gEvent.start?.dateTime || gEvent.start?.date;

      if (!startDate) continue;

      const existing = await db.event.findFirst({
        where: {
          title: `[Google] ${title}`,
          startDate: new Date(startDate),
        },
      });

      if (!existing) {
        await db.event.create({
          data: {
            title: `[Google] ${title}`,
            description: gEvent.description || null,
            startDate: new Date(startDate),
            endDate: gEvent.end?.dateTime ? new Date(gEvent.end.dateTime) : null,
            allDay: !gEvent.start?.dateTime,
            type: "work",
            color: "emerald",
            location: gEvent.location || null,
          },
        });
        imported++;
      }
    }

    // 3. تصدير أحداثنا إلى Google Calendar (التي ليست من Google)
    const localEvents = await db.event.findMany({
      where: {
        deletedAt: null,
        title: { not: { startsWith: "[Google]" } },
      },
      take: 50,
      orderBy: { startDate: "desc" },
    });

    let exported = 0;
    for (const event of localEvents) {
      // محاولة الإنشاء (نتجاوز الأخطاء الفردية)
      const result = await createGoogleCalendarEvent(accessToken, {
        title: event.title,
        description: event.description || undefined,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString() || event.startDate.toISOString(),
        location: event.location || undefined,
      });
      if (result) exported++;
    }

    // تحديث وقت آخر مزامنة
    await db.integration.update({
      where: { service: "google_calendar" },
      data: { lastSync: new Date() },
    });

    await logActivity("create", "sync", `مزامنة Google Calendar: استيراد ${imported}، تصدير ${exported}`);

    return NextResponse.json({
      success: true,
      data: {
        imported,
        exported,
        googleEventsFound: googleEvents.length,
        localEventsSynced: localEvents.length,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Calendar sync error:", error);
    return NextResponse.json({ success: false, error: "فشلت مزامنة التقويم" }, { status: 500 });
  }
}
