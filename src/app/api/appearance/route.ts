import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// All keys we know about. Unknown keys are silently ignored to prevent abuse.
const ALLOWED_KEYS = [
  "theme",
  "accent",
  "username",
  "pinEnabled",
  "pinCode",
  "city",
  "lat",
  "lng",
  "timezone",
  "exchangeRate",
  "aiApiKey",
  "aiModel",
  "aiBaseUrl",
] as const;

// GET: appearance settings (from AppSetting table + localStorage defaults)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: {} });
    }
    const userId = user.id;
    const settings = await db.appSetting.findMany({ where: { userId } });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    return NextResponse.json({
      success: true,
      data: {
        theme: map.theme || "dark",
        accent: map.accent || "emerald",
        username: map.username || "عبد الله",
        pinEnabled: map.pinEnabled === "true",
        ...(map.pinCode ? { pinCode: map.pinCode } : {}),
        city: map.city || "حلب",
        lat: map.lat !== undefined ? Number(map.lat) : 36.2021,
        lng: map.lng !== undefined ? Number(map.lng) : 37.1343,
        timezone: map.timezone || "Asia/Damascus",
        exchangeRate: map.exchangeRate !== undefined ? Number(map.exchangeRate) : 12500,
        aiApiKey: map.aiApiKey || "",
        aiModel: map.aiModel || "glm-4-flash",
        aiBaseUrl: map.aiBaseUrl || "",
      },
    });
  } catch (error) {
    console.error("GET appearance error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الإعدادات" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const body = await req.json();

    for (const key of ALLOWED_KEYS) {
      if (body[key] === undefined) continue;
      // Store as string. Numbers/booleans get coerced.
      const v = body[key];
      const value = typeof v === "string" ? v : String(v);
      // upsert by (userId, key) — multi-tenant unique constraint
      await db.appSetting.upsert({
        where: { userId_key: { userId, key } },
        update: { value },
        create: { userId, key, value },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT appearance error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الإعدادات" }, { status: 500 });
  }
}
