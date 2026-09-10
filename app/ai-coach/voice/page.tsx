"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";
import {
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  safeStartRecognition,
  describeSpeechError,
  transcriptFromEvent,
  type MinimalSpeechRecognition,
} from "@/lib/speechRecognition";

// Dedicated, full-screen Voice Coach — the web counterpart to
// Saveur/src/messages/VoiceCoachView.tsx, reached from app/ai-coach/page.tsx's
// "Voice Coach" header button (mirrors that file's "Speak" pill into
// VoiceCoachView). This is a genuine browser-native approximation, not a
// port — see below for exactly what carries over and what honestly can't.
//
// WHAT CARRIES OVER:
//  - The pulsing gradient orb (blue/light-blue/orange — VoiceCoachView's own
//    comment: "use mixture of default blue, orange and light blue"), with a
//    calmer breathing pulse while listening/idle and a livelier one plus
//    ripple rings while the coach is speaking (same idea as that file's
//    ripple1/ripple2 "sonar ping" effect, just CSS keyframes instead of
//    Reanimated).
//  - Continuous listening with SILENCE-BASED TURN DETECTION: exactly
//    VoiceCoachView's own described model — whenever the recognized
//    transcript changes, a short timer resets; no new speech before it
//    fires is treated as the end of the user's turn, and the accumulated
//    transcript is sent to the coach. See SILENCE_MS below.
//  - The same POST /api/v1/coach/advice contract the inline voice toggle
//    already uses, with mode: "voice" for shorter/speakable replies.
//  - Replies spoken via window.speechSynthesis, same as the inline toggle.
//  - A manual "tap orb to stop/interrupt" control.
//
// WHAT HONESTLY DOESN'T: VoiceCoachView's real barge-in (the coach gets cut
// off mid-sentence the instant the user starts talking OVER it) runs
// through from-scratch native modules — a single AVAudioEngine doing
// simultaneous record+playback with real hardware echo cancellation on iOS
// (ios/caren_family/DuplexVoiceEngine.swift), and AudioRecord + an
// AcousticEchoCanceler feeding a live Deepgram stream on Android
// (DuplexVoiceEngineModule.kt). Both exist specifically because getting
// speech-triggered interruption right requires the mic and the speaker to
// share one real-time audio session with genuine echo cancellation between
// them — there is no Web Audio/Web Speech API equivalent of that. Running
// SpeechRecognition WHILE speechSynthesis is playing in a browser would just
// have the coach reliably hear (and react to) its own voice, exactly the
// "listening to itself and answering itself" failure mode VoiceCoachView's
// own header comment documents from the mobile app's early, pre-duplex
// attempts. So: recognition is deliberately stopped while the coach talks,
// and resumes the moment it finishes OR the user taps the orb to interrupt
// — a real, honest, always-available manual equivalent of barge-in, not an
// attempt to fake the automatic version.
//
// Silence window: VoiceCoachView's own SILENCE_DEBOUNCE_MS is 1000ms,
// tuned against native on-device recognizers with low-latency interim
// results. Browser SpeechRecognition interim results tend to arrive
// choppier (bursty updates rather than a smooth stream), so this uses a
// slightly longer 1300ms to avoid cutting a turn off mid-word — same idea,
// adjusted for a slower signal.
const SILENCE_MS = 1300;

type Phase = "idle" | "listening" | "thinking" | "speaking";

interface HistoryTurn {
  role: "user" | "coach";
  text: string;
}

const GREETING_TEXT =
  "Hi, I'm Saveur, your AI career coach. Tap the orb and talk to me whenever you're ready.";

export default function VoiceCoachPage() {
  const { t } = useTranslation();

  const [phase, setPhase] = useState<Phase>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastCoachLine, setLastCoachLine] = useState(
    t("web:aiCoach.voiceInitialLine", { defaultValue: GREETING_TEXT })
  );
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const sessionActiveRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<HistoryTurn[]>([]);
  // BUG FIX: a persistent "network" error (SpeechRecognition can't reach its
  // underlying speech-to-text cloud service — common cause: a privacy
  // browser like Brave blocking the request, or a firewall) used to show an
  // error message but NOT stop the onend-triggered auto-restart loop below
  // (phaseRef.current was still "listening", so onend called
  // startRecognitionInternal() again), which immediately failed the same way
  // and retried in a tight loop — looked frozen rather than clearly broken.
  // Tracks consecutive immediate "network" failures; reset to 0 on any
  // successful onresult (a real result means the service IS reachable) or a
  // fresh manual start. After a few in a row, stop auto-restarting entirely
  // and show a specific, actionable message instead of retrying forever.
  const networkErrorStreakRef = useRef(0);
  const NETWORK_ERROR_LIMIT = 3;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
      setUnsupported(
        t("web:aiCoach.voiceUnsupported", { defaultValue: "Voice input isn't supported in this browser yet — try Chrome or Edge." })
      );
    }
  }, [t]);

  // Stop everything (mic + any in-flight speech) on navigating away —
  // otherwise the mic would keep listening (and TTS keep talking) on a
  // screen the user already left.
  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      recognitionRef.current?.abort();
      if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startRecognitionInternal = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    // Continuous + interim results — the browser keeps the mic open and
    // keeps delivering updated transcripts as the user speaks, instead of
    // stopping after one utterance (the inline toggle's push-to-talk mode).
    // This is what makes silence-based turn detection possible at all: the
    // effect below needs to see the transcript CHANGE, not just a single
    // final result.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      // A real result means the recognizer actually reached its
      // speech-to-text service — clear any prior network-failure streak.
      networkErrorStreakRef.current = 0;
      setLiveTranscript(transcriptFromEvent(event));
    };
    recognition.onerror = (event) => {
      const code = event?.error;
      // "aborted" is expected whenever WE call stop()/abort() ourselves
      // (finalizing a turn, pausing for the coach to speak, ending the
      // session) — not a real failure. "no-speech" is routine in continuous
      // mode (the recognizer periodically times out with nothing heard);
      // onend follows right after and the restart logic there resumes
      // listening on its own, so nothing needs to happen here for it either.
      if (code === "aborted" || code === "no-speech") return;

      if (code === "network") {
        networkErrorStreakRef.current += 1;
        if (networkErrorStreakRef.current >= NETWORK_ERROR_LIMIT) {
          // Persistent, not a one-off hiccup — auto-restarting would just
          // keep hitting the exact same failure immediately, forever. Stop
          // for real and explain what's actually going on instead of a
          // vague "network error, try again" that just repeats itself.
          sessionActiveRef.current = false;
          clearSilenceTimer();
          setPhase("idle");
          setErrorMsg(
            t("web:aiCoach.voiceErrorNetworkPersistent", {
              defaultValue:
                "Can't reach the speech recognition service after several tries. If you're using a privacy-focused browser (like Brave), try disabling its shields/privacy blocking for this site, or try a different browser such as Chrome or Edge.",
            })
          );
          return;
        }
        // First couple of failures: still say what happened, but let the
        // existing onend -> restart logic below give it another try in case
        // it was transient.
        setErrorMsg(describeSpeechError(code, t));
        return;
      }

      const message = describeSpeechError(code, t);
      if (message) setErrorMsg(message);
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        // Unrecoverable for this session — no point auto-restarting into
        // the same failure on a loop.
        sessionActiveRef.current = false;
        setPhase("idle");
      }
    };
    recognition.onend = () => {
      if (!sessionActiveRef.current) return;
      // Only auto-restart if recognition ended while we still WANT to be
      // listening (a browser-imposed session limit or benign hiccup, not
      // us intentionally stopping it to finalize a turn or let the coach
      // speak — those transitions already set phase to 'thinking'/'speaking'
      // before calling stop(), so this check tells the two apart).
      if (phaseRef.current === "listening") {
        startRecognitionInternal();
      }
    };

    recognitionRef.current = recognition;
    const result = safeStartRecognition(recognition);
    if (result.ok) {
      setPhase("listening");
    } else {
      recognitionRef.current = null;
      setErrorMsg(t("web:aiCoach.voiceErrorGeneric", { defaultValue: "Voice input hit an unexpected error. Try again." }));
      sessionActiveRef.current = false;
      setPhase("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const speakReply = useCallback(
    (text: string) => {
      if (!isSpeechSynthesisSupported()) {
        // No TTS available — show the reply as text and go straight back
        // to listening instead of getting stuck on a 'speaking' phase that
        // will never resolve via an utterance event.
        if (sessionActiveRef.current) startRecognitionInternal();
        else setPhase("idle");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const resume = () => {
        if (sessionActiveRef.current) startRecognitionInternal();
        else setPhase("idle");
      };
      utterance.onend = resume;
      utterance.onerror = resume;
      setPhase("speaking");
      window.speechSynthesis.speak(utterance);
    },
    [startRecognitionInternal]
  );

  const sendTurn = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        if (sessionActiveRef.current) startRecognitionInternal();
        return;
      }
      setErrorMsg(null);
      setHistory((prev) => [...prev, { role: "user", text: trimmed }]);

      try {
        const requestHistory = historyRef.current.slice(-10).map((h) => ({ role: h.role, text: h.text }));
        const data = await apiClient.post<{ reply: string }>("/api/v1/coach/advice", {
          question: trimmed,
          history: requestHistory,
          persist_to_history: true,
          mode: "voice",
        });
        if (!sessionActiveRef.current) return;
        setHistory((prev) => [...prev, { role: "coach", text: data.reply }]);
        setLastCoachLine(data.reply);
        speakReply(data.reply);
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.status === 402 || apiErr.status === 403) {
          setProRequired(true);
          sessionActiveRef.current = false;
          setPhase("idle");
          return;
        }
        const retryLine = t("web:aiCoach.voiceRetryLine", {
          defaultValue: "Sorry, I didn't catch that — could you say it again?",
        });
        setLastCoachLine(retryLine);
        setErrorMsg(apiErr.message || t("web:aiCoach.replyFailedDefault", { defaultValue: "The coach couldn't reply right now. Please try again." }));
        // Speak the local retry line too (it's a static, hardcoded string,
        // not an LLM reply) so a failed /api/v1/coach/advice call — e.g. a
        // Lovable-proxied LLM billing issue — still leaves the coach
        // sounding alive instead of going silently mute. speakReply's own
        // onend/onerror handler already resumes listening (or goes idle)
        // afterward, same as the old startRecognitionInternal()/setPhase
        // calls this replaces.
        if (sessionActiveRef.current) speakReply(retryLine);
        else setPhase("idle");
      }
    },
    [speakReply, startRecognitionInternal, t]
  );

  // Silence-based turn detection — the core of VoiceCoachView's model,
  // reimplemented here: every time the live transcript changes while we're
  // in the 'listening' phase, restart a short timer; if it fires with
  // nothing new having arrived, the user's turn is over.
  useEffect(() => {
    if (phase !== "listening") return;
    clearSilenceTimer();
    if (!liveTranscript.trim()) return;
    silenceTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "listening") return;
      const finalText = liveTranscript;
      setPhase("thinking");
      setLiveTranscript("");
      recognitionRef.current?.stop();
      sendTurn(finalText);
    }, SILENCE_MS);
    return clearSilenceTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTranscript, phase]);

  // Whether the static local greeting has already been spoken this page
  // visit — only ever spoken once, the first time the user starts a
  // session, same as VoiceCoachView's own one-shot intro on mobile.
  const greetedRef = useRef(false);

  const startSession = useCallback(() => {
    setErrorMsg(null);
    setProRequired(false);
    networkErrorStreakRef.current = 0;
    sessionActiveRef.current = true;
    if (!greetedRef.current) {
      greetedRef.current = true;
      // BUG FIX (mobile parity — VoiceCoachView.tsx speaks a hardcoded,
      // purely local intro line via native TTS the moment Voice mode is
      // engaged, entirely independent of any LLM call; see that file's own
      // "coach_voice_intro_line" comment). Web used to only ever speak a
      // reply that came back from POST /api/v1/coach/advice — if that call
      // failed (e.g. a Lovable-proxied LLM billing issue), the coach never
      // said a single word out loud, even though GREETING_TEXT below is
      // already a static string requiring no backend/LLM call at all.
      // Speaking it directly here, before recognition even starts, means
      // the very first thing the user hears never depends on the AI
      // backend succeeding. speakReply's own onend/onerror handler starts
      // recognition once the greeting finishes (mirrors a normal turn).
      const greeting = t("web:aiCoach.voiceInitialLine", { defaultValue: GREETING_TEXT });
      setLastCoachLine(greeting);
      speakReply(greeting);
      return;
    }
    startRecognitionInternal();
  }, [startRecognitionInternal, speakReply, t]);

  const endSession = useCallback(() => {
    sessionActiveRef.current = false;
    clearSilenceTimer();
    recognitionRef.current?.stop();
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    setLiveTranscript("");
    setPhase("idle");
  }, [clearSilenceTimer]);

  // The honest, achievable equivalent of barge-in — see this file's header
  // comment. Only meaningful while the coach is actually speaking.
  const interrupt = useCallback(() => {
    if (phaseRef.current !== "speaking") return;
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    if (sessionActiveRef.current) startRecognitionInternal();
    else setPhase("idle");
  }, [startRecognitionInternal]);

  function onOrbTap() {
    if (unsupported) return;
    if (phase === "idle") {
      startSession();
    } else if (phase === "listening") {
      endSession();
    } else if (phase === "speaking") {
      interrupt();
    }
    // 'thinking': ignore taps — a reply is already in flight.
  }

  const statusLabel =
    phase === "listening"
      ? liveTranscript
        ? t("web:aiCoach.voiceStatusListening", { defaultValue: "Listening…" })
        : t("web:aiCoach.voiceStatusListeningPrompt", { defaultValue: "I'm listening — go ahead" })
      : phase === "thinking"
      ? t("web:aiCoach.voiceStatusThinking", { defaultValue: "Thinking…" })
      : phase === "speaking"
      ? t("web:aiCoach.voiceStatusSpeaking", { defaultValue: "Speaking… tap to interrupt" })
      : t("web:aiCoach.voiceStatusIdle", { defaultValue: "Tap the orb to start talking" });

  const displayLine = phase === "listening" && liveTranscript ? liveTranscript : lastCoachLine;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-xl flex-col gap-6 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/ai-coach"
              className="inline-flex items-center gap-1 text-sm font-medium text-hint hover:text-primary"
            >
              <EvaIcon name="chevron-left-outline" size={16} />
              {t("web:aiCoach.voiceBackToChat", { defaultValue: "Back to chat" })}
            </Link>
          </div>

          {proRequired ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface-2 p-6 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:aiCoach.proRequiredTitle", { defaultValue: "AI Coach requires a paid plan" })}</h2>
              <p className="text-sm text-hint">{t("web:aiCoach.proRequiredSubtitle", { defaultValue: "Upgrade your plan to chat with your AI career coach." })}</p>
            </div>
          ) : unsupported ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface-2 p-6 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
                <EvaIcon name="alert-circle-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:aiCoach.voiceUnsupportedTitle", { defaultValue: "Voice Coach isn't available in this browser" })}</h2>
              <p className="text-sm text-hint">{unsupported}</p>
              <Link href="/ai-coach" className="mt-2 text-sm font-medium text-brand hover:underline">
                {t("web:aiCoach.voiceBackToChat", { defaultValue: "Back to chat" })}
              </Link>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-8">
              <VoiceOrb phase={phase} onTap={onOrbTap} />

              <div className="flex max-w-md flex-col items-center gap-2 text-center">
                <p className="text-sm font-medium text-hint">{statusLabel}</p>
                <p className="text-lg text-primary">{displayLine}</p>
              </div>

              {errorMsg && <p className="max-w-md text-center text-sm text-danger">{errorMsg}</p>}

              {phase === "idle" && history.length === 0 && (
                <p className="max-w-xs text-center text-xs text-hint">
                  {t("web:aiCoach.voiceHint", {
                    defaultValue: "Continuous, hands-free voice mode — tap once to start, tap again to interrupt or stop.",
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

const ORB_SIZE = 176;

/** Pulsing blue/light-blue/orange gradient orb — same visual idea as
 * VoiceCoachView's hand-rolled LinearGradient circle (see that file's own
 * render comment: "use mixture of default blue, orange and light blue to
 * make the linear gradient"), rebuilt in CSS since there's no Reanimated on
 * web. Breathing pulse at rest/listening; a faster pulse plus two
 * outward-fading ripple rings while the coach is speaking, mirroring that
 * file's ripple1/ripple2 "sonar ping" effect for "the AI coach is actively
 * talking." Doesn't need to be pixel-identical to the native version — same
 * colors, same breathing idea, that's the bar for a browser build. */
function VoiceOrb({ phase, onTap }: { phase: Phase; onTap: () => void }) {
  const speaking = phase === "speaking";
  const thinking = phase === "thinking";
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={
        phase === "idle"
          ? "Start voice session"
          : phase === "listening"
          ? "Stop voice session"
          : phase === "speaking"
          ? "Interrupt"
          : "Thinking"
      }
      className="relative flex items-center justify-center focus:outline-none"
      style={{ width: ORB_SIZE * 1.6, height: ORB_SIZE * 1.6 }}
    >
      <style>{`
        @keyframes voiceOrbBreathe {
          0%, 100% { transform: scale(1); opacity: 0.92; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes voiceOrbBreatheFast {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.09); opacity: 1; }
        }
        @keyframes voiceOrbHalo {
          0%, 100% { transform: scale(1.15); opacity: 0.28; }
          50% { transform: scale(1.32); opacity: 0.12; }
        }
        @keyframes voiceOrbRipple {
          0% { transform: scale(1); opacity: 0.55; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* Halo glow */}
      <span
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          width: ORB_SIZE * 1.5,
          height: ORB_SIZE * 1.5,
          background: "radial-gradient(circle, rgba(0,99,248,0.35) 0%, rgba(0,99,248,0.04) 70%)",
          animation: "voiceOrbHalo 3.6s ease-in-out infinite",
        }}
      />

      {/* Ripple rings — only while speaking */}
      {speaking && (
        <>
          <span
            aria-hidden="true"
            className="absolute rounded-full border-2"
            style={{
              width: ORB_SIZE,
              height: ORB_SIZE,
              borderColor: "rgba(0,99,248,0.55)",
              animation: "voiceOrbRipple 1.5s ease-out infinite",
            }}
          />
          <span
            aria-hidden="true"
            className="absolute rounded-full border-2"
            style={{
              width: ORB_SIZE,
              height: ORB_SIZE,
              borderColor: "rgba(251,146,60,0.55)",
              animation: "voiceOrbRipple 1.5s ease-out infinite 0.75s",
            }}
          />
        </>
      )}

      {/* Core orb */}
      <span
        className="relative rounded-full shadow-xl"
        style={{
          width: ORB_SIZE,
          height: ORB_SIZE,
          background: "linear-gradient(135deg, #0063F8 0%, #7EA8E2 55%, #FB923C 100%)",
          animation: `${speaking ? "voiceOrbBreatheFast" : "voiceOrbBreathe"} ${speaking ? "1.1s" : thinking ? "1.4s" : "1.8s"} ease-in-out infinite`,
        }}
      >
        <span className="absolute inset-0 flex items-center justify-center">
          <EvaIcon
            name={phase === "listening" ? "mic-outline" : phase === "speaking" ? "close-circle-outline" : phase === "thinking" ? "activity-outline" : "mic-outline"}
            size={40}
            className="text-white drop-shadow"
          />
        </span>
      </span>
    </button>
  );
}
