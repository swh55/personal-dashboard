// Seed script — populates the database with comprehensive sample data
// Run with: bun run seed (or `bun prisma/seed.ts`)

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function hoursFromNow(h: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d;
}

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await db.activityLog.deleteMany();
  await db.habitLog.deleteMany();
  await db.habit.deleteMany();
  await db.task.deleteMany();
  await db.project.deleteMany();
  await db.meeting.deleteMany();
  await db.event.deleteMany();
  await db.note.deleteMany();
  await db.expense.deleteMany();
  await db.budget.deleteMany();
  await db.asset.deleteMany();
  await db.account.deleteMany();
  await db.debt.deleteMany();
  await db.occasion.deleteMany();
  await db.diaryEntry.deleteMany();
  await db.medication.deleteMany();
  await db.sleepLog.deleteMany();
  await db.pantryItem.deleteMany();
  await db.waitingItem.deleteMany();
  await db.savedLocation.deleteMany();
  await db.contactReminder.deleteMany();
  await db.callLog.deleteMany();
  await db.contact.deleteMany();
  await db.happinessLog.deleteMany();
  await db.quranLog.deleteMany();
  await db.integration.deleteMany();
  await db.scheduledMessage.deleteMany();
  await db.automationRule.deleteMany();
  await db.suggestion.deleteMany();
  await db.appSetting.deleteMany();

  // ---------- Contacts ----------
  const contactsData = [
    { name: "الحكومة", phone: "+963 944 111 222", whatsapp: "+963 944 111 222", email: "hukuma@example.com", relation: "family", category: "عائلة", favorite: true, note: "الزوجة" },
    { name: "سوسو", phone: "+963 933 222 333", relation: "family", category: "عائلة", favorite: true, note: "الابنة" },
    { name: "أبو محمد", phone: "+963 955 444 555", relation: "friend", category: "أصدقاء", favorite: true, note: "صديق قديم" },
    { name: "م. خالد العلي", phone: "+963 966 777 888", email: "khaled@trade-sy.com", relation: "business", category: "شركاء", favorite: true, note: "شريك تجاري" },
    { name: "المحامي سمير", phone: "+963 988 999 000", relation: "business", category: "محاماة" },
    { name: "د. يارا", phone: "+963 944 555 666", relation: "other", category: "أطباء", note: "طبيبة العائلة" },
    { name: "أبو فادي (بقالة)", phone: "+963 933 111 444", relation: "business", category: "موردون" },
    { name: "محمد الحلبي", phone: "+963 955 222 555", relation: "work", category: "موظفون" },
    { name: "ليلى أحمد", phone: "+963 988 333 666", email: "laila@example.com", relation: "work", category: "موظفون" },
    { name: "العم خالد", phone: "+963 944 777 000", relation: "family", category: "عائلة" },
    { name: "أم حسن", phone: "+963 966 111 222", relation: "friend", category: "أصدقاء" },
    { name: "شركة النور للتجارة", phone: "+963 21 555 1234", email: "info@alnoor.com", relation: "business", category: "شركات" },
  ];
  const contacts = [];
  for (const c of contactsData) {
    contacts.push(await db.contact.create({ data: c as any }));
  }

  // ---------- Call Logs ----------
  const callLogsData = [
    { contactId: contacts[0].id, name: contacts[0].name, phone: contacts[0].phone, type: "call", direction: "outgoing", note: "مكالمة مسائية", createdAt: hoursFromNow(-2) },
    { contactId: contacts[3].id, name: contacts[3].name, phone: contacts[3].phone, type: "call", direction: "incoming", note: "بشان صفقة جديدة", createdAt: hoursFromNow(-5) },
    { contactId: contacts[1].id, name: contacts[1].name, phone: contacts[1].phone, type: "whatsapp", direction: "outgoing", createdAt: hoursFromNow(-8) },
    { contactId: contacts[2].id, name: contacts[2].name, phone: contacts[2].phone, type: "call", direction: "missed", createdAt: hoursFromNow(-26) },
    { contactId: contacts[5].id, name: contacts[5].name, phone: contacts[5].phone, type: "call", direction: "incoming", note: "موعد فحص دوري", createdAt: hoursFromNow(-50) },
    { name: "رقم مجهول", phone: "+963 999 888 777", type: "call", direction: "missed", createdAt: hoursFromNow(-72) },
    { contactId: contacts[6].id, name: contacts[6].name, phone: contacts[6].phone, type: "call", direction: "outgoing", note: "طلب بضاعة", createdAt: hoursFromNow(-96) },
  ];
  for (const cl of callLogsData) {
    await db.callLog.create({ data: cl as any });
  }

  // ---------- Events ----------
  const eventsData = [
    { title: "اجتماع في السجل التجاري", description: "مراجعة معاملات", startDate: hoursFromNow(2), endDate: hoursFromNow(3), type: "work", color: "emerald", location: "السجل التجاري - حلب" },
    { title: "الكشف الحسي على المتاجر", description: "جولة تفتيشية شهرية", startDate: hoursFromNow(24), endDate: hoursFromNow(26), type: "work", color: "amber", location: "أسواق حلب" },
    { title: "غداء عائلي", description: "غداء مع الحكمأة وسوسو", startDate: daysFromNow(2), type: "family", color: "rose" },
    { title: "موعد طبيب", description: "فحص دوري", startDate: daysFromNow(4), endDate: daysFromNow(4), type: "health", color: "blue", location: "عيادة د. يارا" },
    { title: "اجتماع مع شريك", description: "مناقشة صفقة استيراد", startDate: daysFromNow(5), type: "work", color: "emerald" },
    { title: "عيد ميلاد سوسو", description: "احتفال عائلي", startDate: daysFromNow(12), allDay: true, type: "family", color: "violet" },
    { title: "تذكير دفع فاتورة الكهرباء", startDate: daysFromNow(7), type: "personal", color: "amber" },
    { title: "متابعة مشروع المتجر الجديد", startDate: daysFromNow(10), type: "work", color: "emerald" },
  ];
  for (const e of eventsData) {
    await db.event.create({ data: e as any });
  }

  // ---------- Tasks ----------
  const tasksData = [
    { title: "إعداد تقرير المبيعات الشهري", description: "تقرير شهر كامل", status: "doing", priority: "high", category: "work", dueDate: daysFromNow(2) },
    { title: "متابعة معاملة السجل التجاري", status: "todo", priority: "high", category: "work", dueDate: daysFromNow(1) },
    { title: "شراء هدية لعيد ميلاد سوسو", status: "todo", priority: "medium", category: "family", dueDate: daysFromNow(10) },
    { title: "دفع فاتورة الكهرباء", status: "todo", priority: "medium", category: "finance", dueDate: daysFromNow(3) },
    { title: "مراجعة عقد الإيجار الجديد", status: "todo", priority: "high", category: "finance" },
    { title: "ترتيب مكتب المنزل", status: "todo", priority: "low", category: "personal" },
    { title: "حجز موعد الطبيب", status: "done", priority: "medium", category: "health", createdAt: daysFromNow(-3) },
    { title: "إنهاء صفقة استيراد البضاعة", status: "doing", priority: "high", category: "work", dueDate: daysFromNow(5) },
    { title: "تحديث سجل العملاء", status: "todo", priority: "low", category: "work" },
    { title: "شراء مستلزمات المطبخ", status: "todo", priority: "low", category: "personal" },
    { title: "متابعة دفعة التأمين", status: "done", priority: "medium", category: "finance", createdAt: daysFromNow(-5) },
    { title: "قراءة كتاب إدارة الوقت", status: "doing", priority: "low", category: "personal" },
  ];
  for (const t of tasksData) {
    await db.task.create({ data: t as any });
  }

  // ---------- Notes ----------
  const notesData = [
    { title: "أفكار تجارية", content: "1. فتح فرع جديد في اللاذقية\n2. توسيع نشاط الاستيراد من تركيا\n3. دراسة سوق المنتجات الإلكترونية", color: "yellow", pinned: true },
    { title: "قائمة التسوق", content: "- حليب\n- خبز\n- خضار\n- فاكهة\n- منظفات", color: "green" },
    { title: "ملاحظات اجتماع", content: "اجتماع مع شريك حول صفقة استيراد. تم الاتفاق على الأسعار والمواعيد. المتابعة بعد أسبوع.", color: "blue" },
    { title: "تذكيرات مهمة", content: "- تجديد رخصة المحل قبل نهاية الشهر\n- دفع الضريبة\n- مراجعة المحاسب", color: "red", pinned: true },
    { title: "كتب مقترحة", content: "1. العادات الذرية - جيمس كلير\n2. البداية والنهاية - ريمي حسن\n3. فن اللامبالاة", color: "purple" },
    { title: "أهداف الشهر", content: "- زيادة المبيعات بنسبة 15%\n- تقليل المصروفات\n- تنظيم الوقت بشكل أفضل", color: "default" },
  ];
  for (const n of notesData) {
    await db.note.create({ data: n as any });
  }

  // ---------- Expenses ----------
  const expensesData = [
    { amount: 250000, currency: "syp", category: "bills", description: "فاتورة الكهرباء", date: daysFromNow(-1) },
    { amount: 50000, currency: "syp", category: "food", description: "تسوق يومي", date: daysFromNow(-2) },
    { amount: 120000, currency: "syp", category: "transport", description: "وقود السيارة", date: daysFromNow(-3) },
    { amount: 30, currency: "usd", category: "health", description: "أدوية", date: daysFromNow(-4) },
    { amount: 80000, currency: "syp", category: "shopping", description: "ملابس لسوسو", date: daysFromNow(-5) },
    { amount: 15000, currency: "syp", category: "food", description: "غداء خارجي", date: daysFromNow(-6) },
    { amount: 200000, currency: "syp", category: "bills", description: "فاتورة الماء", date: daysFromNow(-7) },
    { amount: 50, currency: "usd", category: "charity", description: "صدقة", date: daysFromNow(-8) },
    { amount: 75000, currency: "syp", category: "transport", description: "صيانة سيارة", date: daysFromNow(-10) },
    { amount: 35000, currency: "syp", category: "food", description: "خضار وفاكهة", date: daysFromNow(-11) },
    { amount: 100000, currency: "syp", category: "general", description: "مصاريف متنوعة", date: daysFromNow(-12) },
    { amount: 40, currency: "usd", category: "education", description: "كتب مدرسية", date: daysFromNow(-14) },
    { amount: 180000, currency: "syp", category: "bills", description: "فاتورة الإنترنت", date: daysFromNow(-15) },
    { amount: 60000, currency: "syp", category: "entertainment", description: "نزهة عائلية", date: daysFromNow(-16) },
  ];
  for (const e of expensesData) {
    await db.expense.create({ data: e as any });
  }

  // ---------- Budgets ----------
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const budgetsData = [
    { category: "food", limit: 800000, month: currentMonth, year: currentYear },
    { category: "bills", limit: 1000000, month: currentMonth, year: currentYear },
    { category: "transport", limit: 500000, month: currentMonth, year: currentYear },
    { category: "shopping", limit: 400000, month: currentMonth, year: currentYear },
    { category: "health", limit: 300000, month: currentMonth, year: currentYear },
    { category: "entertainment", limit: 200000, month: currentMonth, year: currentYear },
  ];
  for (const b of budgetsData) {
    await db.budget.create({ data: b as any });
  }

  // ---------- Assets ----------
  const assetsData = [
    { name: "نقد في المحفظة", amount: 1500000, currency: "syp", type: "cash" },
    { name: "حساب بنكي - بنك سوريا الدولي", amount: 25000000, currency: "syp", type: "bank" },
    { name: "ادخار دولار", amount: 5000, currency: "usd", type: "cash" },
    { name: "محل تجاري", amount: 75000000, currency: "syp", type: "real-estate" },
    { name: "ذهب (مقتنيات)", amount: 100, currency: "usd", type: "gold" },
    { name: "سيارة", amount: 15000, currency: "usd", type: "other" },
  ];
  for (const a of assetsData) {
    await db.asset.create({ data: a as any });
  }

  // ---------- Accounts ----------
  const accountsData = [
    { name: "الحساب الجاري", balance: 25000000, currency: "syp", type: "bank", institution: "بنك سوريا الدولي" },
    { name: "ادخار", balance: 8000000, currency: "syp", type: "savings", institution: "بنك بيمو" },
    { name: "نقد منزلي", balance: 500000, currency: "syp", type: "cash" },
    { name: "حساب دولار", balance: 3000, currency: "usd", type: "bank", institution: "بنك سوريا الدولي" },
  ];
  for (const a of accountsData) {
    await db.account.create({ data: a as any });
  }

  // ---------- Debts ----------
  const debtsData = [
    { personName: "أبو محمد", amount: 500000, currency: "syp", type: "owed", description: "قرض شخصي", dueDate: daysFromNow(30) },
    { personName: "م. خالد", amount: 1500, currency: "usd", type: "owed", description: "بضاعة", dueDate: daysFromNow(15) },
    { personName: "المحامي سمير", amount: 200000, currency: "syp", type: "owe", description: "أتعاب محاماة", dueDate: daysFromNow(7) },
    { personName: "شركة النور", amount: 800, currency: "usd", type: "owe", description: "بضاعة مستورة" },
  ];
  for (const d of debtsData) {
    await db.debt.create({ data: d as any });
  }

  // ---------- Projects ----------
  const projectsData = [
    { name: "افتتاح فرع جديد", description: "دراسة فتح فرع في منطقة الأشرفية", status: "active", color: "emerald", progress: 35, startDate: daysFromNow(-30) },
    { name: "تطوير متجر إلكتروني", description: "إنشاء منصة بيع أونلاين", status: "active", color: "blue", progress: 60, startDate: daysFromNow(-20) },
    { name: "صفقة استيراد تركيا", description: "استيراد بضائج إلكترونية من إسطنبول", status: "active", color: "amber", progress: 75, startDate: daysFromNow(-15) },
    { name: "تجديد المحل الرئيسي", description: "صيانة وتجديد ديكور المحل", status: "paused", color: "rose", progress: 20 },
    { name: "حملة تسويقية", description: "حملة إعلانية على فيسبوك وإنستغرام", status: "completed", color: "violet", progress: 100, startDate: daysFromNow(-60), endDate: daysFromNow(-10) },
  ];
  for (const p of projectsData) {
    await db.project.create({ data: p as any });
  }

  // ---------- Meetings ----------
  const meetingsData = [
    { title: "اجتماع أسبوعي مع الموظفين", agenda: "مراجعة الأداء والمهام", participants: "محمد, ليلى, خالد", startDate: hoursFromNow(4), endDate: hoursFromNow(5), location: "المكتب", status: "scheduled" },
    { title: "اجتماع مع شريك", agenda: "مناقشة صفقة استيراد", participants: "م. خالد العلي", startDate: daysFromNow(2), endDate: daysFromNow(2), location: "مقهى الألمان", status: "scheduled" },
    { title: "اجتماع مع المحامي", agenda: "مراجعة العقود", participants: "المحامي سمير", startDate: daysFromNow(5), status: "scheduled" },
    { title: "اجتماع طارئ", agenda: "مشكلة في الشحنة", startDate: daysFromNow(-2), status: "completed", notes: "تم حل المشكلة بالكامل" },
  ];
  for (const m of meetingsData) {
    await db.meeting.create({ data: m as any });
  }

  // ---------- Occasions ----------
  const occasionsData = [
    { title: "عيد ميلاد سوسو", date: daysFromNow(12), type: "birthday", recurring: true, note: "تكون 8 سنوات" },
    { title: "عيد ميلاد الحكمأة", date: daysFromNow(40), type: "birthday", recurring: true },
    { title: "ذكرى الزواج", date: daysFromNow(60), type: "anniversary", recurring: true, note: "10 سنوات زواج" },
    { title: "عيد الفطر", date: daysFromNow(-2), type: "holiday", recurring: true },
    { title: "عيد الأضحى", date: daysFromNow(45), type: "holiday", recurring: true },
  ];
  for (const o of occasionsData) {
    await db.occasion.create({ data: o as any });
  }

  // ---------- Diary ----------
  const diaryData = [
    { title: "يوم جيد", content: "اليوم كان يوم حافل. أنهيت عدة مهام في العمل وقضيت وقتاً ممتعاً مع العائلة مساءً.", mood: "happy", weather: "مشمس", date: daysFromNow(-1) },
    { title: "يوم متعب", content: "كان اليوم مرهقاً بسبب كثرة الاجتماعات والمعاملات. أحتاج للراحة.", mood: "neutral", weather: "غائم", date: daysFromNow(-2) },
    { title: "إنجازات", content: "أنهيت صفقة استيراد كبيرة اليوم. أشعر بالرضا عن الإنجاز.", mood: "excited", weather: "مشمس", date: daysFromNow(-4) },
    { title: "تأملات", content: "أحياناً أفكر في مستقبل العائلة وكيف أوفر لهم حياة أفضل. الحمد لله على نعمه.", mood: "neutral", date: daysFromNow(-7) },
  ];
  for (const d of diaryData) {
    await db.diaryEntry.create({ data: d as any });
  }

  // ---------- Habits ----------
  const habitsData = [
    { name: "قراءة القرآن", description: "قراءة جزء يومياً", frequency: "daily", target: 1, color: "emerald", icon: "BookOpen" },
    { name: "الرياضة", description: "30 دقيقة مشي", frequency: "daily", target: 1, color: "blue", icon: "Dumbbell" },
    { name: "شرب الماء", description: "8 أكواب يومياً", frequency: "daily", target: 8, color: "blue", icon: "Droplet" },
    { name: "الاستيقاظ مبكراً", description: "قبل صلاة الفجر", frequency: "daily", target: 1, color: "amber", icon: "Sunrise" },
    { name: "مراجعة المهام", description: "كل يوم مساءً", frequency: "daily", target: 1, color: "violet", icon: "ListChecks" },
  ];
  const habits = [];
  for (const h of habitsData) {
    habits.push(await db.habit.create({ data: h as any }));
  }
  // Habit logs for the last 7 days
  for (const habit of habits) {
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      // Random completion (skip some days)
      if (Math.random() > 0.25) {
        const value = habit.target > 1 ? Math.floor(Math.random() * habit.target) + 1 : 1;
        await db.habitLog.create({
          data: { habitId: habit.id, date, value, note: "" } as any,
        }).catch(() => {});
      }
    }
  }

  // ---------- Medications ----------
  const medicationsData = [
    { name: "أدوية الضغط", dosage: "حبة واحدة", frequency: "يومياً صباحاً", startDate: daysFromNow(-30), active: true },
    { name: "فيتامين د", dosage: "حبة", frequency: "أسبوعياً", startDate: daysFromNow(-15), active: true },
    { name: "أدوية الزكام", dosage: "ملعقة", frequency: "3 مرات يومياً", startDate: daysFromNow(-3), endDate: daysFromNow(2), active: true },
  ];
  for (const m of medicationsData) {
    await db.medication.create({ data: m as any });
  }

  // ---------- Sleep Logs ----------
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const bedtime = new Date(date);
    bedtime.setHours(23);
    bedtime.setMinutes(Math.floor(Math.random() * 60));
    const wakeTime = new Date(date);
    wakeTime.setDate(wakeTime.getDate() + 1);
    wakeTime.setHours(6 + Math.floor(Math.random() * 2));
    const duration = Math.round((wakeTime.getTime() - bedtime.getTime()) / 60000);
    const qualities = ["poor", "fair", "good", "excellent"];
    await db.sleepLog.create({
      data: { date, bedtime, wakeTime, duration, quality: qualities[Math.floor(Math.random() * qualities.length)] } as any,
    });
  }

  // ---------- Pantry ----------
  const pantryData = [
    { name: "أرز", quantity: 5, unit: "kg", lowStock: 2, category: "grains" },
    { name: "برغل", quantity: 3, unit: "kg", lowStock: 1, category: "grains" },
    { name: "زيت زيتون", quantity: 2, unit: "l", lowStock: 1, category: "other" },
    { name: "سكر", quantity: 1, unit: "kg", lowStock: 2, category: "other" },
    { name: "شاي", quantity: 2, unit: "pack", lowStock: 1, category: "beverages" },
    { name: "حليب", quantity: 3, unit: "l", lowStock: 2, category: "dairy" },
    { name: "جبن", quantity: 1, unit: "kg", lowStock: 1, category: "dairy" },
    { name: "خبز", quantity: 0, unit: "piece", lowStock: 2, category: "other" },
    { name: "طماطم", quantity: 2, unit: "kg", lowStock: 1, category: "vegetables" },
    { name: "بطاطا", quantity: 5, unit: "kg", lowStock: 2, category: "vegetables" },
    { name: "تفاح", quantity: 3, unit: "kg", lowStock: 1, category: "fruits" },
    { name: "موز", quantity: 1, unit: "kg", lowStock: 1, category: "fruits" },
    { name: "دجاج", quantity: 2, unit: "kg", lowStock: 1, category: "meat" },
    { name: "لحم", quantity: 1, unit: "kg", lowStock: 1, category: "meat" },
    { name: "منظفات", quantity: 2, unit: "pack", lowStock: 1, category: "cleaning" },
  ];
  for (const p of pantryData) {
    await db.pantryItem.create({ data: p as any });
  }

  // ---------- Waiting List ----------
  const waitingData = [
    { title: "رد من مورد تركيا", description: "بانتظار تأكيد الطلب", priority: 5, ready: false },
    { title: "اعتماد القرض من البنك", description: "بنك سوريا الدولي", priority: 4, ready: false },
    { title: "إنجاز معاملة السجل", description: "بانتظار ختم المدير", priority: 3, ready: true },
    { title: "صيانة الكمبيوتر", description: "الكمبيوتر المحمول يحتاج صيانة", priority: 2, ready: false },
    { title: "تسليم الطلب القديم", description: "للعميل أبو خالد", priority: 1, ready: true },
  ];
  for (const w of waitingData) {
    await db.waitingItem.create({ data: w as any });
  }

  // ---------- Saved Locations ----------
  const locationsData = [
    { name: "المنزل", address: "حلب - حي الجميلية", lat: 36.2021, lng: 37.1343, icon: "Home", color: "emerald" },
    { name: "السجل التجاري", address: "حلب - وسط المدينة", lat: 36.198, lng: 37.13, icon: "Building2", color: "blue" },
    { name: "المحل التجاري", address: "حلب - سوق المدينة", lat: 36.205, lng: 37.14, icon: "Store", color: "amber" },
    { name: "عيادة د. يارا", address: "حلب - شارع النيل", lat: 36.21, lng: 37.155, icon: "Stethoscope", color: "rose" },
    { name: "مسجد الحمد", address: "حلب - بجانب المنزل", lat: 36.203, lng: 37.135, icon: "Moon", color: "violet" },
  ];
  for (const l of locationsData) {
    await db.savedLocation.create({ data: l as any });
  }

  // ---------- Contact Reminders ----------
  const remindersData = [
    { contactId: contacts[0].id, contactName: contacts[0].name, frequency: "daily", lastContacted: daysFromNow(-1), nextReminder: daysFromNow(0), active: true },
    { contactId: contacts[1].id, contactName: contacts[1].name, frequency: "weekly", lastContacted: daysFromNow(-8), nextReminder: daysFromNow(-1), active: true },
    { contactId: contacts[2].id, contactName: contacts[2].name, frequency: "weekly", lastContacted: daysFromNow(-5), nextReminder: daysFromNow(2), active: true },
    { contactId: contacts[3].id, contactName: contacts[3].name, frequency: "monthly", lastContacted: daysFromNow(-20), nextReminder: daysFromNow(10), active: true },
    { contactId: contacts[5].id, contactName: contacts[5].name, frequency: "monthly", lastContacted: daysFromNow(-35), nextReminder: daysFromNow(-5), active: true },
  ];
  for (const r of remindersData) {
    await db.contactReminder.create({ data: r as any });
  }

  // ---------- Happiness Logs ----------
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    await db.happinessLog.create({
      data: {
        date,
        score: Math.floor(Math.random() * 4) + 6,
        factors: JSON.stringify({ work: Math.floor(Math.random() * 3) + 7, family: 9, health: 7 }),
        note: i === 0 ? "يوم جيد بشكل عام" : "",
      } as any,
    }).catch(() => {});
  }

  // ---------- Quran Logs ----------
  const quranData = [
    { surah: 1, fromAyah: 1, toAyah: 7, juz: 1, note: "الفاتحة", date: daysFromNow(-1) },
    { surah: 2, fromAyah: 1, toAyah: 20, juz: 1, note: "البقرة", date: daysFromNow(-2) },
    { surah: 18, fromAyah: 1, toAyah: 10, juz: 15, note: "الكهف", date: daysFromNow(-3) },
    { surah: 36, fromAyah: 1, toAyah: 12, juz: 22, note: "يس", date: daysFromNow(-4) },
    { surah: 55, fromAyah: 1, toAyah: 13, juz: 27, note: "الرحمن", date: daysFromNow(-5) },
    { surah: 67, fromAyah: 1, toAyah: 5, juz: 29, date: daysFromNow(-6) },
    { surah: 112, fromAyah: 1, toAyah: 4, date: daysFromNow(0) },
  ];
  for (const q of quranData) {
    await db.quranLog.create({ data: q as any });
  }

  // ---------- Integrations ----------
  const integrationsData = [
    { service: "google_calendar", name: "تقويم Google", connected: false },
    { service: "google_drive", name: "Google Drive", connected: false },
    { service: "telegram", name: "تيليغرام", connected: true, lastSync: daysFromNow(-1) },
    { service: "email", name: "البريد الإلكتروني", connected: true, lastSync: hoursFromNow(-3) },
    { service: "github", name: "GitHub", connected: false },
    { service: "google_contacts", name: "جهات اتصال Google", connected: false },
    { service: "cloud_sync", name: "مزامنة سحابية", connected: true, lastSync: hoursFromNow(-1) },
  ];
  for (const i of integrationsData) {
    await db.integration.create({ data: i as any });
  }

  // ---------- Scheduled Messages ----------
  const scheduledMessagesData = [
    { recipient: "+963 944 111 222", message: "تذكير: موعد الطبيب غداً الساعة 10", channel: "whatsapp", scheduledAt: hoursFromNow(12) },
    { recipient: "+963 966 777 888", message: "اجتماع غداً الساعة 4 عصراً", channel: "telegram", scheduledAt: hoursFromNow(20) },
    { recipient: "+963 933 222 333", message: "كل الحب يا سوسو، عيد ميلاد سعيد قريباً", channel: "whatsapp", scheduledAt: daysFromNow(11) },
    { recipient: "info@alnoor.com", message: "متابعة بخصوص الطلب الأخير", channel: "email", scheduledAt: daysFromNow(2) },
  ];
  for (const s of scheduledMessagesData) {
    await db.scheduledMessage.create({ data: s as any });
  }

  // ---------- Automation Rules ----------
  const automationData = [
    { name: "تذكير قبل المواعيد", trigger: "event_upcoming", action: "notify", config: JSON.stringify({ minutesBefore: 30 }), active: true },
    { name: "نسخ احتياطي أسبوعي", trigger: "weekly", action: "backup", config: JSON.stringify({ day: "friday", hour: 23 }), active: true },
    { name: "تنبيه تجاوز الميزانية", trigger: "budget_exceeded", action: "alert", active: true },
    { name: "تذكير شرب الماء", trigger: "hourly", action: "notify", config: JSON.stringify({ hours: [10, 12, 14, 16, 18] }), active: false },
  ];
  for (const a of automationData) {
    await db.automationRule.create({ data: a as any });
  }

  // ---------- Suggestions ----------
  const suggestionsData = [
    { title: "تنظيم وقت أفضل", content: "بناءً على تحليل نشاطك، نقترح تخصيص فترة الصباح (8-11) للمهام عالية الأولوية.", category: "productivity", status: "pending" },
    { title: "تقليل مصاريف الطعام", content: "مصاريف الطعام لديك مرتفعة هذا الشهر. نقترح التحضير المسبق للوجبات.", category: "finance", status: "pending" },
    { title: "ممارسة الرياضة", content: "لم تمارس الرياضة بانتظام. حاول المشي 30 دقيقة يومياً.", category: "health", status: "pending" },
    { title: "مراجعة الديون", content: "لديك دين يستحق قريباً. تأكد من توفير المبلغ المطلوب.", category: "finance", status: "pending" },
  ];
  for (const s of suggestionsData) {
    await db.suggestion.create({ data: s as any });
  }

  // ---------- Activity Log ----------
  const activityData = [
    { action: "create", entity: "contact", message: "أضيف جهة اتصال: شركة النور للتجارة", createdAt: hoursFromNow(-2) },
    { action: "update", entity: "task", message: "تم تحديث مهمة: إعداد تقرير المبيعات", createdAt: hoursFromNow(-4) },
    { action: "create", entity: "expense", message: "تم تسجيل مصروف: فاتورة الكهرباء", createdAt: hoursFromNow(-6) },
    { action: "toggle", entity: "integration", message: "ربط تكامل: تيليغرام", createdAt: daysFromNow(-1) },
    { action: "create", entity: "note", message: "أضيف ملاحظة: أفكار تجارية", createdAt: daysFromNow(-1) },
    { action: "delete", entity: "task", message: "حذف مهمة قديمة", createdAt: daysFromNow(-2) },
    { action: "create", entity: "event", message: "أضيف حدث: اجتماع في السجل التجاري", createdAt: daysFromNow(-2) },
    { action: "sync", entity: "sync", message: "مزامنة Google Contacts: استيراد 0، تخطي 0", createdAt: daysFromNow(-3) },
  ];
  for (const a of activityData) {
    await db.activityLog.create({ data: a as any });
  }

  // ---------- App Settings ----------
  await db.appSetting.create({ data: { key: "username", value: "عبد الله" } });
  await db.appSetting.create({ data: { key: "theme", value: "dark" } });

  console.log("✅ Seeding complete!");
  console.log(`   - Contacts: ${await db.contact.count()}`);
  console.log(`   - Events: ${await db.event.count()}`);
  console.log(`   - Tasks: ${await db.task.count()}`);
  console.log(`   - Notes: ${await db.note.count()}`);
  console.log(`   - Expenses: ${await db.expense.count()}`);
  console.log(`   - Projects: ${await db.project.count()}`);
  console.log(`   - Pantry Items: ${await db.pantryItem.count()}`);
  console.log(`   - Quran Logs: ${await db.quranLog.count()}`);
  console.log(`   - And much more...`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
