"use client";

import * as React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Settings2,
  Brain,
  Coffee,
  Moon,
  Flame,
  X,
  Volume2,
} from "lucide-react";
import { toast } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "focus" | "short" | "long";

interface ModeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  minutes: number;
  color: string;
  ringColor: string;
}

const DEFAULT_DURATIONS: Record<Mode, number> = {
  focus: 25,
  short: 5,
  long: 15,
};

const STORAGE_KEY = "pomodoro:durations";
const SESSIONS_KEY = "pomodoro:sessions";

function loadDurations(): Record<Mode, number> {
  if (typeof window === "undefined") return { ...DEFAULT_DURATIONS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DURATIONS };
    const parsed = JSON.parse(raw);
    return {
      focus: Math.max(1, Number(parsed.focus) || DEFAULT_DURATIONS.focus),
      short: Math.max(1, Number(parsed.short) || DEFAULT_DURATIONS.short),
      long: Math.max(1, Number(parsed.long) || DEFAULT_DURATIONS.long),
    };
  } catch {
    return { ...DEFAULT_DURATIONS };
  }
}

function loadSessionsToday(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed.date !== new Date().toDateString()) return 0;
    return Number(parsed.count) || 0;
  } catch {
    return 0;
  }
}

function saveSessionsToday(count: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SESSIONS_KEY,
    JSON.stringify({ date: new Date().toDateString(), count })
  );
}

export function PomodoroWidget() {
  const [durations, setDurations] = React.useState<Record<Mode, number>>(
    DEFAULT_DURATIONS
  );
  const [mode, setMode] = React.useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = React.useState<number>(
    DEFAULT_DURATIONS.focus * 60
  );
  const [running, setRunning] = React.useState(false);
  const [sessions, setSessions] = React.useState<number>(0);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<Mode, string>>({
    focus: String(DEFAULT_DURATIONS.focus),
    short: String(DEFAULT_DURATIONS.short),
    long: String(DEFAULT_DURATIONS.long),
  });

  // Hydrate from localStorage after mount
  React.useEffect(() => {
    const d = loadDurations();
    setDurations(d);
    setSecondsLeft(d.focus * 60);
    setSessions(loadSessionsToday());
  }, []);

  const totalSeconds = durations[mode] * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;

  // Timer tick
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Handle completion
  React.useEffect(() => {
    if (secondsLeft !== 0 || !running) return;
    setRunning(false);
    playBeep();
    if (mode === "focus") {
      const newCount = sessions + 1;
      setSessions(newCount);
      saveSessionsToday(newCount);
      toast.success("🎉 بومودورو مكتمل! حان وقت استراحة قصيرة");
      // Auto-switch: every 4th focus → long break, else short break
      const nextMode: Mode = newCount % 4 === 0 ? "long" : "short";
      setMode(nextMode);
      setSecondsLeft(durations[nextMode] * 60);
    } else {
      toast.info("☕ انتهت الاستراحة — عاود التركيز");
      setMode("focus");
      setSecondsLeft(durations.focus * 60);
    }
  }, [secondsLeft, running, mode, sessions, durations]);

  function selectMode(m: Mode) {
    if (running) {
      toast.warning("أوقف المؤقت أولاً لتبديل الوضع");
      return;
    }
    setMode(m);
    setSecondsLeft(durations[m] * 60);
  }

  function toggleRun() {
    if (secondsLeft === 0) {
      setSecondsLeft(durations[mode] * 60);
    }
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(durations[mode] * 60);
  }

  function openSettings() {
    setDraft({
      focus: String(durations.focus),
      short: String(durations.short),
      long: String(durations.long),
    });
    setSettingsOpen(true);
  }

  function saveSettings() {
    const focus = Math.max(1, Math.min(180, Number(draft.focus) || DEFAULT_DURATIONS.focus));
    const short = Math.max(1, Math.min(60, Number(draft.short) || DEFAULT_DURATIONS.short));
    const long = Math.max(1, Math.min(60, Number(draft.long) || DEFAULT_DURATIONS.long));
    const next = { focus, short, long };
    setDurations(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    if (!running) {
      setSecondsLeft(next[mode] * 60);
    }
    setSettingsOpen(false);
    toast.success("تم تحديث المدد");
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const modeConfig: Record<Mode, ModeConfig> = {
    focus: {
      label: "تركيز",
      icon: Brain,
      minutes: durations.focus,
      color: "text-emerald-glow",
      ringColor: "#10b981",
    },
    short: {
      label: "استراحة قصيرة",
      icon: Coffee,
      minutes: durations.short,
      color: "text-amber-glow",
      ringColor: "#f59e0b",
    },
    long: {
      label: "استراحة طويلة",
      icon: Moon,
      minutes: durations.long,
      color: "text-violet-400",
      ringColor: "#8b5cf6",
    },
  };

  const current = modeConfig[mode];
  const Icon = current.icon;

  // SVG ring math
  const size = 240;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Flame className="size-6 text-emerald-glow" />
            مؤقّت بومودورو
          </h2>
          <p className="text-sm text-muted-foreground">
            ركّز لمدة {durations.focus} دقيقة ثم خذ استراحة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-glow/10 text-emerald-glow border-emerald-glow/30"
          >
            <Flame className="size-3" />
            {sessions} جلسة اليوم
          </Badge>
          <Button variant="outline" size="sm" onClick={openSettings}>
            <Settings2 className="size-4" />
            <span className="hidden sm:inline">الإعدادات</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto custom-scroll">
        {/* Mode tabs */}
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-1">
          {(Object.keys(modeConfig) as Mode[]).map((m) => {
            const cfg = modeConfig[m];
            const MIcon = cfg.icon;
            const active = m === mode;
            return (
              <button
                key={m}
                onClick={() => selectMode(m)}
                className={
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors " +
                  (active
                    ? "bg-background shadow-sm " + cfg.color
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <MIcon className="size-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Circular timer */}
        <Card
          className={
            "relative border-2 bg-gradient-to-br " +
            (mode === "focus"
              ? "border-emerald-glow/30 from-emerald-glow/5 to-transparent"
              : mode === "short"
              ? "border-amber-glow/30 from-amber-glow/5 to-transparent"
              : "border-violet-400/30 from-violet-400/5 to-transparent")
          }
        >
          <CardContent className="p-6">
            <div className="relative" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="oklch(1 0 0 / 8%)"
                  strokeWidth={stroke}
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={current.ringColor}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={offset}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <div className={"flex items-center gap-1.5 text-xs " + current.color}>
                  <Icon className="size-4" />
                  <span className="font-medium">{current.label}</span>
                </div>
                <div className="font-mono text-6xl font-bold tabular-nums tracking-tight" dir="ltr">
                  {mm}:{ss}
                </div>
                <div className="text-xs text-muted-foreground">
                  {running ? "قيد التشغيل" : secondsLeft === totalSeconds ? "جاهز للبدء" : "متوقّف"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            onClick={toggleRun}
            className={
              "min-w-[140px] gap-2 " +
              (mode === "focus"
                ? "bg-emerald-glow text-background hover:bg-emerald-glow/90"
                : mode === "short"
                ? "bg-amber-glow text-background hover:bg-amber-glow/90"
                : "bg-violet-500 text-background hover:bg-violet-600")
            }
          >
            {running ? (
              <>
                <Pause className="size-5" />
                إيقاف مؤقت
              </>
            ) : (
              <>
                <Play className="size-5" />
                {secondsLeft === totalSeconds ? "ابدأ" : "متابعة"}
              </>
            )}
          </Button>
          <Button size="lg" variant="outline" onClick={reset}>
            <RotateCcw className="size-5" />
            إعادة
          </Button>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Volume2 className="size-3.5" />
          سيُسمع تنبيه صوتي عند انتهاء الوقت
        </p>
      </div>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعدادات المدد</DialogTitle>
            <DialogDescription>
              عدّل مدة كل وضع بالدقائق (1-180 للتركيز، 1-60 للاستراحات)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <DurationField
              id="dur-focus"
              label="تركيز (دقائق)"
              icon={Brain}
              value={draft.focus}
              onChange={(v) => setDraft((d) => ({ ...d, focus: v }))}
            />
            <DurationField
              id="dur-short"
              label="استراحة قصيرة (دقائق)"
              icon={Coffee}
              value={draft.short}
              onChange={(v) => setDraft((d) => ({ ...d, short: v }))}
            />
            <DurationField
              id="dur-long"
              label="استراحة طويلة (دقائق)"
              icon={Moon}
              value={draft.long}
              onChange={(v) => setDraft((d) => ({ ...d, long: v }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={saveSettings}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DurationField({
  id,
  label,
  icon: Icon,
  value,
  onChange,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" />
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={180}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// Web Audio beep — 3 short tones
function playBeep() {
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const tones = [880, 1108, 880];
    let t = ctx.currentTime;
    tones.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
      t += 0.32;
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // ignore audio errors
  }
}
