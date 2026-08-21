import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * POST /api/accounts/income
 * Body: { accountId, amount, currency?, note?, source? }
 *
 * Records an income (deposit) into a specific account:
 *  - Increments the account balance.
 *  - Creates an Expense record with a NEGATIVE amount (negative expenses are
 *    treated as income throughout the dashboard — see /api/expenses stats
 *    which sum positive amounts only, and /api/finances monthSpend which
 *    filters to positive amounts too) so monthly income is queryable from
 *    the same expenses table without a separate Income model.
 *  - accountId is linked so the income is attributable to the account.
 *
 * This is the simplest approach that reuses existing schema and avoids
 * introducing a new Income model (see task notes).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const userId = user.id;
    const body = await req.json();
    const { accountId, amount, currency, note, source } = body ?? {};

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "يلزم تحديد الحساب" },
        { status: 400 }
      );
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json(
        { success: false, error: "المبلغ يجب أن يكون رقماً موجباً" },
        { status: 400 }
      );
    }

    const existing = await db.account.findUnique({ where: { id: accountId } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "الحساب غير موجود أو غير مصرح" },
        { status: 403 }
      );
    }

    const effectiveCurrency = currency || existing.currency;
    const description = note
      ? `وارد: ${note}`
      : source
        ? `وارد من ${source}`
        : "وارد إلى الحساب";

    const [updatedAccount] = await db.$transaction([
      db.account.update({
        where: { id: accountId },
        data: { balance: { increment: amt } },
      }),
      db.expense.create({
        data: {
          userId,
          amount: -amt, // negative = income
          currency: effectiveCurrency,
          category: "income",
          description,
          date: new Date(),
          accountId,
        },
      }),
    ]);

    await logActivity(
      "income",
      "account",
      `وارد ${amt} ${effectiveCurrency} إلى ${existing.name}`,
      userId
    );

    return NextResponse.json({
      success: true,
      data: {
        account: { id: updatedAccount.id, balance: updatedAccount.balance },
        amount: amt,
        currency: effectiveCurrency,
      },
    });
  } catch (error) {
    console.error("POST income error:", error);
    return NextResponse.json(
      { success: false, error: "فشل تسجيل الوارد" },
      { status: 500 }
    );
  }
}
