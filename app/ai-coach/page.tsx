"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/coach.py
//   GET    /api/v1/coach/messages -> {messages: CoachMessage[]}
//   POST   /api/v1/coach/advice   -> {reply, suggested_course, suggested_action}
//     body: {question, history: [{role, text}], persist_to_history: true}
//   DELETE /api/v1/coach/messages -> clears the thread
// Gated behind @require_pro — a 402/403 here means the account needs a paid plan.
interface CoachMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  suggested_course_topic?: string | null;
  created_at?: string;
}

export default function AiCoachPage() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [proRequired, setProRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await apiClient.get<{ messages: CoachMessage[] }>("/api/v1/coach/messages");
      setMessages(data.messages);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || "Couldn't load your conversation.");
      }
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;
    setInput("");
    setError(null);

    const optimisticUser: CoachMessage = { id: `local-${Date.now()}`, role: "user", text: question };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
      const data = await apiClient.post<{ reply: string; suggested_course: string | null }>("/api/v1/coach/advice", {
        question,
        history,
        persist_to_history: true,
      });
      setMessages((prev) => [
        ...prev,
        { id: `local-reply-${Date.now()}`, role: "coach", text: data.reply, suggested_course_topic: data.suggested_course },
      ]);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || "The coach couldn't reply right now. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    try {
      await apiClient.delete("/api/v1/coach/messages");
      setMessages([]);
    } catch {
      // no-op
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col gap-4 pb-4">
          <div className="flex items-center justify-between">
            <PageHeader title="AI Coach" subtitle="Ask anything about your job search, interviews, or career." />
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear chat
              </Button>
            )}
          </div>

          {proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">AI Coach requires a paid plan</h2>
              <p className="text-sm text-hint">Upgrade your plan to chat with your AI career coach.</p>
            </div>
          )}

          {!proRequired && (
            <>
              <div className="flex-1 overflow-y-auto rounded-card border border-border bg-surface-2 p-4">
                {loaded && messages.length === 0 && (
                  <p className="text-center text-sm text-hint">
                    Ask about interview prep, resume feedback, salary negotiation, or anything else on your mind.
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap rounded-card px-4 py-2.5 text-sm ${
                          m.role === "user" ? "bg-brand text-white" : "border border-border bg-surface-1 text-primary"
                        }`}
                      >
                        {m.text}
                      </div>
                      {m.suggested_course_topic && (
                        <span className="rounded-pill bg-tint-mint px-3 py-1 text-xs font-medium text-tint-mint-text">
                          Learn more about {m.suggested_course_topic}
                        </span>
                      )}
                    </div>
                  ))}
                  {sending && <div className="text-sm text-hint">Coach is typing…</div>}
                  <div ref={bottomRef} />
                </div>
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <form onSubmit={handleSend} className="flex items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your AI coach…"
                  className="w-full rounded-pill border border-border bg-surface-1 px-4 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <Button type="submit" disabled={sending || !input.trim()}>
                  Send
                </Button>
              </form>
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
