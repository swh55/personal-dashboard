import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function GET() {
  try {
    const rules = await db.automationRule.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error("GET automation error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب القواعد" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, trigger, action, config, active } = await req.json();
    if (!name || !trigger || !action) {
      return NextResponse.json({ success: false, error: "الاسم، المحفّز، والإجراء مطلوبة" }, { status: 400 });
    }
    const rule = await db.automationRule.create({
      data: {
        name,
        trigger,
        action,
        config: config ? (typeof config === "string" ? config : JSON.stringify(config)) : null,
        active: active !== undefined ? Boolean(active) : true,
      },
    });
    await logActivity("create", "automation", `أضيف قاعدة أتمتة: ${name}`);
    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error("POST automation error:", error);
    return NextResponse.json({ success: false, error: "فشل الإضافة" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.config && typeof data.config !== "string") data.config = JSON.stringify(data.config);
    if (data.active !== undefined) data.active = Boolean(data.active);
    const rule = await db.automationRule.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error("PUT automation error:", error);
    return NextResponse.json({ success: false, error: "فشل التحديث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    await db.automationRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE automation error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
