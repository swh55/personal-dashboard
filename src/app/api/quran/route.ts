import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// أسماء السور
export const SURAHS = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس"
];

export async function GET() {
  try {
    const logs = await db.quranLog.findMany({ orderBy: { date: "desc" } });
    const totalAyahs = logs.reduce((s, l) => s + (l.toAyah - l.fromAyah + 1), 0);
    const surahsRead = new Set(logs.map(l => l.surah)).size;
    return NextResponse.json({ success: true, data: logs, stats: { totalAyahs, surahsRead, sessions: logs.length, surahNames: SURAHS } });
  } catch (error) {
    console.error("GET quran error:", error);
    return NextResponse.json({ success: false, error: "فشل جلب السجل" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { surah, fromAyah, toAyah, juz, note } = await req.json();
    if (!surah || !fromAyah || !toAyah) return NextResponse.json({ success: false, error: "السورة والآيات مطلوبة" }, { status: 400 });
    const log = await db.quranLog.create({ data: { surah: Number(surah), fromAyah: Number(fromAyah), toAyah: Number(toAyah), juz: juz ? Number(juz) : null, note } });
    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (error) {
    console.error("POST quran error:", error);
    return NextResponse.json({ success: false, error: "فشل الإضافة" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "المعرف مطلوب" }, { status: 400 });
    await db.quranLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE quran error:", error);
    return NextResponse.json({ success: false, error: "فشل الحذف" }, { status: 500 });
  }
}
