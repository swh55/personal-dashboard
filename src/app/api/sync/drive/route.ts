import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

// نسخ احتياطي إلى Google Drive
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    // External Google Drive backup is not yet implemented for multi-tenant mode.
    // TODO: wire this to per-user OAuth tokens stored in the Integration table.
    return NextResponse.json({ success: false, error: "النسخ الاحتياطي إلى Google Drive غير متاح حالياً" }, { status: 501 });
  } catch (error) {
    console.error("Drive backup error:", error);
    return NextResponse.json({ success: false, error: "فشل النسخ الاحتياطي" }, { status: 500 });
  }
}

// جلب قائمة النسخ الاحتياطية
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Google Drive غير متاح حالياً" }, { status: 501 });
  } catch (error) {
    console.error("Drive list error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب القائمة" }, { status: 500 });
  }
}
