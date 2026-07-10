import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: appearance settings (from AppSetting table + localStorage defaults)
export async function GET() {
  try {
    const settings = await db.appSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    return NextResponse.json({
      success: true,
      data: {
        theme: map.theme || "dark",
        accent: map.accent || "emerald",
        username: map.username || "عبد الله",
        pinEnabled: map.pinEnabled === "true",
      },
    });
  } catch (error) {
    console.error("GET appearance error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الإعدادات" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { theme, accent, username, pinEnabled, pinCode } = body;

    const updates: Array<[string, string]> = [];
    if (theme !== undefined) updates.push(["theme", theme]);
    if (accent !== undefined) updates.push(["accent", accent]);
    if (username !== undefined) updates.push(["username", username]);
    if (pinEnabled !== undefined) updates.push(["pinEnabled", String(pinEnabled)]);
    if (pinCode !== undefined) updates.push(["pinCode", pinCode]);

    for (const [key, value] of updates) {
      const existing = await db.appSetting.findUnique({ where: { key } });
      if (existing) {
        await db.appSetting.update({ where: { id: existing.id }, data: { value } });
      } else {
        await db.appSetting.create({ data: { key, value } });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT appearance error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الإعدادات" }, { status: 500 });
  }
}
