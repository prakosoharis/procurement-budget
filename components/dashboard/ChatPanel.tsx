"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Loader2, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { invokeFunction } from "@/lib/functionsClient";
import { BENCHMARKS, INDUSTRY_LIST, buildBenchmarkDelta, type IndustryKey } from "@/lib/benchmarks";

type ChatItem = { role: "user" | "assistant"; text: string };

type Ctx = {
  totals?: { capex?: { actual: number; budget: number }; opex?: { actual: number; budget: number } };
  unit?: string;
  period?: string;
};

export function ChatPanel({ context }: { context: Record<string, unknown> }) {
  const ctx = context as Ctx;
  const [industry, setIndustry] = useState<IndustryKey>("multifinance");
  const [items, setItems] = useState<ChatItem[]>([
    { role: "assistant", text: "Hi! Ask me anything — I'll compare your CAPEX/OPEX metrics to the selected industry benchmark using Groq · Llama 3.3 70B." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items, loading]);

  const summary = useMemo(() => {
    const capex = ctx.totals?.capex ?? { actual: 0, budget: 0 };
    const opex = ctx.totals?.opex ?? { actual: 0, budget: 0 };
    return {
      period: ctx.period,
      ...buildBenchmarkDelta({
        capexActual: capex.actual, capexBudget: capex.budget,
        opexActual: opex.actual, opexBudget: opex.budget,
        unit: ctx.unit ?? "bn IDR",
        industry,
      }),
    };
  }, [ctx, industry]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    const nextItems: ChatItem[] = [...items, { role: "user", text }];
    setItems(nextItems);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await invokeFunction<{ content?: string; error?: string }>("chat", {
        body: {
          summary,
          messages: nextItems.map(m => ({ role: m.role, content: m.text })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const content = String(data?.content ?? "").trim();
      setItems(p => [...p, { role: "assistant", text: content || "No response." }]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Copilot error");
    } finally {
      setLoading(false);
    }
  };

  const quick = [
    "Compare my utilization to the benchmark",
    "Is my CAPEX share healthy?",
    "Where should I cut to hit target burn?",
  ];

  return (
    <Card className="glass-card flex flex-col h-[560px] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">AI Copilot · Groq Llama 3.3 70B</h3>
          <p className="text-[10px] text-muted-foreground truncate">
            {BENCHMARKS[industry].label} · util target {(BENCHMARKS[industry].utilizationTarget * 100).toFixed(0)}% · CAPEX {(BENCHMARKS[industry].capexShareOfIt * 100).toFixed(0)}%
          </p>
        </div>
        <Select value={industry} onValueChange={(v) => setIndustry(v as IndustryKey)}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INDUSTRY_LIST.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {items.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "")}>
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            )}>
              {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            </div>
            <div className={cn(
              "rounded-2xl px-3 py-2 text-sm max-w-[85%]",
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap"
                : "bg-secondary/70"
            )}>
              {m.role === "user" ? m.text : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
                  prose-headings:mt-2 prose-headings:mb-1 prose-h1:text-sm prose-h2:text-sm prose-h3:text-sm
                  prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center"><Bot className="h-3 w-3" /></div>
            <div className="rounded-2xl bg-secondary/70 px-3 py-2"><Loader2 className="h-3 w-3 animate-spin" /></div>
          </div>
        )}
      </div>

      <div className="px-3 pt-2 flex gap-1.5 flex-wrap border-t border-border/50">
        {quick.map(q => (
          <Button key={q} onClick={() => send(q)} disabled={loading} size="sm" variant="secondary"
            className="h-7 rounded-full px-2 text-[10px] text-muted-foreground">
            {q}
          </Button>
        ))}
      </div>

      <div className="border-t border-border/50 p-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about budget vs. benchmark…"
          className="bg-secondary/60 border-border h-9"
          disabled={loading}
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()} size="sm" className="h-9 px-3">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );
}
