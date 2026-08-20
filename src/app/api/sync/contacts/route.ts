import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

// استيراد جهات الاتصال من Google Contacts
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    // External Google Contacts sync is not yet implemented for multi-tenant mode.
    // TODO: wire this to per-user OAuth tokens stored in the Integration table.
    return NextResponse.json({ success: false, error: "مزامنة Google Contacts غير متاحة حالياً" }, { status: 501 });
  } catch (error) {
    console.error("Contacts sync error:", error);
    return NextResponse.json({ success: false, error: "فشلت مزامنة جهات الاتصال" }, { status: 500 });
  }
}
