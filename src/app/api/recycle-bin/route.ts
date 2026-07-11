import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: returns soft-deleted items grouped by type
export async function GET() {
  try {
    const [contacts, notes, tasks, events, expenses, debts, projects, meetings, diary, medications] = await Promise.all([
      db.contact.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
      db.note.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
      db.task.findMany({ where: { deletedAt: { not: null } }, orderBy: { updatedAt: "desc" } }),
      db.event.findMany({ where: { deletedAt: { not: null } }, orderBy: { updatedAt: "desc" } }),
      db.expense.findMany({ where: { deletedAt: { not: null } }, orderBy: { updatedAt: "desc" } }),
      db.debt.findMany({ where: { deletedAt: { not: null } }, orderBy: { updatedAt: "desc" } }),
      db.project.findMany({ where: { deletedAt: { not: null } }, orderBy: { updatedAt: "desc" } }),
      db.meeting.findMany({ where: { deletedAt: { not: null } }, orderBy: { updatedAt: "desc" } }),
      db.diaryEntry.findMany({ where: { deletedAt: { not: null } }, orderBy: { updatedAt: "desc" } }),
      db.medication.findMany({ where: { deletedAt: { not: null } }, orderBy: { updatedAt: "desc" } }),
    ]);

    const total =
      contacts.length + notes.length + tasks.length + events.length + expenses.length +
      debts.length + projects.length + meetings.length + diary.length + medications.length;

    return NextResponse.json({
      success: true,
      data: { contacts, notes, tasks, events, expenses, debts, projects, meetings, diary, medications },
      total,
    });
  } catch (error) {
    console.error("GET recycle-bin error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب السلة" }, { status: 500 });
  }
}

// PUT: restore a deleted item
export async function PUT(req: NextRequest) {
  try {
    const { type, id } = await req.json();
    if (!type || !id) return NextResponse.json({ success: false, error: "النوع والمعرف مطلوبان" }, { status: 400 });

    const modelMap: Record<string, any> = {
      contact: db.contact,
      note: db.note,
      task: db.task,
      event: db.event,
      expense: db.expense,
      debt: db.debt,
      project: db.project,
      meeting: db.meeting,
      diary: db.diaryEntry,
      medication: db.medication,
    };
    const model = modelMap[type];
    if (!model) return NextResponse.json({ success: false, error: "نوع غير معروف" }, { status: 400 });
    await model.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT recycle-bin error:", error);
    return NextResponse.json({ success: false, error: "فشل الاسترجاع" }, { status: 500 });
  }
}

// DELETE: permanently delete
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");
    if (!type || !id) return NextResponse.json({ success: false, error: "النوع والمعرف مطلوبان" }, { status: 400 });

    const modelMap: Record<string, any> = {
      contact: db.contact,
      note: db.note,
      task: db.task,
      event: db.event,
      expense: db.expense,
      debt: db.debt,
      project: db.project,
      meeting: db.meeting,
      diary: db.diaryEntry,
      medication: db.medication,
    };
    const model = modelMap[type];
    if (!model) return NextResponse.json({ success: false, error: "نوع غير معروف" }, { status: 400 });
    await model.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE recycle-bin error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف النهائي" }, { status: 500 });
  }
}
