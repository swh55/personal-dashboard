import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { USD_TO_SYP } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET: full financial overview
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: { assets: [], accounts: [], debts: [], budgets: [], totalAssets: 0, totalAccounts: 0, totalOwed: 0, totalOwe: 0, netWorth: 0, monthSpend: 0, monthExpenseCount: 0 } });
    }
    const userId = user.id;
    const [assets, accounts, debts, expenses, budgets] = await Promise.all([
      db.asset.findMany({ where: { userId } }),
      db.account.findMany({ where: { userId } }),
      db.debt.findMany({ where: { userId, settled: false, deletedAt: null } }),
      db.expense.findMany({ where: { userId, deletedAt: null } }),
      db.budget.findMany({ where: { userId } }),
    ]);

    const toSYP = (amount: number, currency: string) =>
      currency === "usd" ? amount * USD_TO_SYP : amount;

    const totalAssets = assets.reduce((s, a) => s + toSYP(a.amount, a.currency), 0);
    const totalAccounts = accounts.reduce((s, a) => s + toSYP(a.balance, a.currency), 0);
    const totalOwed = debts.filter((d) => d.type === "owed").reduce((s, d) => s + toSYP(d.amount, d.currency), 0);
    const totalOwe = debts.filter((d) => d.type === "owe").reduce((s, d) => s + toSYP(d.amount, d.currency), 0);
    const netWorth = totalAssets + totalAccounts + totalOwed - totalOwe;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthExpenses = expenses.filter((e) => new Date(e.date) >= monthStart);
    const monthSpend = monthExpenses.reduce((s, e) => s + toSYP(e.amount, e.currency), 0);

    return NextResponse.json({
      success: true,
      data: {
        assets,
        accounts,
        debts,
        budgets,
        totalAssets,
        totalAccounts,
        totalOwed,
        totalOwe,
        netWorth,
        monthSpend,
        monthExpenseCount: monthExpenses.length,
      },
    });
  } catch (error) {
    console.error("GET finances error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب البيانات المالية" }, { status: 500 });
  }
}
