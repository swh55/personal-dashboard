import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { USER_PROFILE } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth-helpers";

interface LocSettings {
  city: string;
  lat: number;
  lng: number;
  timezone: string;
}

async function readLocationSettings(userId: string | null): Promise<LocSettings> {
  try {
    const rows = await db.appSetting.findMany({
      where: userId ? { userId, key: { in: ["city", "lat", "lng", "timezone"] } } : { key: { in: [] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      city: map.city || USER_PROFILE.city,
      lat: map.lat !== undefined && map.lat !== "" ? Number(map.lat) : USER_PROFILE.lat,
      lng: map.lng !== undefined && map.lng !== "" ? Number(map.lng) : USER_PROFILE.lng,
      timezone: map.timezone || USER_PROFILE.timezone,
    };
  } catch {
    return {
      city: USER_PROFILE.city,
      lat: USER_PROFILE.lat,
      lng: USER_PROFILE.lng,
      timezone: USER_PROFILE.timezone,
    };
  }
}

export async function GET() {
  const user = await getCurrentUser();
  // Guests fall back to default location (no per-user settings stored)
  const loc = await readLocationSettings(user?.id ?? null);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=${encodeURIComponent(loc.timezone)}&forecast_days=5`;

    const res = await fetch(url, {
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo API error: ${res.status}`);
    }

    const data = await res.json();

    const weatherDescriptions: Record<number, { ar: string; icon: string }> = {
      0: { ar: "سماء صافية", icon: "Sun" },
      1: { ar: "صافي غالباً", icon: "Sun" },
      2: { ar: "غائم جزئياً", icon: "CloudSun" },
      3: { ar: "غائم", icon: "Cloud" },
      45: { ar: "ضباب", icon: "CloudFog" },
      48: { ar: "ضباب متجمد", icon: "CloudFog" },
      51: { ar: "رذاذ خفيف", icon: "CloudDrizzle" },
      53: { ar: "رذاذ متوسط", icon: "CloudDrizzle" },
      55: { ar: "رذاذ كثيف", icon: "CloudDrizzle" },
      61: { ar: "أمطار خفيفة", icon: "CloudRain" },
      63: { ar: "أمطار متوسطة", icon: "CloudRain" },
      65: { ar: "أمطار غزيرة", icon: "CloudRain" },
      71: { ar: "ثلوج خفيفة", icon: "CloudSnow" },
      73: { ar: "ثلوج متوسطة", icon: "CloudSnow" },
      75: { ar: "ثلوج كثيفة", icon: "CloudSnow" },
      80: { ar: "زخات مطر", icon: "CloudRain" },
      81: { ar: "زخات مطر قوية", icon: "CloudRain" },
      82: { ar: "زخات مطر عنيفة", icon: "CloudRainWind" },
      95: { ar: "عاصفة رعدية", icon: "CloudLightning" },
      96: { ar: "عاصفة رعدية مع بَرَد", icon: "CloudLightning" },
      99: { ar: "عاصفة رعدية شديدة", icon: "CloudLightning" },
    };

    const current = data.current;
    const weatherInfo = weatherDescriptions[current.weather_code] || {
      ar: "غير معروف",
      icon: "Cloud",
    };

    const daily = data.daily;
    const forecast = daily.time.map((time: string, i: number) => ({
      date: time,
      maxTemp: Math.round(daily.temperature_2m_max[i]),
      minTemp: Math.round(daily.temperature_2m_min[i]),
      weatherCode: daily.weather_code[i],
      weather: weatherDescriptions[daily.weather_code[i]] || { ar: "—", icon: "Cloud" },
      sunrise: daily.sunrise[i],
      sunset: daily.sunset[i],
    }));

    return NextResponse.json({
      success: true,
      data: {
        current: {
          temperature: Math.round(current.temperature_2m),
          apparentTemperature: Math.round(current.apparent_temperature),
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          windDirection: current.wind_direction_10m,
          pressure: Math.round(current.pressure_msl),
          weatherCode: current.weather_code,
          weatherDescription: weatherInfo.ar,
          weatherIcon: weatherInfo.icon,
        },
        forecast,
        city: loc.city,
        timezone: loc.timezone,
      },
    });
  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json({
      success: false,
      error: "تعذر جلب حالة الطقس",
      data: {
        current: {
          temperature: 22,
          apparentTemperature: 22,
          humidity: 50,
          windSpeed: 10,
          weatherDescription: "غير متاح",
          weatherIcon: "Cloud",
        },
        forecast: [],
        city: loc.city,
      },
    });
  }
}
