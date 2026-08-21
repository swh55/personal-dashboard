import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const maxDuration = 30;

// Build the AI system prompt dynamically using the current user's name.
// NEVER hardcode a personal identity. If the user is authenticated, use
// their real name from the session. If no name is set, use a generic
// "المستخدم" fallback (no fabricated personal details).
function buildSystemPrompt(userName: string | null): string {
  const name = userName || "المستخدم";
  return `أنت مساعد شخصي ذكي لمستخدم اسمه ${name}.
مهمتك مساعدته في تنظيم وقته ومهامه وأعماله.

قواعد الإجابة:
- أجب بالعربية الفصحى المبسطة
- كن مختصراً ومفيداً
- استخدم الرموز التعبيرية باعتدال
- إذا سُئلت عن جدول اليوم أو المهام، استخدم البيانات المقدمة
- قدم اقتراحات عملية وقابلة للتنفيذ
- كن إيجابياً ومحفزاً`;
}

interface AISettings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

async function readAISettings(userId: string): Promise<AISettings> {
  try {
    const rows = await db.appSetting.findMany({
      where: { userId, key: { in: ["aiApiKey", "aiModel", "aiBaseUrl"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      // User's per-user key takes priority; fall back to server env var (ZAI_API_KEY)
      apiKey: map.aiApiKey || process.env.ZAI_API_KEY || "",
      model: map.aiModel || process.env.ZAI_MODEL || "glm-4-flash",
      baseUrl: map.aiBaseUrl || process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4",
    };
  } catch {
    return {
      apiKey: process.env.ZAI_API_KEY || "",
      model: process.env.ZAI_MODEL || "glm-4-flash",
      baseUrl: process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4",
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يلزم تسجيل الدخول" }, { status: 401 });
    }
    const userId = user.id;
    const body = await req.json();
    const { message, context } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: "الرسالة مطلوبة" }, { status: 400 });
    }

    const ai = await readAISettings(userId);

    // If no API key is set, prompt the user to configure one in Settings.
    if (!ai.apiKey) {
      return NextResponse.json({
        success: false,
        error: "لم يتم ضبط مفتاح API للذكاء الاصطناعي",
        response:
          "🔑 لتفعيل المساعد الذكي، يرجى الذهاب إلى الإعدادات → إعدادات الذكاء الاصطناعي وإدخال مفتاح API الخاص بك.",
      });
    }

    // Build data context (today's events, pending tasks, recent expenses, occasions)
    let dataContext = "";
    if (context?.includeData) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const [todayEvents, pendingTasks, recentExpenses, occasions] = await Promise.all([
        db.event.findMany({ where: { userId, startDate: { gte: today, lte: todayEnd } }, orderBy: { startDate: "asc" } }),
        db.task.findMany({ where: { userId, status: { not: "done" } }, orderBy: { priority: "desc" }, take: 10 }),
        db.expense.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
        db.occasion.findMany({ where: { userId }, orderBy: { date: "asc" } }),
      ]);

      dataContext = `\n\n--- بياناتك الحالية ---
أحداث اليوم: ${todayEvents.length > 0 ? todayEvents.map((e: { title: string; startDate: Date }) => `${e.title} (${new Date(e.startDate).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })})`).join("، ") : "لا أحداث"}
المهام المعلقة (${pendingTasks.length}): ${pendingTasks.map((t: { title: string; category: string; priority: string }) => `${t.title} [${t.category}/${t.priority}]`).join("، ")}
آخر المصروفات: ${recentExpenses.map((e: { amount: number; currency: string; description: string | null; category: string }) => `${e.amount} ${e.currency} - ${e.description || e.category}`).join("، ")}
المناسبات القادمة: ${occasions.map((o: { title: string; date: Date }) => `${o.title} (${new Date(o.date).toLocaleDateString("ar-SY")})`).join("، ")}`;
    }

    // Make a direct fetch to the configured Z.ai-compatible endpoint.
    const res = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: buildSystemPrompt(user.name) + dataContext },
          { role: "user", content: message },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("AI chat API error:", res.status, errText);
      throw new Error(`AI API error: ${res.status}`);
    }

    const data = await res.json();
    const response = data?.choices?.[0]?.message?.content;

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
