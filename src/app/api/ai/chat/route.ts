import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `أنت مساعد شخصي ذكي لرجل أعمال سوري اسمه عبد الله، يعيش في حلب ويعمل في السجل التجاري.
مهمتك مساعدته في تنظيم وقته ومهامه وأعماله. لديه جدول أعمال مزدحم.

دوامه في السجل التجاري: يومياً من 8 صباحاً حتى 3 عصراً (عدا الجمعة والسبت).
الكشف الحسي على المتاجر: يوم الأربعاء فقط.
عائلته: زوجته "الحكومة" وابنته "سوسو".

قواعد الإجابة:
- أجب بالعربية الفصحى المبسطة
- كن مختصراً ومفيداً
- استخدم الرموز التعبيرية باعتدال
- إذا سُئلت عن جدول اليوم أو المهام، استخدم البيانات المقدمة
- قدم اقتراحات عملية وقابلة للتنفيذ
- كن إيجابياً ومحفزاً`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: "الرسالة مطلوبة" }, { status: 400 });
    }

    // بناء سياق البيانات الحالية
    let dataContext = "";
    if (context?.includeData) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const [todayEvents, pendingTasks, recentExpenses, occasions] = await Promise.all([
        db.event.findMany({ where: { startDate: { gte: today, lte: todayEnd } }, orderBy: { startDate: "asc" } }),
        db.task.findMany({ where: { status: { not: "done" } }, orderBy: { priority: "desc" }, take: 10 }),
        db.expense.findMany({ orderBy: { date: "desc" }, take: 5 }),
        db.occasion.findMany({ orderBy: { date: "asc" } }),
      ]);

      dataContext = `\n\n--- بياناتك الحالية ---
أحداث اليوم: ${todayEvents.length > 0 ? todayEvents.map((e: { title: string; startDate: Date }) => `${e.title} (${new Date(e.startDate).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })})`).join("، ") : "لا أحداث"}
المهام المعلقة (${pendingTasks.length}): ${pendingTasks.map((t: { title: string; category: string; priority: string }) => `${t.title} [${t.category}/${t.priority}]`).join("، ")}
آخر المصروفات: ${recentExpenses.map((e: { amount: number; currency: string; description: string | null; category: string }) => `${e.amount} ${e.currency} - ${e.description || e.category}`).join("، ")}
المناسبات القادمة: ${occasions.map((o: { title: string; date: Date }) => `${o.title} (${new Date(o.date).toLocaleDateString("ar-SY")})`).join("، ")}`;
    }

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT + dataContext },
        { role: "user", content: message },
      ],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error("Empty response from AI");
    }

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json({
      success: false,
      error: "تعذر الحصول على رد من المساعد الذكي",
      response: "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.",
    }, { status: 500 });
  }
}
