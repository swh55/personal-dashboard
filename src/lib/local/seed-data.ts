// Seed data for the local (offline) mode of the Android app.
// This mirrors the data from prisma/seed.ts so the APK has realistic content
// on first launch. All data is stored in localStorage and mutable.

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
function hoursFromNow(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d.toISOString();
}
function daysAgoISO(days: number): string {
  return daysFromNow(-days);
}

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

export const SEED_DATA = {
  contacts: [
    { id: "c1", name: "الحكومة", phone: "+963 944 111 222", whatsapp: "+963 944 111 222", email: "hukuma@example.com", relation: "family", category: "عائلة", favorite: true, note: "الزوجة", avatar: null, deletedAt: null, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(1) },
    { id: "c2", name: "سوسو", phone: "+963 933 222 333", whatsapp: null, email: null, relation: "family", category: "عائلة", favorite: true, note: "الابنة", avatar: null, deletedAt: null, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(2) },
    { id: "c3", name: "أبو محمد", phone: "+963 955 444 555", whatsapp: null, email: null, relation: "friend", category: "أصدقاء", favorite: true, note: "صديق قديم", avatar: null, deletedAt: null, createdAt: daysAgoISO(25), updatedAt: daysAgoISO(3) },
    { id: "c4", name: "م. خالد العلي", phone: "+963 966 777 888", whatsapp: null, email: "khaled@trade-sy.com", relation: "business", category: "شركاء", favorite: true, note: "شريك تجاري", avatar: null, deletedAt: null, createdAt: daysAgoISO(20), updatedAt: daysAgoISO(5) },
    { id: "c5", name: "المحامي سمير", phone: "+963 988 999 000", whatsapp: null, email: null, relation: "business", category: "محاماة", favorite: false, note: null, avatar: null, deletedAt: null, createdAt: daysAgoISO(15), updatedAt: daysAgoISO(7) },
    { id: "c6", name: "د. يارا", phone: "+963 944 555 666", whatsapp: null, email: null, relation: "other", category: "أطباء", favorite: false, note: "طبيبة العائلة", avatar: null, deletedAt: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "c7", name: "أبو فادي (بقالة)", phone: "+963 933 111 444", whatsapp: null, email: null, relation: "business", category: "موردون", favorite: false, note: null, avatar: null, deletedAt: null, createdAt: daysAgoISO(8), updatedAt: daysAgoISO(8) },
    { id: "c8", name: "محمد الحلبي", phone: "+963 955 222 555", whatsapp: null, email: null, relation: "work", category: "موظفون", favorite: false, note: null, avatar: null, deletedAt: null, createdAt: daysAgoISO(6), updatedAt: daysAgoISO(6) },
    { id: "c9", name: "ليلى أحمد", phone: "+963 988 333 666", whatsapp: null, email: "laila@example.com", relation: "work", category: "موظفون", favorite: false, note: null, avatar: null, deletedAt: null, createdAt: daysAgoISO(5), updatedAt: daysAgoISO(5) },
    { id: "c10", name: "العم خالد", phone: "+963 944 777 000", whatsapp: null, email: null, relation: "family", category: "عائلة", favorite: false, note: null, avatar: null, deletedAt: null, createdAt: daysAgoISO(4), updatedAt: daysAgoISO(4) },
    { id: "c11", name: "أم حسن", phone: "+963 966 111 222", whatsapp: null, email: null, relation: "friend", category: "أصدقاء", favorite: false, note: null, avatar: null, deletedAt: null, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(3) },
    { id: "c12", name: "شركة النور للتجارة", phone: "+963 21 555 1234", whatsapp: null, email: "info@alnoor.com", relation: "business", category: "شركات", favorite: false, note: null, avatar: null, deletedAt: null, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
  ],
  callLogs: [
    { id: "cl1", contactId: "c1", name: "الحكومة", phone: "+963 944 111 222", type: "call", direction: "outgoing", note: "مكالمة مسائية", createdAt: hoursFromNow(-2) },
    { id: "cl2", contactId: "c4", name: "م. خالد العلي", phone: "+963 966 777 888", type: "call", direction: "incoming", note: "بشان صفقة جديدة", createdAt: hoursFromNow(-5) },
    { id: "cl3", contactId: "c2", name: "سوسو", phone: "+963 933 222 333", type: "whatsapp", direction: "outgoing", note: null, createdAt: hoursFromNow(-8) },
    { id: "cl4", contactId: "c3", name: "أبو محمد", phone: "+963 955 444 555", type: "call", direction: "missed", note: null, createdAt: hoursFromNow(-26) },
    { id: "cl5", contactId: "c6", name: "د. يارا", phone: "+963 944 555 666", type: "call", direction: "incoming", note: "موعد فحص دوري", createdAt: hoursFromNow(-50) },
    { id: "cl6", contactId: null, name: "رقم مجهول", phone: "+963 999 888 777", type: "call", direction: "missed", note: null, createdAt: hoursFromNow(-72) },
    { id: "cl7", contactId: "c7", name: "أبو فادي (بقالة)", phone: "+963 933 111 444", type: "call", direction: "outgoing", note: "طلب بضاعة", createdAt: hoursFromNow(-96) },
  ],
  events: [
    { id: "e1", title: "اجتماع في السجل التجاري", description: "مراجعة معاملات", startDate: hoursFromNow(2), endDate: hoursFromNow(3), allDay: false, type: "work", color: "emerald", location: "السجل التجاري - حلب", deletedAt: null, createdAt: daysAgoISO(5), updatedAt: daysAgoISO(5) },
    { id: "e2", title: "الكشف الحسي على المتاجر", description: "جولة تفتيشية شهرية", startDate: hoursFromNow(24), endDate: hoursFromNow(26), allDay: false, type: "work", color: "amber", location: "أسواق حلب", deletedAt: null, createdAt: daysAgoISO(5), updatedAt: daysAgoISO(5) },
    { id: "e3", title: "غداء عائلي", description: "غداء مع الحكمأة وسوسو", startDate: daysFromNow(2), endDate: null, allDay: false, type: "family", color: "rose", location: null, deletedAt: null, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(3) },
    { id: "e4", title: "موعد طبيب", description: "فحص دوري", startDate: daysFromNow(4), endDate: daysFromNow(4), allDay: false, type: "health", color: "blue", location: "عيادة د. يارا", deletedAt: null, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "e5", title: "اجتماع مع شريك", description: "مناقشة صفقة استيراد", startDate: daysFromNow(5), endDate: null, allDay: false, type: "work", color: "emerald", location: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "e6", title: "عيد ميلاد سوسو", description: "احتفال عائلي", startDate: daysFromNow(12), endDate: null, allDay: true, type: "family", color: "violet", location: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "e7", title: "تذكير دفع فاتورة الكهرباء", description: null, startDate: daysFromNow(7), endDate: null, allDay: false, type: "personal", color: "amber", location: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "e8", title: "متابعة مشروع المتجر الجديد", description: null, startDate: daysFromNow(10), endDate: null, allDay: false, type: "work", color: "emerald", location: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
  ],
  tasks: [
    { id: "t1", title: "إعداد تقرير المبيعات الشهري", description: "تقرير شهر كامل", status: "doing", priority: "high", category: "work", dueDate: daysFromNow(2), projectId: null, deletedAt: null, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(1) },
    { id: "t2", title: "متابعة معاملة السجل التجاري", description: null, status: "todo", priority: "high", category: "work", dueDate: daysFromNow(1), projectId: null, deletedAt: null, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "t3", title: "شراء هدية لعيد ميلاد سوسو", description: null, status: "todo", priority: "medium", category: "family", dueDate: daysFromNow(10), projectId: null, deletedAt: null, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "t4", title: "دفع فاتورة الكهرباء", description: null, status: "todo", priority: "medium", category: "finance", dueDate: daysFromNow(3), projectId: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "t5", title: "مراجعة عقد الإيجار الجديد", description: null, status: "todo", priority: "high", category: "finance", dueDate: null, projectId: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "t6", title: "ترتيب مكتب المنزل", description: null, status: "todo", priority: "low", category: "personal", dueDate: null, projectId: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "t7", title: "حجز موعد الطبيب", description: null, status: "done", priority: "medium", category: "health", dueDate: null, projectId: null, deletedAt: null, createdAt: daysAgoISO(5), updatedAt: daysAgoISO(3) },
    { id: "t8", title: "إنهاء صفقة استيراد البضاعة", description: null, status: "doing", priority: "high", category: "work", dueDate: daysFromNow(5), projectId: "p3", deletedAt: null, createdAt: daysAgoISO(4), updatedAt: daysAgoISO(1) },
    { id: "t9", title: "تحديث سجل العملاء", description: null, status: "todo", priority: "low", category: "work", dueDate: null, projectId: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "t10", title: "شراء مستلزمات المطبخ", description: null, status: "todo", priority: "low", category: "personal", dueDate: null, projectId: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "t11", title: "متابعة دفعة التأمين", description: null, status: "done", priority: "medium", category: "finance", dueDate: null, projectId: null, deletedAt: null, createdAt: daysAgoISO(7), updatedAt: daysAgoISO(5) },
    { id: "t12", title: "قراءة كتاب إدارة الوقت", description: null, status: "doing", priority: "low", category: "personal", dueDate: null, projectId: null, deletedAt: null, createdAt: daysAgoISO(6), updatedAt: daysAgoISO(1) },
  ],
  notes: [
    { id: "n1", title: "أفكار تجارية", content: "1. فتح فرع جديد في اللاذقية\n2. توسيع نشاط الاستيراد من تركيا\n3. دراسة سوق المنتجات الإلكترونية", color: "yellow", pinned: true, deletedAt: null, createdAt: daysAgoISO(5), updatedAt: daysAgoISO(1) },
    { id: "n2", title: "قائمة التسوق", content: "- حليب\n- خبز\n- خضار\n- فاكهة\n- منظفات", color: "green", pinned: false, deletedAt: null, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(3) },
    { id: "n3", title: "ملاحظات اجتماع", content: "اجتماع مع شريك حول صفقة استيراد. تم الاتفاق على الأسعار والمواعيد. المتابعة بعد أسبوع.", color: "blue", pinned: false, deletedAt: null, createdAt: daysAgoISO(4), updatedAt: daysAgoISO(4) },
    { id: "n4", title: "تذكيرات مهمة", content: "- تجديد رخصة المحل قبل نهاية الشهر\n- دفع الضريبة\n- مراجعة المحاسب", color: "red", pinned: true, deletedAt: null, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "n5", title: "كتب مقترحة", content: "1. العادات الذرية - جيمس كلير\n2. البداية والنهاية - ريمي حسن\n3. فن اللامبالاة", color: "purple", pinned: false, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "n6", title: "أهداف الشهر", content: "- زيادة المبيعات بنسبة 15%\n- تقليل المصروفات\n- تنظيم الوقت بشكل أفضل", color: "default", pinned: false, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
  ],
  expenses: [
    { id: "x1", amount: 250000, currency: "syp", category: "bills", description: "فاتورة الكهرباء", date: daysAgoISO(1), deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "x2", amount: 50000, currency: "syp", category: "food", description: "تسوق يومي", date: daysAgoISO(2), deletedAt: null, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "x3", amount: 120000, currency: "syp", category: "transport", description: "وقود السيارة", date: daysAgoISO(3), deletedAt: null, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(3) },
    { id: "x4", amount: 30, currency: "usd", category: "health", description: "أدوية", date: daysAgoISO(4), deletedAt: null, createdAt: daysAgoISO(4), updatedAt: daysAgoISO(4) },
    { id: "x5", amount: 80000, currency: "syp", category: "shopping", description: "ملابس لسوسو", date: daysAgoISO(5), deletedAt: null, createdAt: daysAgoISO(5), updatedAt: daysAgoISO(5) },
    { id: "x6", amount: 15000, currency: "syp", category: "food", description: "غداء خارجي", date: daysAgoISO(6), deletedAt: null, createdAt: daysAgoISO(6), updatedAt: daysAgoISO(6) },
    { id: "x7", amount: 200000, currency: "syp", category: "bills", description: "فاتورة الماء", date: daysAgoISO(7), deletedAt: null, createdAt: daysAgoISO(7), updatedAt: daysAgoISO(7) },
    { id: "x8", amount: 50, currency: "usd", category: "charity", description: "صدقة", date: daysAgoISO(8), deletedAt: null, createdAt: daysAgoISO(8), updatedAt: daysAgoISO(8) },
    { id: "x9", amount: 75000, currency: "syp", category: "transport", description: "صيانة سيارة", date: daysAgoISO(10), deletedAt: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "x10", amount: 35000, currency: "syp", category: "food", description: "خضار وفاكهة", date: daysAgoISO(11), deletedAt: null, createdAt: daysAgoISO(11), updatedAt: daysAgoISO(11) },
    { id: "x11", amount: 100000, currency: "syp", category: "general", description: "مصاريف متنوعة", date: daysAgoISO(12), deletedAt: null, createdAt: daysAgoISO(12), updatedAt: daysAgoISO(12) },
    { id: "x12", amount: 40, currency: "usd", category: "education", description: "كتب مدرسية", date: daysAgoISO(14), deletedAt: null, createdAt: daysAgoISO(14), updatedAt: daysAgoISO(14) },
    { id: "x13", amount: 180000, currency: "syp", category: "bills", description: "فاتورة الإنترنت", date: daysAgoISO(15), deletedAt: null, createdAt: daysAgoISO(15), updatedAt: daysAgoISO(15) },
    { id: "x14", amount: 60000, currency: "syp", category: "entertainment", description: "نزهة عائلية", date: daysAgoISO(16), deletedAt: null, createdAt: daysAgoISO(16), updatedAt: daysAgoISO(16) },
  ],
  budgets: [
    { id: "b1", category: "food", limit: 800000, month: currentMonth, year: currentYear, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "b2", category: "bills", limit: 1000000, month: currentMonth, year: currentYear, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "b3", category: "transport", limit: 500000, month: currentMonth, year: currentYear, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "b4", category: "shopping", limit: 400000, month: currentMonth, year: currentYear, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "b5", category: "health", limit: 300000, month: currentMonth, year: currentYear, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "b6", category: "entertainment", limit: 200000, month: currentMonth, year: currentYear, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
  ],
  assets: [
    { id: "a1", name: "نقد في المحفظة", amount: 1500000, currency: "syp", type: "cash", description: null, createdAt: daysAgoISO(20), updatedAt: daysAgoISO(1) },
    { id: "a2", name: "حساب بنكي - بنك سوريا الدولي", amount: 25000000, currency: "syp", type: "bank", description: null, createdAt: daysAgoISO(20), updatedAt: daysAgoISO(1) },
    { id: "a3", name: "ادخار دولار", amount: 5000, currency: "usd", type: "cash", description: null, createdAt: daysAgoISO(20), updatedAt: daysAgoISO(1) },
    { id: "a4", name: "محل تجاري", amount: 75000000, currency: "syp", type: "real-estate", description: null, createdAt: daysAgoISO(20), updatedAt: daysAgoISO(1) },
    { id: "a5", name: "ذهب (مقتنيات)", amount: 100, currency: "usd", type: "gold", description: null, createdAt: daysAgoISO(20), updatedAt: daysAgoISO(1) },
    { id: "a6", name: "سيارة", amount: 15000, currency: "usd", type: "other", description: null, createdAt: daysAgoISO(20), updatedAt: daysAgoISO(1) },
  ],
  accounts: [
    { id: "ac1", name: "الحساب الجاري", balance: 25000000, currency: "syp", type: "bank", institution: "بنك سوريا الدولي", createdAt: daysAgoISO(15), updatedAt: daysAgoISO(1) },
    { id: "ac2", name: "ادخار", balance: 8000000, currency: "syp", type: "savings", institution: "بنك بيمو", createdAt: daysAgoISO(15), updatedAt: daysAgoISO(1) },
    { id: "ac3", name: "نقد منزلي", balance: 500000, currency: "syp", type: "cash", institution: null, createdAt: daysAgoISO(15), updatedAt: daysAgoISO(1) },
    { id: "ac4", name: "حساب دولار", balance: 3000, currency: "usd", type: "bank", institution: "بنك سوريا الدولي", createdAt: daysAgoISO(15), updatedAt: daysAgoISO(1) },
  ],
  debts: [
    { id: "d1", personName: "أبو محمد", amount: 500000, currency: "syp", type: "owed", description: "قرض شخصي", dueDate: daysFromNow(30), settled: false, settledAt: null, deletedAt: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "d2", personName: "م. خالد", amount: 1500, currency: "usd", type: "owed", description: "بضاعة", dueDate: daysFromNow(15), settled: false, settledAt: null, deletedAt: null, createdAt: daysAgoISO(8), updatedAt: daysAgoISO(8) },
    { id: "d3", personName: "المحامي سمير", amount: 200000, currency: "syp", type: "owe", description: "أتعاب محاماة", dueDate: daysFromNow(7), settled: false, settledAt: null, deletedAt: null, createdAt: daysAgoISO(5), updatedAt: daysAgoISO(5) },
    { id: "d4", personName: "شركة النور", amount: 800, currency: "usd", type: "owe", description: "بضاعة مستورة", dueDate: null, settled: false, settledAt: null, deletedAt: null, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(3) },
  ],
  projects: [
    { id: "p1", name: "افتتاح فرع جديد", description: "دراسة فتح فرع في منطقة الأشرفية", status: "active", color: "emerald", progress: 35, startDate: daysAgoISO(30), endDate: null, deletedAt: null, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(1) },
    { id: "p2", name: "تطوير متجر إلكتروني", description: "إنشاء منصة بيع أونلاين", status: "active", color: "blue", progress: 60, startDate: daysAgoISO(20), endDate: null, deletedAt: null, createdAt: daysAgoISO(20), updatedAt: daysAgoISO(1) },
    { id: "p3", name: "صفقة استيراد تركيا", description: "استيراد بضائج إلكترونية من إسطنبول", status: "active", color: "amber", progress: 75, startDate: daysAgoISO(15), endDate: null, deletedAt: null, createdAt: daysAgoISO(15), updatedAt: daysAgoISO(1) },
    { id: "p4", name: "تجديد المحل الرئيسي", description: "صيانة وتجديد ديكور المحل", status: "paused", color: "rose", progress: 20, startDate: null, endDate: null, deletedAt: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(5) },
    { id: "p5", name: "حملة تسويقية", description: "حملة إعلانية على فيسبوك وإنستغرام", status: "completed", color: "violet", progress: 100, startDate: daysAgoISO(60), endDate: daysAgoISO(10), deletedAt: null, createdAt: daysAgoISO(60), updatedAt: daysAgoISO(10) },
  ],
  meetings: [
    { id: "m1", title: "اجتماع أسبوعي مع الموظفين", agenda: "مراجعة الأداء والمهام", notes: null, location: "المكتب", participants: "محمد, ليلى, خالد", startDate: hoursFromNow(4), endDate: hoursFromNow(5), status: "scheduled", deletedAt: null, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "m2", title: "اجتماع مع شريك", agenda: "مناقشة صفقة استيراد", notes: null, location: "مقهى الألمان", participants: "م. خالد العلي", startDate: daysFromNow(2), endDate: null, status: "scheduled", deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "m3", title: "اجتماع مع المحامي", agenda: "مراجعة العقود", notes: null, location: null, participants: "المحامي سمير", startDate: daysFromNow(5), endDate: null, status: "scheduled", deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "m4", title: "اجتماع طارئ", agenda: "مشكلة في الشحنة", notes: "تم حل المشكلة بالكامل", location: "المكتب", participants: null, startDate: daysAgoISO(2), endDate: null, status: "completed", deletedAt: null, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(2) },
  ],
  occasions: [
    { id: "o1", title: "عيد ميلاد سوسو", date: daysFromNow(12), type: "birthday", recurring: true, note: "تكون 8 سنوات", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "o2", title: "عيد ميلاد الحكمأة", date: daysFromNow(40), type: "birthday", recurring: true, note: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "o3", title: "ذكرى الزواج", date: daysFromNow(60), type: "anniversary", recurring: true, note: "10 سنوات زواج", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "o4", title: "عيد الفطر", date: daysAgoISO(2), type: "holiday", recurring: true, note: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "o5", title: "عيد الأضحى", date: daysFromNow(45), type: "holiday", recurring: true, note: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
  ],
  diaryEntries: [
    { id: "dr1", title: "يوم جيد", content: "اليوم كان يوم حافل. أنهيت عدة مهام في العمل وقضيت وقتاً ممتعاً مع العائلة مساءً.", mood: "happy", weather: "مشمس", date: daysAgoISO(1), deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "dr2", title: "يوم متعب", content: "كان اليوم مرهقاً بسبب كثرة الاجتماعات والمعاملات. أحتاج للراحة.", mood: "neutral", weather: "غائم", date: daysAgoISO(2), deletedAt: null, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "dr3", title: "إنجازات", content: "أنهيت صفقة استيراد كبيرة اليوم. أشعر بالرضا عن الإنجاز.", mood: "excited", weather: "مشمس", date: daysAgoISO(4), deletedAt: null, createdAt: daysAgoISO(4), updatedAt: daysAgoISO(4) },
    { id: "dr4", title: "تأملات", content: "أحياناً أفكر في مستقبل العائلة وكيف أوفر لهم حياة أفضل. الحمد لله على نعمه.", mood: "neutral", weather: null, date: daysAgoISO(7), deletedAt: null, createdAt: daysAgoISO(7), updatedAt: daysAgoISO(7) },
  ],
  habits: [
    { id: "h1", name: "قراءة القرآن", description: "قراءة جزء يومياً", frequency: "daily", target: 1, color: "emerald", icon: "BookOpen", active: true, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(1), logs: generateHabitLogs("h1", 5) },
    { id: "h2", name: "الرياضة", description: "30 دقيقة مشي", frequency: "daily", target: 1, color: "blue", icon: "Dumbbell", active: true, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(1), logs: generateHabitLogs("h2", 4) },
    { id: "h3", name: "شرب الماء", description: "8 أكواب يومياً", frequency: "daily", target: 8, color: "blue", icon: "Droplet", active: true, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(1), logs: generateHabitLogs("h3", 6) },
    { id: "h4", name: "الاستيقاظ مبكراً", description: "قبل صلاة الفجر", frequency: "daily", target: 1, color: "amber", icon: "Sunrise", active: true, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(1), logs: generateHabitLogs("h4", 3) },
    { id: "h5", name: "مراجعة المهام", description: "كل يوم مساءً", frequency: "daily", target: 1, color: "violet", icon: "ListChecks", active: true, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(1), logs: generateHabitLogs("h5", 5) },
  ],
  medications: [
    { id: "med1", name: "أدوية الضغط", dosage: "حبة واحدة", frequency: "يومياً صباحاً", startDate: daysAgoISO(30), endDate: null, notes: null, active: true, deletedAt: null, createdAt: daysAgoISO(30), updatedAt: daysAgoISO(1) },
    { id: "med2", name: "فيتامين د", dosage: "حبة", frequency: "أسبوعياً", startDate: daysAgoISO(15), endDate: null, notes: null, active: true, deletedAt: null, createdAt: daysAgoISO(15), updatedAt: daysAgoISO(1) },
    { id: "med3", name: "أدوية الزكام", dosage: "ملعقة", frequency: "3 مرات يومياً", startDate: daysAgoISO(3), endDate: daysFromNow(2), notes: null, active: true, deletedAt: null, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(3) },
  ],
  sleepLogs: generateSleepLogs(),
  pantryItems: [
    { id: "pn1", name: "أرز", quantity: 5, unit: "kg", lowStock: 2, category: "grains", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn2", name: "برغل", quantity: 3, unit: "kg", lowStock: 1, category: "grains", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn3", name: "زيت زيتون", quantity: 2, unit: "l", lowStock: 1, category: "other", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn4", name: "سكر", quantity: 1, unit: "kg", lowStock: 2, category: "other", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn5", name: "شاي", quantity: 2, unit: "pack", lowStock: 1, category: "beverages", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn6", name: "حليب", quantity: 3, unit: "l", lowStock: 2, category: "dairy", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn7", name: "جبن", quantity: 1, unit: "kg", lowStock: 1, category: "dairy", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn8", name: "خبز", quantity: 0, unit: "piece", lowStock: 2, category: "other", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn9", name: "طماطم", quantity: 2, unit: "kg", lowStock: 1, category: "vegetables", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn10", name: "بطاطا", quantity: 5, unit: "kg", lowStock: 2, category: "vegetables", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn11", name: "تفاح", quantity: 3, unit: "kg", lowStock: 1, category: "fruits", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn12", name: "موز", quantity: 1, unit: "kg", lowStock: 1, category: "fruits", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn13", name: "دجاج", quantity: 2, unit: "kg", lowStock: 1, category: "meat", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn14", name: "لحم", quantity: 1, unit: "kg", lowStock: 1, category: "meat", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "pn15", name: "منظفات", quantity: 2, unit: "pack", lowStock: 1, category: "cleaning", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
  ],
  waitingItems: [
    { id: "w1", title: "رد من مورد تركيا", description: "بانتظار تأكيد الطلب", priority: 5, ready: false, createdAt: daysAgoISO(5), updatedAt: daysAgoISO(1) },
    { id: "w2", title: "اعتماد القرض من البنك", description: "بنك سوريا الدولي", priority: 4, ready: false, createdAt: daysAgoISO(4), updatedAt: daysAgoISO(1) },
    { id: "w3", title: "إنجاز معاملة السجل", description: "بانتظار ختم المدير", priority: 3, ready: true, createdAt: daysAgoISO(3), updatedAt: daysAgoISO(1) },
    { id: "w4", title: "صيانة الكمبيوتر", description: "الكمبيوتر المحمول يحتاج صيانة", priority: 2, ready: false, createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "w5", title: "تسليم الطلب القديم", description: "للعميل أبو خالد", priority: 1, ready: true, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
  ],
  savedLocations: [
    { id: "loc1", name: "المنزل", address: "حلب - حي الجميلية", lat: 36.2021, lng: 37.1343, icon: "Home", color: "emerald", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "loc2", name: "السجل التجاري", address: "حلب - وسط المدينة", lat: 36.198, lng: 37.13, icon: "Building2", color: "blue", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "loc3", name: "المحل التجاري", address: "حلب - سوق المدينة", lat: 36.205, lng: 37.14, icon: "Store", color: "amber", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "loc4", name: "عيادة د. يارا", address: "حلب - شارع النيل", lat: 36.21, lng: 37.155, icon: "Stethoscope", color: "rose", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "loc5", name: "مسجد الحمد", address: "حلب - بجانب المنزل", lat: 36.203, lng: 37.135, icon: "Moon", color: "violet", createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
  ],
  contactReminders: [
    { id: "cr1", contactId: "c1", contactName: "الحكومة", frequency: "daily", lastContacted: daysAgoISO(1), nextReminder: daysFromNow(0), active: true, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "cr2", contactId: "c2", contactName: "سوسو", frequency: "weekly", lastContacted: daysAgoISO(8), nextReminder: daysAgoISO(1), active: true, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "cr3", contactId: "c3", contactName: "أبو محمد", frequency: "weekly", lastContacted: daysAgoISO(5), nextReminder: daysFromNow(2), active: true, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "cr4", contactId: "c4", contactName: "م. خالد العلي", frequency: "monthly", lastContacted: daysAgoISO(20), nextReminder: daysFromNow(10), active: true, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "cr5", contactId: "c6", contactName: "د. يارا", frequency: "monthly", lastContacted: daysAgoISO(35), nextReminder: daysAgoISO(5), active: true, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
  ],
  happinessLogs: generateHappinessLogs(),
  quranLogs: [
    { id: "q1", surah: 112, fromAyah: 1, toAyah: 4, juz: null, note: "الإخلاص", date: daysAgoISO(1), createdAt: daysAgoISO(1) },
    { id: "q2", surah: 1, fromAyah: 1, toAyah: 7, juz: 1, note: "الفاتحة", date: daysAgoISO(2), createdAt: daysAgoISO(2) },
    { id: "q3", surah: 2, fromAyah: 1, toAyah: 20, juz: 1, note: "البقرة", date: daysAgoISO(3), createdAt: daysAgoISO(3) },
    { id: "q4", surah: 18, fromAyah: 1, toAyah: 10, juz: 15, note: "الكهف", date: daysAgoISO(4), createdAt: daysAgoISO(4) },
    { id: "q5", surah: 36, fromAyah: 1, toAyah: 12, juz: 22, note: "يس", date: daysAgoISO(5), createdAt: daysAgoISO(5) },
    { id: "q6", surah: 55, fromAyah: 1, toAyah: 13, juz: 27, note: "الرحمن", date: daysAgoISO(6), createdAt: daysAgoISO(6) },
    { id: "q7", surah: 67, fromAyah: 1, toAyah: 5, juz: 29, note: null, date: daysAgoISO(7), createdAt: daysAgoISO(7) },
  ],
  integrations: [
    { id: "i1", service: "google_calendar", name: "تقويم Google", connected: false, config: null, lastSync: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "i2", service: "google_drive", name: "Google Drive", connected: false, config: null, lastSync: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "i3", service: "telegram", name: "تيليغرام", connected: true, config: null, lastSync: daysAgoISO(1), createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "i4", service: "email", name: "البريد الإلكتروني", connected: true, config: null, lastSync: hoursFromNow(-3), createdAt: daysAgoISO(10), updatedAt: hoursFromNow(-3) },
    { id: "i5", service: "github", name: "GitHub", connected: false, config: null, lastSync: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "i6", service: "google_contacts", name: "جهات اتصال Google", connected: false, config: null, lastSync: null, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(10) },
    { id: "i7", service: "cloud_sync", name: "مزامنة سحابية", connected: true, config: null, lastSync: hoursFromNow(-1), createdAt: daysAgoISO(10), updatedAt: hoursFromNow(-1) },
  ],
  scheduledMessages: [
    { id: "sm1", recipient: "+963 944 111 222", message: "تذكير: موعد الطبيب غداً الساعة 10", channel: "whatsapp", scheduledAt: hoursFromNow(12), sent: false, sentAt: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "sm2", recipient: "+963 966 777 888", message: "اجتماع غداً الساعة 4 عصراً", channel: "telegram", scheduledAt: hoursFromNow(20), sent: false, sentAt: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "sm3", recipient: "+963 933 222 333", message: "كل الحب يا سوسو، عيد ميلاد سعيد قريباً", channel: "whatsapp", scheduledAt: daysFromNow(11), sent: false, sentAt: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
    { id: "sm4", recipient: "info@alnoor.com", message: "متابعة بخصوص الطلب الأخير", channel: "email", scheduledAt: daysFromNow(2), sent: false, sentAt: null, deletedAt: null, createdAt: daysAgoISO(1), updatedAt: daysAgoISO(1) },
  ],
  automationRules: [
    { id: "ar1", name: "تذكير قبل المواعيد", trigger: "event_upcoming", action: "notify", config: JSON.stringify({ minutesBefore: 30 }), active: true, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "ar2", name: "نسخ احتياطي أسبوعي", trigger: "weekly", action: "backup", config: JSON.stringify({ day: "friday", hour: 23 }), active: true, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "ar3", name: "تنبيه تجاوز الميزانية", trigger: "budget_exceeded", action: "alert", config: null, active: true, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
    { id: "ar4", name: "تذكير شرب الماء", trigger: "hourly", action: "notify", config: JSON.stringify({ hours: [10, 12, 14, 16, 18] }), active: false, createdAt: daysAgoISO(10), updatedAt: daysAgoISO(1) },
  ],
  suggestions: [
    { id: "s1", title: "تنظيم وقت أفضل", content: "بناءً على تحليل نشاطك، نقترح تخصيص فترة الصباح (8-11) للمهام عالية الأولوية.", category: "productivity", status: "pending", createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "s2", title: "تقليل مصاريف الطعام", content: "مصاريف الطعام لديك مرتفعة هذا الشهر. نقترح التحضير المسبق للوجبات.", category: "finance", status: "pending", createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "s3", title: "ممارسة الرياضة", content: "لم تمارس الرياضة بانتظام. حاول المشي 30 دقيقة يومياً.", category: "health", status: "pending", createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
    { id: "s4", title: "مراجعة الديون", content: "لديك دين يستحق قريباً. تأكد من توفير المبلغ المطلوب.", category: "finance", status: "pending", createdAt: daysAgoISO(2), updatedAt: daysAgoISO(2) },
  ],
  activityLogs: [
    { id: "al1", action: "create", entity: "contact", message: "أضيف جهة اتصال: شركة النور للتجارة", createdAt: hoursFromNow(-2) },
    { id: "al2", action: "update", entity: "task", message: "تم تحديث مهمة: إعداد تقرير المبيعات", createdAt: hoursFromNow(-4) },
    { id: "al3", action: "create", entity: "expense", message: "تم تسجيل مصروف: فاتورة الكهرباء", createdAt: hoursFromNow(-6) },
    { id: "al4", action: "toggle", entity: "integration", message: "ربط تكامل: تيليغرام", createdAt: daysAgoISO(1) },
    { id: "al5", action: "create", entity: "note", message: "أضيف ملاحظة: أفكار تجارية", createdAt: daysAgoISO(1) },
    { id: "al6", action: "delete", entity: "task", message: "حذف مهمة قديمة", createdAt: daysAgoISO(2) },
    { id: "al7", action: "create", entity: "event", message: "أضيف حدث: اجتماع في السجل التجاري", createdAt: daysAgoISO(2) },
    { id: "al8", action: "sync", entity: "sync", message: "مزامنة Google Contacts: استيراد 0، تخطي 0", createdAt: daysAgoISO(3) },
  ],
  appSettings: [
    { id: "as1", key: "username", value: "عبد الله" },
    { id: "as2", key: "theme", value: "dark" },
  ],
};

function generateHabitLogs(habitId: string, count: number) {
  const logs: any[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    logs.push({
      id: `${habitId}-log-${i}`,
      habitId,
      date: d.toISOString(),
      value: 1,
      note: "",
      createdAt: d.toISOString(),
    });
  }
  return logs;
}

function generateSleepLogs() {
  const logs: any[] = [];
  const qualities = ["poor", "fair", "good", "excellent"];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const bedtime = new Date(d);
    bedtime.setHours(23);
    bedtime.setMinutes(Math.floor(Math.random() * 60));
    const wakeTime = new Date(d);
    wakeTime.setDate(wakeTime.getDate() + 1);
    wakeTime.setHours(6 + Math.floor(Math.random() * 2));
    const duration = Math.round((wakeTime.getTime() - bedtime.getTime()) / 60000);
    logs.push({
      id: `sl-${i}`,
      date: d.toISOString(),
      bedtime: bedtime.toISOString(),
      wakeTime: wakeTime.toISOString(),
      duration,
      quality: qualities[Math.floor(Math.random() * qualities.length)],
      note: null,
      createdAt: d.toISOString(),
    });
  }
  return logs;
}

function generateHappinessLogs() {
  const logs: any[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    logs.push({
      id: `hp-${i}`,
      date: d.toISOString(),
      score: Math.floor(Math.random() * 4) + 6,
      factors: JSON.stringify({ work: Math.floor(Math.random() * 3) + 7, family: 9, health: 7 }),
      note: i === 0 ? "يوم جيد بشكل عام" : null,
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
    });
  }
  return logs;
}
