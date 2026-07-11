import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    const body = await req.json();

    const updates: Array<[string, string]> = [];
    for (const key of ALLOWED_KEYS) {
      if (body[key] === undefined) continue;
      // Store as string. Numbers/booleans get coerced.
      const v = body[key];
      updates.push([key, typeof v === "string" ? v : String(v)]);
    }

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
