"use client";

import * as React from "react";
import {
  Send,
  Sparkles,
  User,
  RotateCcw,
  Database,
  Lightbulb,
} from "lucide-react";
import { toast } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  ts: number;
}

const SUGGESTED_PROMPTS = [
  "ما جدولي اليوم؟",
  "اقترح لي طرق لتوفير المال",
  "كيف أنظم وقتي؟",
  "ما المهام المتأخرة؟",
];

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "مرحباً عبد الله 👋 أنا مساعدك الذكي. اسألني عن جدولك أو مهامك أو مصروفاتك، وسأساعدك في تنظيم يومك. يمكنك تفعيل «تضمين بياناتي» لإعطائي سياقاً أفضل.",
  ts: Date.now(),
};

export function AIAssistantWidget() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [includeData, setIncludeData] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new message / typing
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, sending]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      ts: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          context: { includeData },
        }),
      });
      const json = await res.json();
      const reply =
        json.response ||
        json.error ||
        "عذراً، لم أتمكن من توليد رد. حاول مرة أخرى.";
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
        error: !json.success,
        ts: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
      if (!json.success) {
        toast.error("تعذّر الحصول على رد كامل من المساعد");
      }
    } catch (e: any) {
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "حدث خطأ في الاتصال بالخادم. تأكد من الشبكة وأعد المحاولة.",
        error: true,
        ts: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
      toast.error(e.message || "فشل الاتصال");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function retryLast() {
    // Find last user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Remove messages after that user message
    const idx = messages.findIndex((m) => m.id === lastUser.id);
    setMessages((m) => m.slice(0, idx + 1));
    send(lastUser.content);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const lastIsError =
    messages.length > 0 && messages[messages.length - 1].error === true;

  return (
    <div className="flex h-full flex-col gap-1">
      <header className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h2 className="flex items-center gap-1 text-lg font-bold tracking-tight">
            <Sparkles className="size-6 text-emerald-glow" />
            المساعد الذكي
          </h2>
          <p className="text-sm text-muted-foreground">
            اسأل عن جدولك ومهامك ومصروفاتك
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/20 px-2 py-0.5">
          <div className="flex items-center gap-1">
            <Database className="size-4 text-emerald-glow" />
            <Label htmlFor="include-data" className="cursor-pointer text-xs">
              تضمين بياناتي
            </Label>
          </div>
          <Switch
            id="include-data"
            checked={includeData}
            onCheckedChange={setIncludeData}
          />
        </div>
      </header>

      {/* Chat window */}
      <Card className="flex min-h-0 flex-1 flex-col border-border/60">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-1 p-1">
          <ScrollArea className="custom-scroll min-h-0 flex-1">
            <div ref={scrollRef} className="flex flex-col gap-1 p-1">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              {sending && <TypingIndicator />}
              {lastIsError && !sending && (
                <div className="flex justify-center">
                  <Button size="sm" variant="outline" onClick={retryLast}>
                    <RotateCcw className="size-3.5" />
                    إعادة المحاولة
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Suggested prompts */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-glow/30 bg-emerald-glow/5 px-2 py-0.5 text-xs text-emerald-glow transition-colors hover:bg-emerald-glow/10"
                >
                  <Lightbulb className="size-3" />
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-1 pt-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك هنا... (Enter للإرسال، Shift+Enter لسطر جديد)"
              rows={2}
              className="min-h-[44px] resize-none custom-scroll"
              disabled={sending}
            />
            <Button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              size="icon"
              className="size-11 shrink-0 bg-emerald-glow text-background hover:bg-emerald-glow/90"
              aria-label="إرسال"
            >
              <Send className="size-4" />
            </Button>
          </div>
          {sending && (
            <p className="text-center text-[11px] text-muted-foreground">
              قد يستغرق الرد 10-30 ثانية...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={"flex gap-1 " + (isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar
        className={
          "size-6 shrink-0 " +
          (isUser
            ? "bg-muted text-foreground"
            : msg.error
            ? "bg-rose-500/15 text-rose-500"
            : "bg-gradient-to-br from-emerald-glow to-amber-glow text-background")
        }
      >
        <AvatarFallback className="bg-transparent">
          {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={
          "max-w-[80%] rounded-2xl px-2.5 py-0.5 text-sm leading-relaxed " +
          (isUser
            ? "rounded-tr-sm bg-emerald-glow/15 text-foreground"
            : msg.error
            ? "rounded-tl-sm bg-rose-500/10 text-rose-500 border border-rose-500/20"
            : "rounded-tl-sm bg-muted text-foreground")
        }
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1">
      <Avatar className="size-6 shrink-0 bg-gradient-to-br from-emerald-glow to-amber-glow text-background">
        <AvatarFallback className="bg-transparent">
          <Sparkles className="size-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-2 py-3">
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
    </div>
  );
}
