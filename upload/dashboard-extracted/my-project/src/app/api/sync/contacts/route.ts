import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getValidAccessToken, listGoogleContacts } from "@/lib/google-api";
import { logActivity } from "@/lib/activity";

// استيراد جهات الاتصال من Google Contacts
export async function POST() {
  try {
    const accessToken = await getValidAccessToken("google_contacts");

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: "Google Contacts غير متصل. اذهب إلى الإعدادات → تكامل Google → ربط Google",
      }, { status: 401 });
    }

    // 1. جلب جهات الاتصال من Google
    const connections = await listGoogleContacts(accessToken, 200);

    // 2. استيرادها إلى قاعدة البيانات
    let imported = 0;
    let skipped = 0;

    for (const person of connections) {
      const name = person.names?.[0]?.displayName;
      if (!name) { skipped++; continue; }

      const phone = person.phoneNumbers?.[0]?.value || "";
      const email = person.emailAddresses?.[0]?.value || "";

      // تحقق من عدم وجود جهة بنفس الاسم والهاتف
      const existing = await db.contact.findFirst({
        where: {
          name,
          phone: phone || undefined,
          deletedAt: null,
        },
      });

      if (existing) {
        // حدّث البريد إن لم يكن موجوداً
        if (email && !existing.email) {
          await db.contact.update({
            where: { id: existing.id },
            data: { email },
          });
        }
        skipped++;
        continue;
      }

      await db.contact.create({
        data: {
          name,
          phone: phone || "—",
          email: email || null,
          relation: "other",
          category: "google_import",
          note: "مستورد من Google Contacts",
          favorite: false,
        },
      });
      imported++;
    }

    // تحديث وقت آخر مزامنة
    await db.integration.update({
      where: { service: "google_contacts" },
      data: { lastSync: new Date() },
    });

    await logActivity("create", "sync", `مزامنة Google Contacts: استيراد ${imported}، تخطي ${skipped}`);

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        totalFound: connections.length,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Contacts sync error:", error);
    return NextResponse.json({ success: false, error: "فشلت مزامنة جهات الاتصال" }, { status: 500 });
  }
}
