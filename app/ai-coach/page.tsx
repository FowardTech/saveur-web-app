"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonBubble } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/coach.py
//   GET    /api/v1/coach/messages -> {messages: CoachMessage[]}
//   POST   /api/v1/coach/advice   -> {reply, suggested_course, suggested_action}
//     body: {question, history: [{role, text}], persist_to_history: true, mode?: "voice"}
//     `mode: "voice"` (added for the voice-input flow below) asks the backend
//     for shorter, more speakable phrasing. It's the exact same endpoint and
//     the exact same persisted thread as text chat — omit `mode` for a
//     normal typed message.
//   DELETE /api/v1/coach/messages -> clears the thread
// Gated behind @require_pro — a 402/403 here means the account needs a paid plan.
//
// Empty-thread / greeting behavior mirrors mobile (Saveur/src/messages/Chat.tsx
// + Saveur/services/coachService.ts): GET /api/v1/coach/messages returns an
// EMPTY array for a user who has never sent a real message — that placeholder
// greeting bubble is synthesized locally on the client and never persisted
// server-side. See COACH_GREETING_TEXT below, which is mobile's own
// `defaultValue` for the i18n key `message:coach_greeting` (hardcoded verbatim
// here; full i18n wiring for this key is a separate pass).
interface CoachMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  suggested_course_topic?: string | null;
  created_at?: string;
}

const COACH_GREETING_TEXT =
  "Hi, I'm Saveur, your AI career coach. Ask me about interview nerves, salary negotiation, your resume, networking, or anything else on your job search — I'll do my best to point you in the right direction.";
const GREETING_MESSAGE: CoachMessage = {
  id: "msg_greeting",
  role: "coach",
  text: COACH_GREETING_TEXT,
};

// Minimal ambient shape for the Web Speech API's SpeechRecognition — not a
// full TS lib.dom type (browser support/prefixing varies, see startListening
// below), just enough of the surface this file actually touches.
interface MinimalSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function AiCoachPage() {
  const { t } = useTranslation();
  const coachGreetingText = t("common:coach.greeting", { defaultValue: COACH_GREETING_TEXT });
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [proRequired, setProRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Voice mode state — a browser-native approximation of mobile's
  // VoiceCoachView.tsx, not a port of it. Mobile's voice pipeline uses
  // native iOS/Android speech recognition plus a cloud Deepgram/ElevenLabs
  // duplex TTS service; there's no web equivalent of that pipeline without a
  // much larger, separate infrastructure investment. What IS available
  // cross-platform in a browser is the Web Speech API
  // (SpeechRecognition/webkitSpeechRecognition for speech-to-text,
  // window.speechSynthesis for text-to-speech), so that's what this uses —
  // a simple push-to-talk mic button, not wake-word/continuous listening.
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceUnsupported, setVoiceUnsupported] = useState<string | null>(null);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await apiClient.get<{ messages: CoachMessage[] }>("/api/v1/coach/messages");
      setMessages(data.messages.length > 0 ? data.messages : [{ ...GREETING_MESSAGE, text: coachGreetingText }]);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:aiCoach.loadFailedDefault", { defaultValue: "Couldn't load your conversation." }));
      }
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    // Intentional fetch-on-mount — load() sets state once its async GET
    // resolves, not synchronously in this effect body, so the cascading-
    // render this rule guards against doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Stop any in-flight speech synthesis if the user navigates away mid-reply.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function speakReply(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  async function sendQuestion(question: string, mode?: "voice") {
    if (!question || sending) return;
    setError(null);

    const optimisticUser: CoachMessage = { id: `local-${Date.now()}`, role: "user", text: question };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
      const body: Record<string, unknown> = { question, history, persist_to_history: true };
      if (mode) body.mode = mode;
      const data = await apiClient.post<{ reply: string; suggested_course: string | null }>("/api/v1/coach/advice", body);
      setMessages((prev) => [
        ...prev,
        { id: `local-reply-${Date.now()}`, role: "coach", text: data.reply, suggested_course_topic: data.suggested_course },
      ]);
      if (mode === "voice") {
        speakReply(data.reply);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:aiCoach.replyFailedDefault", { defaultValue: "The coach couldn't reply right now. Please try again." }));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput("");
    await sendQuestion(question);
  }

  async function handleClear() {
    try {
      await apiClient.delete("/api/v1/coach/messages");
      setMessages([{ ...GREETING_MESSAGE, text: coachGreetingText }]);
    } catch {
      // no-op
    }
  }

  function toggleVoiceInput() {
    // Tapping the mic while a reply is being spoken interrupts it — the
    // "obvious way to stop/mute playback" the UI needs so voice mode never
    // talks over the user with no way in.
    if (speaking) {
      stopSpeaking();
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => MinimalSpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => MinimalSpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceUnsupported(t("web:aiCoach.voiceUnsupported", { defaultValue: "Voice input isn't supported in this browser yet — try Chrome or Edge." }));
      return;
    }

    setVoiceUnsupported(null);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        sendQuestion(transcript, "voice");
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col gap-4 pb-4">
          <div className="flex items-center justify-between">
            <PageHeader
              title={t("web:aiCoach.title", { defaultValue: "AI Coach" })}
              subtitle={t("web:aiCoach.subtitle", { defaultValue: "Ask anything about your job search, interviews, or career." })}
            />
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                {t("web:aiCoach.clearChat", { defaultValue: "Clear chat" })}
              </Button>
            )}
          </div>

          {proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:aiCoach.proRequiredTitle", { defaultValue: "AI Coach requires a paid plan" })}</h2>
              <p className="text-sm text-hint">{t("web:aiCoach.proRequiredSubtitle", { defaultValue: "Upgrade your plan to chat with your AI career coach." })}</p>
            </div>
          )}

          {!proRequired && (
            <>
              <div className="flex-1 overflow-y-auto rounded-card border border-border bg-surface-2 p-4">
                {!loaded ? (
                  // Skeleton chat bubbles shaped like the real thread about
                  // to render below, while GET /api/v1/coach/messages is
                  // still in flight.
                  <div className="flex flex-col gap-3">
                    <SkeletonBubble align="start" width="w-3/4" />
                    <SkeletonBubble align="end" width="w-1/2" />
                    <SkeletonBubble align="start" width="w-2/3" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        {m.role === "coach" && (
                          <Image
                            src="/coach-chat-icon.png"
                            alt=""
                            width={24}
                            height={24}
                            className="mb-1 h-6 w-6 shrink-0 rounded-full"
                          />
                        )}
                        <div className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                          <div
                            className={`max-w-[85%] whitespace-pre-wrap rounded-card px-4 py-2.5 text-sm ${
                              m.role === "user" ? "bg-brand text-white" : "border border-border bg-surface-1 text-primary"
                            }`}
                          >
                            {m.text}
                          </div>
                          {m.suggested_course_topic && (
                            <span className="rounded-pill bg-tint-mint px-3 py-1 text-xs font-medium text-tint-mint-text">
                              {t("web:aiCoach.learnMoreAbout", { defaultValue: "Learn more about {{topic}}", topic: m.suggested_course_topic })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {sending && <div className="text-sm text-hint">{t("web:aiCoach.coachTyping", { defaultValue: "Coach is typing…" })}</div>}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
              {voiceUnsupported && <p className="text-sm text-danger">{voiceUnsupported}</p>}
              {listening && <p className="text-sm text-hint">{t("web:aiCoach.listening", { defaultValue: "Listening…" })}</p>}
              {speaking && <p className="text-sm text-hint">{t("web:aiCoach.speakingHint", { defaultValue: "Speaking… (tap the mic to stop)" })}</p>}

              <form onSubmit={handleSend} className="flex items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("web:aiCoach.inputPlaceholder", { defaultValue: "Ask your AI coach…" })}
                  className="w-full rounded-pill border border-border bg-surface-1 px-4 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-label={
                    speaking
                      ? t("web:aiCoach.stopSpeaking", { defaultValue: "Stop speaking" })
                      : listening
                      ? t("web:aiCoach.stopListening", { defaultValue: "Stop listening" })
                      : t("web:aiCoach.askByVoice", { defaultValue: "Ask by voice" })
                  }
                  title={
                    speaking
                      ? t("web:aiCoach.stopSpeaking", { defaultValue: "Stop speaking" })
                      : listening
                      ? t("web:aiCoach.stopListening", { defaultValue: "Stop listening" })
                      : t("web:aiCoach.askByVoice", { defaultValue: "Ask by voice" })
                  }
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                    listening || speaking
                      ? "border-danger bg-danger/10 text-danger"
                      : "border-border bg-surface-1 text-hint hover:text-primary"
                  }`}
                >
                  <EvaIcon name={speaking ? "close-circle-outline" : "mic-outline"} size={18} className={listening ? "animate-pulse" : ""} />
                </button>
                <Button type="submit" disabled={sending || !input.trim()}>
                  {t("common:actions.send", { defaultValue: "Send" })}
                </Button>
              </form>
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
