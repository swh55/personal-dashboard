import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: [], stats: { totalSYP: 0, totalUSD: 0, count: 0 } });
    }
    const userId = user.id;
    const accounts = await db.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    const totalSYP = accounts.filter((a) => a.currency === "syp").reduce((s, a) => s + a.balance, 0);
    const totalUSD = accounts.filter((a) => a.currency === "usd").reduce((s, a) => s + a.balance, 0);
    return NextResponse.json({ success: true, data: accounts, stats: { totalSYP, totalUSD, count: accounts.length } });
  } catch (error) {
    console.error("GET accounts error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب الحسابات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { name, balance, currency, type, institution } = await req.json();
    if (!name) return NextResponse.json({ success: false, error: "الاسم مطلوب" }, { status: 400 });
    const account = await db.account.create({
      data: { name, balance: Number(balance) || 0, currency: currency || "syp", type: type || "bank", institution: institution || null, userId },
    });
    await logActivity("create", "account", `أضيف حساب: ${name}`, userId);
    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    console.error("POST account error:", error);
    return NextResponse.json({ success: false, error: "فشل إضافة الحساب" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    if (data.balance !== undefined) data.balance = Number(data.balance);
    const existing = await db.account.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    const account = await db.account.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error("PUT account error:", error);
    return NextResponse.json({ success: false, error: "فشل تحديث الحساب" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    const existing = await db.account.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
    }
    await db.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE account error:", error);
    return NextResponse.json({ success: false, error: "فشل حذف الحساب" }, { status: 500 });
  }
}
