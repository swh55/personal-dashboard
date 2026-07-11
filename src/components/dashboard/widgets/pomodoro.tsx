"use client";

import * as React from "react";
import { Play, Pause, RotateCcw, Settings, Coffee, Brain, X } from "lucide-react";
import {
  usePomodoroStore,
  startGlobalPomodoroTicker,
  type PomodoroMode,
} from "@/store/use-pomodoro";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { hapticSuccess, isNative, showToast } from "@/lib/native/bridge";

const MODE_CONFIG: Record<PomodoroMode, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; ringColor: string }> = {
  focus: { label: "تركيز", icon: Brain, color: "text-emerald-glow", ringColor: "var(--emerald-glow)" },
  short: { label: "استراحة قصيرة", icon: Coffee, color: "text-amber-glow", ringColor: "var(--amber-glow)" },
  long: { label: "استراحة طويلة", icon: Coffee, color: "text-blue-500", ringColor: "#3b82f6" },
};

export function PomodoroWidget() {
  const {
    mode, running, remainingMs, sessionsToday,
    focusMin, shortMin, longMin,
    setMode, start, pause, reset, setDurations,
  } = usePomodoroStore();

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [durForm, setDurForm] = React.useState({
    focus: String(focusMin),
    short: String(shortMin),
    long: String(longMin),
  });

  // Start the global ticker on mount — it survives panel switches
  React.useEffect(() => {
    startGlobalPomodoroTicker();
    // Cleanup is NOT called on unmount — the ticker keeps running globally
    // It's only cleaned up if the whole app unmounts (which doesn't happen)
  }, []);

  // Check if timer just expired (trigger haptic + toast)
  const prevRunning = React.useRef(running);
  React.useEffect(() => {
    if (prevRunning.current && !running) {
      // Timer was running and now stopped (expired or paused)
      // If remaining is 0 and mode changed, it expired
      if (remainingMs === 0) {
        if (isNative()) {
          hapticSuccess();
          showToast("انتهى الوقت! خذ استراحة", "long");
        }
      }
    }
    prevRunning.current = running;
  }, [running, remainingMs]);

  const config = MODE_CONFIG[mode];
  const Icon = config.icon;
  const totalMs = (mode === "focus" ? focusMin : mode === "short" ? shortMin : longMin) * 60_000;
  const progress = totalMs > 0 ? 1 - remainingMs / totalMs : 0;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1_000);

  // SVG circular progress
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex h-full flex-col gap-1 p-2">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">بومودورو</h1>
          <p className="text-xs text-muted-foreground">{sessionsToday} جلسة اليوم</p>
        </div>
        <Button variant="ghost" size="sm" className="size-6 p-0" onClick={() => setSettingsOpen(true)}>
          <Settings className="size-4" />
        </Button>
      </div>

      {/* mode tabs */}
      <div className="flex gap-1">
        {(Object.keys(MODE_CONFIG) as PomodoroMode[]).map((m) => {
          const cfg = MODE_CONFIG[m];
          const MIcon = cfg.icon;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-lg py-0.5 text-xs font-medium transition-all",
                mode === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MIcon className="size-3.5" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* timer display */}
      <div className="flex flex-1 items-center justify-center">
        <div className="relative">
          <svg width="200" height="200" className="rotate-[-90deg]">
            <circle
              cx="100" cy="100" r={radius}
              fill="none" stroke="var(--muted)" strokeWidth="6" opacity="0.2"
            />
            <circle
              cx="100" cy="100" r={radius}
              fill="none" stroke={config.ringColor} strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Icon className={cn("size-5", config.color)} />
            <div className="text-xl font-bold tabular-nums">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            <div className="text-xs text-muted-foreground">{config.label}</div>
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-1">
        <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={reset} aria-label="إعادة">
          <RotateCcw className="size-4" />
        </Button>
        {running ? (
          <Button size="sm" className="h-10 gap-1 px-6" onClick={pause}>
            <Pause className="size-4" />
            إيقاف مؤقت
          </Button>
        ) : (
          <Button size="sm" className="h-10 gap-1 px-6" onClick={start}>
            <Play className="size-4" />
            ابدأ
          </Button>
        )}
      </div>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>إعدادات المؤقت</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-sm">تركيز (دقيقة)</Label>
              <Input
                type="number" className="w-20" value={durForm.focus}
                onChange={(e) => setDurForm({ ...durForm, focus: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-1">
              <Label className="text-sm">استراحة قصيرة</Label>
              <Input
                type="number" className="w-20" value={durForm.short}
                onChange={(e) => setDurForm({ ...durForm, short: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-1">
              <Label className="text-sm">استراحة طويلة</Label>
              <Input
                type="number" className="w-20" value={durForm.long}
                onChange={(e) => setDurForm({ ...durForm, long: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>إلغاء</Button>
            <Button onClick={() => {
              setDurations({
                focusMin: Number(durForm.focus) || 25,
                shortMin: Number(durForm.short) || 5,
                longMin: Number(durForm.long) || 15,
              });
              setSettingsOpen(false);
            }}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
