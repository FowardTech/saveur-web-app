// Shared Web Speech API glue for both the inline voice toggle
// (app/ai-coach/page.tsx) and the dedicated Voice Coach screen
// (app/ai-coach/voice/page.tsx) — a browser-native approximation of
// mobile's speechService.ts + duplexVoiceService.ts, not a port of either.
// Mobile's real barge-in interruption runs through from-scratch native
// modules (ios/caren_family/DuplexVoiceEngine.swift, android's
// DuplexVoiceEngineModule.kt) with real echo cancellation — there is no
// browser equivalent of that, so this deliberately does not attempt true
// real-time interruption. What browsers DO give us: SpeechRecognition
// (speech-to-text) and window.speechSynthesis (text-to-speech), plus a
// manual "tap to stop" as the honest, achievable equivalent of barge-in.

// Not a full TS lib.dom SpeechRecognition type (browser support/prefixing
// varies) — just enough of the surface both call sites actually touch,
// extended (past the inline page's original minimal version) with
// `continuous`, a real `onerror` event carrying `.error`, and `abort()`,
// which is what surfaced/fixed the stuck-listening bug below.
export interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
  isFinal?: boolean;
}
export interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
export interface SpeechRecognitionErrorEventLike {
  error: string;
}
export interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function getSpeechRecognitionCtor(): (new () => MinimalSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => MinimalSpeechRecognition;
    webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * BUG FIX — this is the real bug behind the inline voice toggle's "isn't
 * even working" report: the old code did `setListening(true)` unconditionally
 * right before calling `recognition.start()`, with no try/catch around
 * start() at all. `start()` throws SYNCHRONOUSLY (not via onerror) in real,
 * reachable cases — e.g. calling it again before the previous instance's
 * `onend`/`onerror` has actually fired (a fast double-click, or a leftover
 * instance from a prior failed attempt), which throws
 * "InvalidStateError: recognition has already started". When that throw
 * happened, `listening` was already `true` and nothing ever reset it —
 * `onend`/`onerror` never fire for an instance that never actually started —
 * so the UI got permanently stuck showing "Listening…" with a dead mic and
 * no recovery short of a page reload. This wraps start() so `listening`
 * only ever flips true on a confirmed-successful start, and returns the
 * thrown error (if any) so the caller can surface a real message instead of
 * silently doing nothing.
 */
export function safeStartRecognition(recognition: MinimalSpeechRecognition): { ok: true } | { ok: false; error: unknown } {
  try {
    recognition.start();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Also part of the same bug fix: the old `onerror = () => setListening(false)`
 * discarded the actual SpeechRecognitionErrorEvent entirely — ANY failure
 * (permission denied, no microphone device, a network hiccup — Chrome's
 * built-in recognizer sends audio to a Google web service under the hood,
 * so "network" is a real, reachable error code here, not a hypothetical
 * one) looked identical to the user: the mic icon just flicks back to idle
 * with zero explanation, indistinguishable from "the developer forgot to
 * implement this." Mapped here so both call sites can show something
 * specific and actionable instead.
 */
export function describeSpeechError(code: string | undefined, t: (key: string, opts?: Record<string, unknown>) => string): string {
  switch (code) {
    case "not-allowed":
    case "permission-denied":
    case "service-not-allowed":
      return t("web:aiCoach.voiceErrorPermission", {
        defaultValue: "Microphone access is blocked for this site — allow it in your browser's site settings and try again.",
      });
    case "audio-capture":
      return t("web:aiCoach.voiceErrorNoMic", { defaultValue: "No microphone was found. Check that one is connected and try again." });
    case "network":
      return t("web:aiCoach.voiceErrorNetwork", { defaultValue: "A network error interrupted voice recognition. Try again." });
    case "no-speech":
      return t("web:aiCoach.voiceErrorNoSpeech", { defaultValue: "Didn't catch that — try speaking again." });
    case "aborted":
      // Expected whenever we call stop()/abort() ourselves — never a real
      // failure worth surfacing.
      return "";
    default:
      return t("web:aiCoach.voiceErrorGeneric", { defaultValue: "Voice input hit an unexpected error. Try again." });
  }
}

/** Builds the full accumulated transcript (all results so far, interim
 * included) out of a SpeechRecognition result event — used by the
 * continuous-listening dedicated Voice Coach screen, which (unlike the
 * inline page's single-shot `interimResults: false` mode) needs the live,
 * still-being-recognized text to drive its silence-based turn detection. */
export function transcriptFromEvent(event: SpeechRecognitionEventLike): string {
  let text = "";
  for (let i = 0; i < event.results.length; i++) {
    const result = event.results[i];
    if (result && result[0]) text += result[0].transcript;
  }
  return text.trim();
}
