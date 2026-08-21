// =============================================================================
// DEMO DATA — realistic sample data for first-time visitors.
// =============================================================================
//
// When a user opens the app for the first time (no localStorage data and no
// cloud account), we seed this data into localStorage so they can explore
// every feature without creating data from scratch.
//
// Properties:
//   - Marked with `isDemo: true` so we can identify and clear ONLY demo
//     data without touching real user data.
//   - Uses relative dates (today, tomorrow, +3 days) so the data always
//     looks fresh regardless of when the user first visits.
//   - Covers all major entity types and their common states (pending/
//     done, incoming/outgoing/missed, different categories, etc.)
//   - Arabic content consistent with the RTL dashboard.

// Helper: build a Date offset by N days from today at a specific hour.
function dayOffset(days: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function todayISO(): string {
  return new Date().toISOString();
}

// IDs are prefixed with "demo-" so they're easy to identify and deduplicate.
function demoId(suffix: string): string {
  return `demo-${suffix}`;
}

export const DEMO_DATA: Record<string, any[]> = {
  // ---------------- Tasks (7) ----------------
  tasks: [
    { id: demoId("t1"), title: "مراجعة تقرير المبيعات الشهري", description: "تحليل أداء آخر 30 يوماً وإعداد ملخص للإدارة", status: "todo", priority: "high", category: "work", dueDate: dayOffset(0, 17), deletedAt: null, createdAt: dayOffset(-2), updatedAt: todayISO() },
    { id: demoId("t2"), title: "شراء هدية لعيد ميلاد سوسو", description: "كتاب + لعبة تعليمية", status: "todo", priority: "medium", category: "family", dueDate: dayOffset(2, 18), deletedAt: null, createdAt: dayOffset(-1), updatedAt: todayISO() },
    { id: demoId("t3"), title: "دفع فاتورة الكهرباء", description: "القراءة الحالية: 4500 ل.س", status: "todo", priority: "high", category: "finance", dueDate: dayOffset(1, 12), deletedAt: null, createdAt: dayOffset(-3), updatedAt: todayISO() },
    { id: demoId("t4"), title: "متابعة موعد الصيانة الدورية للسيارة", description: "تغيير زيت + فحص فرامل", status: "doing", priority: "medium", category: "personal", dueDate: dayOffset(3, 10), deletedAt: null, createdAt: dayOffset(-4), updatedAt: todayISO() },
    { id: demoId("t5"), title: "قراءة 20 صفحة من كتاب «العادات الذرية»", description: "الفصل الرابع", status: "done", priority: "low", category: "personal", dueDate: dayOffset(-1, 21), deletedAt: null, createdAt: dayOffset(-2), updatedAt: dayOffset(-1) },
    { id: demoId("t6"), title: "إرسال عرض السعر للعميل الجديد", description: "شركة المستقبل التجارية", status: "done", priority: "high", category: "work", dueDate: dayOffset(-1, 14), deletedAt: null, createdAt: dayOffset(-3), updatedAt: dayOffset(-1) },
    { id: demoId("t7"), title: "حجز موعد الطبيب — متابعة الضغط", description: "د. أحمد، الساعة 11", status: "todo", priority: "medium", category: "health", dueDate: dayOffset(5, 11), deletedAt: null, createdAt: todayISO(), updatedAt: todayISO() },
  ],

  // ---------------- Events / Calendar (7) ----------------
  events: [
    { id: demoId("e1"), title: "اجتماع فريق المبيعات", description: "مراجعة أهداف الربع الحالي", startDate: dayOffset(0, 10), endDate: dayOffset(0, 11), allDay: false, type: "work", color: "emerald", location: "المكتب", deletedAt: null, createdAt: dayOffset(-2), updatedAt: todayISO() },
    { id: demoId("e2"), title: "غداء مع العميل", description: "مناقشة شراكة جديدة", startDate: dayOffset(0, 13), endDate: dayOffset(0, 14, 30), allDay: false, type: "work", color: "amber", location: "مطعم المدينة", deletedAt: null, createdAt: dayOffset(-1), updatedAt: todayISO() },
    { id: demoId("e3"), title: "حصة الرياضة الصباحية", description: "جري 30 دقيقة", startDate: dayOffset(1, 6, 30), endDate: dayOffset(1, 7), allDay: false, type: "health", color: "rose", location: "الحديقة", deletedAt: null, createdAt: dayOffset(-1), updatedAt: todayISO() },
    { id: demoId("e4"), title: "عيد ميلاد سوسو", description: "حفلة عائلية", startDate: dayOffset(2, 18), endDate: dayOffset(2, 21), allDay: false, type: "family", color: "violet", location: "المنزل", deletedAt: null, createdAt: dayOffset(-5), updatedAt: todayISO() },
    { id: demoId("e5"), title: "مواعيد الأعمال — السجل التجاري", description: null, startDate: dayOffset(3, 8), endDate: dayOffset(3, 15), allDay: false, type: "work", color: "emerald", location: "السجل التجاري", deletedAt: null, createdAt: dayOffset(-7), updatedAt: todayISO() },
    { id: demoId("e6"), title: "موعد الطبيب", description: "متابعة شهرية", startDate: dayOffset(5, 11), endDate: dayOffset(5, 12), allDay: false, type: "health", color: "rose", location: "عيادة د. أحمد", deletedAt: null, createdAt: todayISO(), updatedAt: todayISO() },
    { id: demoId("e7"), title: "عيد المعلم (عطلة رسمية)", description: null, startDate: dayOffset(7, 0), endDate: dayOffset(7, 23, 59), allDay: true, type: "other", color: "amber", location: null, deletedAt: null, createdAt: todayISO(), updatedAt: todayISO() },
  ],

  // ---------------- Contacts (9) ----------------
  contacts: [
    { id: demoId("c1"), name: "أحمد الخطيب", phone: "+963 944 555 111", whatsapp: "+963 944 555 111", email: "ahmad.k@example.com", relation: "family", category: null, note: "الشقيق الأكبر", favorite: true, avatar: null, deletedAt: null, createdAt: dayOffset(-30), updatedAt: dayOffset(-30) },
    { id: demoId("c2"), name: "محمد العلي", phone: "+963 933 222 333", whatsapp: "+963 933 222 333", email: "mohammad@example.com", relation: "friend", category: null, note: "صديق الطفولة", favorite: true, avatar: null, deletedAt: null, createdAt: dayOffset(-25), updatedAt: dayOffset(-25) },
    { id: demoId("c3"), name: "سامر التجاري", phone: "+963 991 888 777", whatsapp: "+963 991 888 777", email: "samer@business.com", relation: "business", category: "مورد", note: "مورّد مواد خام", favorite: false, avatar: null, deletedAt: null, createdAt: dayOffset(-20), updatedAt: dayOffset(-20) },
    { id: demoId("c4"), name: "د. أحمد الطبيب", phone: "+963 955 666 444", whatsapp: null, email: "doc.ahmad@clinic.com", relation: "work", category: "طبيب", note: "طبيب القلب — متابعة شهرية", favorite: false, avatar: null, deletedAt: null, createdAt: dayOffset(-15), updatedAt: dayOffset(-15) },
    { id: demoId("c5"), name: "فاطمة الخطيب", phone: "+963 944 111 222", whatsapp: "+963 944 111 222", email: null, relation: "family", category: null, note: "الوالدة", favorite: true, avatar: null, deletedAt: null, createdAt: dayOffset(-40), updatedAt: dayOffset(-40) },
    { id: demoId("c6"), name: "خالد المهندس", phone: "+963 988 333 555", whatsapp: "+963 988 333 555", email: "khaled.eng@example.com", relation: "work", category: "زميل", note: "مهندس معماري", favorite: false, avatar: null, deletedAt: null, createdAt: dayOffset(-10), updatedAt: dayOffset(-10) },
    { id: demoId("c7"), name: "ليلى الحسن", phone: "+963 977 444 666", whatsapp: "+963 977 444 666", email: "layla@example.com", relation: "friend", category: null, note: "زميلة الجامعة", favorite: false, avatar: null, deletedAt: null, createdAt: dayOffset(-5), updatedAt: dayOffset(-5) },
    { id: demoId("c8"), name: "شركة المستقبل التجارية", phone: "+963 11 555 8888", whatsapp: null, email: "info@future-trade.com", relation: "business", category: "عميل", note: "عميل كبير — شراكة محتملة", favorite: true, avatar: null, deletedAt: null, createdAt: dayOffset(-3), updatedAt: dayOffset(-3) },
    { id: demoId("c9"), name: "يوسف الصغير", phone: "+963 966 777 999", whatsapp: null, email: null, relation: "other", category: null, note: "ابن الجيران", favorite: false, avatar: null, deletedAt: null, createdAt: dayOffset(-2), updatedAt: dayOffset(-2) },
  ],

  // ---------------- Call Logs (6) ----------------
  callLogs: [
    { id: demoId("cl1"), contactId: demoId("c1"), name: "أحمد الخطيب", phone: "+963 944 555 111", type: "call", direction: "outgoing", note: null, createdAt: dayOffset(0, 9, 15) },
    { id: demoId("cl2"), contactId: demoId("c3"), name: "سامر التجاري", phone: "+963 991 888 777", type: "call", direction: "incoming", note: "بخصوص الطلبية", createdAt: dayOffset(0, 11, 30) },
    { id: demoId("cl3"), contactId: null, name: "رقم مجهول", phone: "+963 912 345 678", type: "call", direction: "missed", note: null, createdAt: dayOffset(-1, 14, 0) },
    { id: demoId("cl4"), contactId: demoId("c2"), name: "محمد العلي", phone: "+963 933 222 333", type: "whatsapp", direction: "outgoing", note: null, createdAt: dayOffset(-1, 20, 0) },
    { id: demoId("cl5"), contactId: demoId("c8"), name: "شركة المستقبل", phone: "+963 11 555 8888", type: "call", direction: "incoming", note: "عرض الشراكة", createdAt: dayOffset(-2, 10, 0) },
    { id: demoId("cl6"), contactId: demoId("c4"), name: "د. أحمد", phone: "+963 955 666 444", type: "call", direction: "outgoing", note: "تأكيد الموعد", createdAt: dayOffset(-3, 16, 0) },
  ],

  // ---------------- Notes (4) ----------------
  notes: [
    { id: demoId("n1"), title: "أفكار لتطوير العمل", content: "1. إطلاق متجر إلكتروني\n2. التوظيف لقسم التسويق\n3. دراسة توسعة المخزن", color: "yellow", pinned: true, deletedAt: null, createdAt: dayOffset(-3), updatedAt: dayOffset(-1) },
    { id: demoId("n2"), title: "قائمة التسوق", content: "• خبز\n• حليب\n• فاكهة موسمية\n• قهوة\n• سكر", color: "green", pinned: false, deletedAt: null, createdAt: dayOffset(-2), updatedAt: dayOffset(-2) },
    { id: demoId("n3"), title: "كتاب موصى به", content: "«العادات الذرية» لجيمس كلير\n— استعارة من المكتبة هذا الأسبوع", color: "blue", pinned: false, deletedAt: null, createdAt: dayOffset(-5), updatedAt: dayOffset(-5) },
    { id: demoId("n4"), title: "أرقام مهمة", content: "السجل التجاري: 555-1234\nالطوارئ الطبية: 110\nالصراف الآلي الأقرب: شارع النصر", color: "red", pinned: true, deletedAt: null, createdAt: dayOffset(-7), updatedAt: dayOffset(-7) },
  ],

  // ---------------- Expenses (7) ----------------
  expenses: [
    { id: demoId("ex1"), amount: 25000, currency: "syp", category: "food", description: "وجبة غداء مع العميل", date: dayOffset(0, 14), deletedAt: null, createdAt: dayOffset(0), updatedAt: dayOffset(0) },
    { id: demoId("ex2"), amount: 4500, currency: "syp", category: "bills", description: "فاتورة كهرباء", date: dayOffset(-1, 10), deletedAt: null, createdAt: dayOffset(-1), updatedAt: dayOffset(-1) },
    { id: demoId("ex3"), amount: 15, currency: "usd", category: "transport", description: "مواصلات هذا الأسبوع", date: dayOffset(-2, 9), deletedAt: null, createdAt: dayOffset(-2), updatedAt: dayOffset(-2) },
    { id: demoId("ex4"), amount: 50000, currency: "syp", category: "health", description: "أدوية الضغط", date: dayOffset(-3, 16), deletedAt: null, createdAt: dayOffset(-3), updatedAt: dayOffset(-3) },
    { id: demoId("ex5"), amount: 12000, currency: "syp", category: "shopping", description: "هدية عيد ميلاد", date: dayOffset(-4, 18), deletedAt: null, createdAt: dayOffset(-4), updatedAt: dayOffset(-4) },
    { id: demoId("ex6"), amount: 8000, currency: "syp", category: "food", description: "بقالة أسبوعية", date: dayOffset(-5, 11), deletedAt: null, createdAt: dayOffset(-5), updatedAt: dayOffset(-5) },
    { id: demoId("ex7"), amount: 5, currency: "usd", category: "charity", description: "صدقة شهرية", date: dayOffset(-7, 8), deletedAt: null, createdAt: dayOffset(-7), updatedAt: dayOffset(-7) },
  ],

  // ---------------- Accounts (2) ----------------
  accounts: [
    { id: demoId("ac1"), name: "حساب البنك الرئيسي", balance: 2500000, currency: "syp", type: "bank", institution: "بنك سوريا الدولي", createdAt: dayOffset(-60), updatedAt: dayOffset(-1) },
    { id: demoId("ac2"), name: "النقدي اليومي", balance: 350000, currency: "syp", type: "cash", institution: null, createdAt: dayOffset(-30), updatedAt: dayOffset(0) },
  ],

  // ---------------- Assets (4) ----------------
  assets: [
    { id: demoId("as1"), name: "سيارة شخصية", amount: 15, currency: "usd", type: "other", description: "تقديري — سيارة 2018", createdAt: dayOffset(-90), updatedAt: dayOffset(-30) },
    { id: demoId("as2"), name: "ذهب (مصوغات عائلية)", amount: 8, currency: "usd", type: "gold", description: "تقدير بالأونصة", createdAt: dayOffset(-90), updatedAt: dayOffset(-15) },
    { id: demoId("as3"), name: "مدخرات ادخار", amount: 2, currency: "usd", type: "savings", description: "حساب ادخار طويل الأمد", createdAt: dayOffset(-60), updatedAt: dayOffset(-7) },
    { id: demoId("as4"), name: "مخزون تجاري", amount: 5000000, currency: "syp", type: "other", description: "قيمة البضاعة الحالية", createdAt: dayOffset(-45), updatedAt: dayOffset(-5) },
  ],

  // ---------------- Debts (3) ----------------
  debts: [
    { id: demoId("d1"), personName: "سامر التجاري", amount: 150, currency: "usd", type: "owe", description: "موردّيات آخر طلبية", dueDate: dayOffset(10), settled: false, settledAt: null, deletedAt: null, createdAt: dayOffset(-5), updatedAt: dayOffset(-5) },
    { id: demoId("d2"), personName: "محمد العلي", amount: 50000, currency: "syp", type: "owed", description: "قرض شخصي — يسترد قريباً", dueDate: dayOffset(7), settled: false, settledAt: null, deletedAt: null, createdAt: dayOffset(-20), updatedAt: dayOffset(-20) },
    { id: demoId("d3"), personName: "البنك — قرض شخصي", amount: 5, currency: "usd", type: "owe", description: "قسط شهري", dueDate: dayOffset(3), settled: false, settledAt: null, deletedAt: null, createdAt: dayOffset(-10), updatedAt: dayOffset(-10) },
  ],

  // ---------------- Budgets (3) ----------------
  budgets: [
    { id: demoId("b1"), category: "food", limit: 100000, month: new Date().getMonth() + 1, year: new Date().getFullYear(), createdAt: dayOffset(-15), updatedAt: dayOffset(-15) },
    { id: demoId("b2"), category: "transport", limit: 50, month: new Date().getMonth() + 1, year: new Date().getFullYear(), createdAt: dayOffset(-15), updatedAt: dayOffset(-15) },
    { id: demoId("b3"), category: "bills", limit: 80000, month: new Date().getMonth() + 1, year: new Date().getFullYear(), createdAt: dayOffset(-15), updatedAt: dayOffset(-15) },
  ],

  // ---------------- Projects (2) ----------------
  projects: [
    { id: demoId("p1"), name: "إطلاق متجر إلكتروني", description: "بيع المنتجات أونلاين وتوسيع قاعدة العملاء", status: "active", color: "emerald", progress: 35, startDate: dayOffset(-30), endDate: dayOffset(60), deletedAt: null, createdAt: dayOffset(-30), updatedAt: dayOffset(-2) },
    { id: demoId("p2"), name: "تطوير قسم التسويق", description: "استراتيجية تسويق رقمي للربع القادم", status: "paused", color: "amber", progress: 15, startDate: dayOffset(-15), endDate: dayOffset(45), deletedAt: null, createdAt: dayOffset(-15), updatedAt: dayOffset(-5) },
  ],

  // ---------------- Meetings (2) ----------------
  meetings: [
    { id: demoId("m1"), title: "مراجعة خطة الربع", agenda: "مناقشة أهداف المبيعات والتسويق", notes: null, location: "قاعة الاجتماعات", participants: "أحمد، خالد، سامر", startDate: dayOffset(1, 10), endDate: dayOffset(1, 11), status: "scheduled", deletedAt: null, createdAt: dayOffset(-3), updatedAt: dayOffset(-3) },
    { id: demoId("m2"), title: "اجتماع طارئ — عرض العميل الجديد", agenda: "مراجعة عرض الشراكة", notes: null, location: "أونلاين — Meet", participants: "فريق الإدارة", startDate: dayOffset(3, 14), endDate: dayOffset(3, 15), status: "scheduled", deletedAt: null, createdAt: dayOffset(-1), updatedAt: dayOffset(-1) },
  ],

  // ---------------- Habits (3) ----------------
  habits: [
    { id: demoId("h1"), name: "قراءة 20 صفحة يومياً", description: "كتاب في التطوير الذاتي", frequency: "daily", target: 1, color: "emerald", icon: "BookOpen", active: true, createdAt: dayOffset(-20), updatedAt: dayOffset(-20) },
    { id: demoId("h2"), name: "صلاة على وقتها", description: "المحافظة على الصلوات الخمس", frequency: "daily", target: 5, color: "amber", icon: "Moon", active: true, createdAt: dayOffset(-60), updatedAt: dayOffset(-60) },
    { id: demoId("h3"), name: "رياضة صباحية", description: "جري 30 دقيقة", frequency: "daily", target: 1, color: "rose", icon: "HeartPulse", active: true, createdAt: dayOffset(-10), updatedAt: dayOffset(-10) },
  ],

  // ---------------- Diary Entries (3) ----------------
  diaryEntries: [
    { id: demoId("dr1"), title: "يوم جيد", content: "اليوم أنهيت تقرير المبيعات في الوقت المحدد. شعرت بإنجاز حقيقي. الغد سيكون أفضل.", mood: "happy", weather: "مشمس", date: dayOffset(-1), deletedAt: null, createdAt: dayOffset(-1), updatedAt: dayOffset(-1) },
    { id: demoId("dr2"), title: "تأملات المساء", content: "راجعت أهدافي لهذا الأسبوع. أحتاج لتركيز أكبر على العائلة وتقليل ساعات العمل.", mood: "neutral", weather: null, date: dayOffset(-3), deletedAt: null, createdAt: dayOffset(-3), updatedAt: dayOffset(-3) },
    { id: demoId("dr3"), title: "ضغط في العمل", content: "الطلبيات تتراكم لكن الفريق صغير. سأبحث عن توظيف شخص جديد.", mood: "anxious", weather: "غائم", date: dayOffset(-5), deletedAt: null, createdAt: dayOffset(-5), updatedAt: dayOffset(-5) },
  ],

  // ---------------- Occasions (4) ----------------
  occasions: [
    { id: demoId("oc1"), title: "عيد ميلاد سوسو", date: dayOffset(2, 18), type: "birthday", recurring: true, note: "ابنتي الصغيرة — 7 سنوات", createdAt: dayOffset(-30), updatedAt: dayOffset(-30) },
    { id: demoId("oc2"), title: "ذكرى زواجنا", date: dayOffset(15, 0), type: "anniversary", recurring: true, note: "10 سنوات", createdAt: dayOffset(-30), updatedAt: dayOffset(-30) },
    { id: demoId("oc3"), title: "عيد الفطر", date: dayOffset(30, 0), type: "holiday", recurring: true, note: null, createdAt: dayOffset(-30), updatedAt: dayOffset(-30) },
    { id: demoId("oc4"), title: "ذكرى تأسيس الشركة", date: dayOffset(-20, 0), type: "other", recurring: true, note: "5 سنوات", createdAt: dayOffset(-30), updatedAt: dayOffset(-30) },
  ],

  // ---------------- Saved Locations (4) ----------------
  savedLocations: [
    { id: demoId("l1"), name: "المنزل", address: "حي المزة، دمشق", lat: 33.5125, lng: 36.2819, icon: "Home", color: "emerald", createdAt: dayOffset(-30), updatedAt: dayOffset(-30) },
    { id: demoId("l2"), name: "المكتب — السجل التجاري", address: "وسط المدينة", lat: 33.5138, lng: 36.2789, icon: "Briefcase", color: "blue", createdAt: dayOffset(-30), updatedAt: dayOffset(-30) },
    { id: demoId("l3"), name: "عيادة د. أحمد", address: "شارع الثورة", lat: 33.5150, lng: 36.2800, icon: "HeartPulse", color: "rose", createdAt: dayOffset(-15), updatedAt: dayOffset(-15) },
    { id: demoId("l4"), name: "السوق المركزي", address: "سوق الحمدية", lat: 33.5115, lng: 36.3060, icon: "ShoppingBag", color: "amber", createdAt: dayOffset(-10), updatedAt: dayOffset(-10) },
  ],

  // ---------------- Pantry / Home (6) ----------------
  pantryItems: [
    { id: demoId("pa1"), name: "أرز", quantity: 5, unit: "kg", lowStock: 2, category: "grains", createdAt: dayOffset(-10), updatedAt: dayOffset(-2) },
    { id: demoId("pa2"), name: "زيت زيتون", quantity: 1, unit: "l", lowStock: 1, category: "other", createdAt: dayOffset(-10), updatedAt: dayOffset(-1) },
    { id: demoId("pa3"), name: "سكر", quantity: 1, unit: "kg", lowStock: 1, category: "grains", createdAt: dayOffset(-10), updatedAt: dayOffset(-3) },
    { id: demoId("pa4"), name: "شاي", quantity: 2, unit: "pack", lowStock: 1, category: "beverages", createdAt: dayOffset(-10), updatedAt: dayOffset(-5) },
    { id: demoId("pa5"), name: "حليب", quantity: 0, unit: "l", lowStock: 2, category: "dairy", createdAt: dayOffset(-10), updatedAt: dayOffset(0) },
    { id: demoId("pa6"), name: "منظف أرضيات", quantity: 1, unit: "l", lowStock: 1, category: "cleaning", createdAt: dayOffset(-10), updatedAt: dayOffset(-7) },
  ],

  // ---------------- Waiting List (3) ----------------
  waitingItems: [
    { id: demoId("w1"), title: "شراء كمبيوتر محمول جديد", description: "للعمل من المنزل — ميزانية 500$", priority: 2, ready: false, createdAt: dayOffset(-5), updatedAt: dayOffset(-5) },
    { id: demoId("w2"), title: "تسجيل في دورة تسويق رقمي", description: "كورس أونلاين — 4 أسابيع", priority: 1, ready: true, createdAt: dayOffset(-10), updatedAt: dayOffset(-3) },
    { id: demoId("w3"), title: "ترميم غرفة الجلوس", description: "صيانة بسيطة + طلاء", priority: 0, ready: false, createdAt: dayOffset(-15), updatedAt: dayOffset(-15) },
  ],

  // ---------------- Contact Reminders (2) ----------------
  contactReminders: [
    { id: demoId("cr1"), contactId: demoId("c1"), contactName: "أحمد الخطيب", frequency: "weekly", lastContacted: dayOffset(-8), nextReminder: dayOffset(-1), active: true, createdAt: dayOffset(-30), updatedAt: dayOffset(-8) },
    { id: demoId("cr2"), contactId: demoId("c5"), contactName: "فاطمة الخطيب", frequency: "daily", lastContacted: dayOffset(-2), nextReminder: dayOffset(0), active: true, createdAt: dayOffset(-60), updatedAt: dayOffset(-2) },
  ],

  // ---------------- Scheduled Messages (2) ----------------
  scheduledMessages: [
    { id: demoId("sm1"), recipient: "+963 944 555 111", message: "كل عام وأنت بخير! عيد ميلاد سعيد 🎉", channel: "whatsapp", scheduledAt: dayOffset(2, 9), sent: false, sentAt: null, deletedAt: null, createdAt: dayOffset(-1), updatedAt: dayOffset(-1) },
    { id: demoId("sm2"), recipient: "+963 991 888 777", message: "تذكير: موعد تسليم الطلبية يوم الخميس", channel: "sms", scheduledAt: dayOffset(1, 8), sent: false, sentAt: null, deletedAt: null, createdAt: dayOffset(-1), updatedAt: dayOffset(-1) },
  ],

  // ---------------- Automation Rules (2) ----------------
  automationRules: [
    { id: demoId("au1"), name: "تذكير قبل الموعد بساعة", trigger: "event_due_soon", action: "send_notification", config: '{"minutesBefore": 60}', active: true, createdAt: dayOffset(-15), updatedAt: dayOffset(-15) },
    { id: demoId("au2"), name: "تنبيه انخفاض المخزون", trigger: "pantry_low_stock", action: "create_task", config: '{"threshold": "lowStock"}', active: true, createdAt: dayOffset(-10), updatedAt: dayOffset(-10) },
  ],

  // ---------------- Smart Notifications (4) ----------------
  // NOTE: stored in activityLogs-style or a dedicated collection — the local
  // interceptor's smartNotifsRoute generates these dynamically from other data
  // (overdue tasks, upcoming events, low pantry), so we don't seed them here.
  // The notifications will appear automatically because the demo data has
  // overdue tasks, upcoming events, and low-stock pantry items.

  // ---------------- Suggestions (3) ----------------
  suggestions: [
    { id: demoId("s1"), title: "نظّم يومك بالبومودورو", content: "اقسم عملك لفترات 25 دقيقة تركيز + 5 دقائق راحة. هذا يحسّن الإنتاجية بنسبة 40%.", category: "productivity", status: "pending", createdAt: dayOffset(-2), updatedAt: dayOffset(-2) },
    { id: demoId("s2"), title: "خصّص ميزانية للادخار", content: "حاول ادخار 10% من دخلك الشهري. ابدأ بصندوق طوارئ يغطي 3 أشهر من المصاريف.", category: "finance", status: "pending", createdAt: dayOffset(-3), updatedAt: dayOffset(-3) },
    { id: demoId("s3"), title: "واصل علاقاتك", content: "اتصل بأحمد هذا الأسبوع — لم تتواصل معه منذ 8 أيام.", category: "social", status: "pending", createdAt: dayOffset(-1), updatedAt: dayOffset(-1) },
  ],

  // ---------------- Activity Logs (4) ----------------
  activityLogs: [
    { id: demoId("al1"), action: "create", entity: "contact", message: "أضيف جهة اتصال: شركة المستقبل التجارية", createdAt: dayOffset(-3, 10, 0) },
    { id: demoId("al2"), action: "create", entity: "task", message: "أضيف مهمة: مراجعة تقرير المبيعات الشهري", createdAt: dayOffset(-2, 9, 0) },
    { id: demoId("al3"), action: "complete", entity: "task", message: "أُنجزت مهمة: إرسال عرض السعر للعميل الجديد", createdAt: dayOffset(-1, 16, 0) },
    { id: demoId("al4"), action: "create", entity: "expense", message: "أُضيف مصروف: وجبة غداء مع العميل (25000 ل.س)", createdAt: dayOffset(0, 15, 0) },
  ],

  // ---------------- Happiness Logs (3) ----------------
  happinessLogs: [
    { id: demoId("hp1"), date: dayOffset(-1), score: 8, factors: '{"family": true, "work": true, "health": true, "finance": false}', note: "يوم جميل — إنجاز في العمل + وقت مع العائلة", createdAt: dayOffset(-1), updatedAt: dayOffset(-1) },
    { id: demoId("hp2"), date: dayOffset(-3), score: 6, factors: '{"family": true, "work": false, "health": true, "finance": true}', note: "ضغط في العمل لكن العائلة ساندت", createdAt: dayOffset(-3), updatedAt: dayOffset(-3) },
    { id: demoId("hp3"), date: dayOffset(-7), score: 9, factors: '{"family": true, "work": true, "health": true, "finance": true}', note: "نهاية أسبوع رائعة", createdAt: dayOffset(-7), updatedAt: dayOffset(-7) },
  ],

  // ---------------- Quran Logs (3) ----------------
  quranLogs: [
    { id: demoId("q1"), surah: 2, fromAyah: 1, toAyah: 10, juz: 1, note: "سورة البقرة — المضار", date: dayOffset(-1, 5), createdAt: dayOffset(-1) },
    { id: demoId("q2"), surah: 67, fromAyah: 1, toAyah: 14, juz: 29, note: "سورة الملك — الحفظ", date: dayOffset(-3, 5), createdAt: dayOffset(-3) },
    { id: demoId("q3"), surah: 1, fromAyah: 1, toAyah: 7, juz: 1, note: "الفاتحة — المراجعة", date: dayOffset(-5, 5), createdAt: dayOffset(-5) },
  ],

  // ---------------- Medications (2) ----------------
  medications: [
    { id: demoId("med1"), name: "دواء الضغط", dosage: "10mg", frequency: "daily", startDate: dayOffset(-90), endDate: null, notes: "صباحاً قبل الفطور", active: true, deletedAt: null, createdAt: dayOffset(-90), updatedAt: dayOffset(-7) },
    { id: demoId("med2"), name: "فيتامين د", dosage: "1000 IU", frequency: "daily", startDate: dayOffset(-30), endDate: dayOffset(60), notes: "مع وجبة دسمة", active: true, deletedAt: null, createdAt: dayOffset(-30), updatedAt: dayOffset(-30) },
  ],

  // ---------------- Sleep Logs (3) ----------------
  sleepLogs: [
    { id: demoId("sl1"), date: dayOffset(-1, 0), bedtime: dayOffset(-1, 23), wakeTime: dayOffset(0, 6, 30), duration: 450, quality: "good", note: "نوم مريح", createdAt: dayOffset(0) },
    { id: demoId("sl2"), date: dayOffset(-2, 0), bedtime: dayOffset(-2, 0, 30), wakeTime: dayOffset(-1, 7), duration: 390, quality: "fair", note: "استيقظت منتصف الليل", createdAt: dayOffset(-1) },
    { id: demoId("sl3"), date: dayOffset(-3, 0), bedtime: dayOffset(-3, 22, 30), wakeTime: dayOffset(-2, 6), duration: 450, quality: "excellent", note: "أفضل نوم هذا الأسبوع", createdAt: dayOffset(-2) },
  ],

  // ---------------- Integrations (7 — already in seed-data.ts) ----------------
  // Integrations are seeded by the existing SEED_DATA in seed-data.ts.
  // We don't duplicate them here — they show as "disconnected" which is correct.

  // ---------------- App Settings ----------------
  appSettings: [
    { id: demoId("as-username"), key: "username", value: "" },
    { id: demoId("as-theme"), key: "theme", value: "dark" },
    { id: demoId("as-city"), key: "city", value: "حلب" },
    { id: demoId("as-lat"), key: "lat", value: "36.2021" },
    { id: demoId("as-lng"), key: "lng", value: "37.1343" },
    { id: demoId("as-tz"), key: "timezone", value: "Asia/Damascus" },
    { id: demoId("as-exrate"), key: "exchangeRate", value: "12500" },
    { id: demoId("as-ai"), key: "aiApiKey", value: "2c7a65f8bee345fb80eee4575deb5bbf.3WE0RlXGJ2CZicJT" },
    { id: demoId("as-aimodel"), key: "aiModel", value: "glm-4.5-flash" },
    { id: demoId("as-aiurl"), key: "aiBaseUrl", value: "https://api.z.ai/api/paas/v4" },
  ],
};

// Flag to mark localStorage as containing demo data.
export const DEMO_FLAG_KEY = "has-demo-data";
