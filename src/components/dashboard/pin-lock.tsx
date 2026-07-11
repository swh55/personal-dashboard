"use client";

import * as React from "react";
import { Lock, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinLockScreenProps {
  pinCode: string;
  onUnlock: () => void;
}

type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "del";

const KEYPAD: Key[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "del",
  "0",
];

const SHAKE_KEYFRAMES = `
@keyframes pin-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-10px); }
  40% { transform: translateX(10px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}
.pin-shake { animation: pin-shake 0.45s ease-in-out; }
`;

export function PinLockScreen({ pinCode, onUnlock }: PinLockScreenProps) {
  const [entry, setEntry] = React.useState("");
  const [error, setError] = React.useState(false);
  const [shakeKey, setShakeKey] = React.useState(0);

  // Refs keep the latest values for the stable `press` callback and the
  // global keyboard listener, avoiding stale-closure bugs on rapid input.
  const entryRef = React.useRef("");
  const errorRef = React.useRef(false);
  const pinRef = React.useRef(pinCode);
  const unlockRef = React.useRef(onUnlock);

  React.useEffect(() => {
    pinRef.current = pinCode;
  }, [pinCode]);
  React.useEffect(() => {
    unlockRef.current = onUnlock;
  }, [onUnlock]);

  const press = React.useCallback((k: Key) => {
    if (k === "del") {
      const next = entryRef.current.slice(0, -1);
      entryRef.current = next;
      setEntry(next);
      return;
    }
    if (errorRef.current || entryRef.current.length >= 4) return;

    const next = entryRef.current + k;
    entryRef.current = next;
    setEntry(next);

    if (next.length === 4) {
      window.setTimeout(() => {
        if (next === pinRef.current) {
          unlockRef.current();
        } else {
          errorRef.current = true;
          setError(true);
          setShakeKey((s) => s + 1);
          window.setTimeout(() => {
            errorRef.current = false;
            setError(false);
            entryRef.current = "";
            setEntry("");
          }, 600);
        }
      }, 120);
    }
  }, []);

  // Physical keyboard support (0-9 + Backspace)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        press(e.key as Key);
      } else if (e.key === "Backspace") {
        press("del");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إدخال الرمز السري"
      className="fixed inset-0 flex items-center justify-center bg-background p-4"
    >
      <style dangerouslySetInnerHTML={{ __html: SHAKE_KEYFRAMES }} />

      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        {/* Brand + heading */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-emerald-glow/30 blur-lg" />
            <div className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-glow to-amber-glow text-background">
              <Lock className="size-7" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold">أدخل الرمز السري</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              أدخل رمز PIN المكوّن من 4 أرقام للمتابعة
            </p>
          </div>
        </div>

        {/* PIN dots */}
        <div
          key={shakeKey}
          dir="ltr"
          className={cn(
            "flex items-center gap-4",
            error && "pin-shake",
          )}
        >
          {[0, 1, 2, 3].map((i) => {
            const filled = i < entry.length;
            return (
              <div
                key={i}
                aria-hidden
                className={cn(
                  "size-4 rounded-full border-2 transition-all duration-150",
                  filled
                    ? error
                      ? "border-destructive bg-destructive"
                      : "border-emerald-glow bg-emerald-glow shadow-[0_0_10px_var(--emerald-glow)]"
                    : error
                      ? "border-destructive/60"
                      : "border-muted-foreground/40",
                )}
              />
            );
          })}
        </div>

        {/* Status message */}
        <div className="min-h-5 text-center">
          {error ? (
            <p className="text-sm font-medium text-destructive">
              الرمز غير صحيح، حاول مجدداً
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              {entry.length}/4 أرقام
            </p>
          )}
        </div>

        {/* Keypad */}
        <div dir="ltr" className="grid w-full grid-cols-3 gap-3">
          {KEYPAD.map((k) => {
            if (k === "del") {
              return (
                <button
                  key="del"
                  type="button"
                  onClick={() => press("del")}
                  aria-label="حذف"
                  className="flex h-16 items-center justify-center rounded-2xl bg-accent/40 text-foreground transition-all hover:bg-accent active:scale-95"
                >
                  <Delete className="size-5" />
                </button>
              );
            }
            return (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className="flex h-16 items-center justify-center rounded-2xl bg-card text-xl font-semibold text-foreground transition-all hover:bg-emerald-glow/15 hover:text-emerald-glow active:scale-95"
              >
                {k}
              </button>
            );
          })}
          {/* Empty cell to complete the 4×3 grid */}
          <div aria-hidden className="h-16" />
        </div>
      </div>
    </div>
  );
}
