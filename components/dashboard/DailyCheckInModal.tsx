"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import {
  getSpeechRecognitionCtor,
  safeStartRecognition,
  describeSpeechError,
  type MinimalSpeechRecognition,
} from "@/lib/speechRecognition";

export type DailyCheckInMode = "goal" | "reflection";

interface Props {
  open: boolean;
  mode: DailyCheckInMode;
  onSubmit: (text: string) => Promise<void>;
  onDismiss: () => void;
}

// Web port of mobile's components/DailyCheckInSheet.tsx (product report:
// "you did not implement... the regular check up... just the way it is in
// the mobile app"). Same type-or-speak input as mobile, reusing the exact
// one-shot SpeechRecognition pattern app/ai-coach/page.tsx's inline voice
// toggle already established for web (interimResults: false, single
// result per listening session) rather than mobile's native
// speechService.ts pipeline, which has no browser equivalent.
export function DailyCheckInModal({ open, mode, onSubmit, onDismiss }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);

  // Portal target needs `document`, and rendering as a normal descendant
  // of the dashboard page would get boxed into AppShell's .animate-page-in
  // transform wrapper instead of covering the real viewport -- see
  // RatingModal.tsx's identical comment for the full containing-block
  // writeup.
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setText("");
      setVoiceError(null);
      setSubmitting(false);
    } else {
      recognitionRef.current?.stop();
    }
  }, [open]);

  if (!open || !mounted) return null;

  const isGoal = mode === "goal";
  const title = isGoal
    ? t("web:dailyCheckin.goalTitle", { defaultValue: "What's your career goal for today?" })
    : t("web:dailyCheckin.reflectionTitle", { defaultValue: "How did your day go?" });
  const subtitle = isGoal
    ? t("web:dailyCheckin.goalSubtitle", { defaultValue: "One concrete thing you want to get done today — the coach will keep it in mind." })
    : t("web:dailyCheckin.reflectionSubtitle", { defaultValue: "Tell us how today's goal actually went — it helps personalize tomorrow." })
  ;
  const placeholder = isGoal
    ? t("web:dailyCheckin.goalPlaceholder", { defaultValue: "e.g. Apply to 3 roles, or practice for my interview…" })
    : t("web:dailyCheckin.reflectionPlaceholder", { defaultValue: "e.g. Got through 2 applications, ran out of time for the third…" });

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceError(t("web:aiCoach.voiceUnsupported", { defaultValue: "Voice input isn't supported in this browser yet — try Chrome or Edge." }));
      return;
    }
    setVoiceError(null);
    const recognition = new Ctor();
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    const textBefore = text;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setText(textBefore ? `${textBefore} ${transcript}`.trim() : transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      const message = describeSpeechError(event?.error, t);
      if (message) setVoiceError(message);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    const result = safeStartRecognition(recognition);
    if (result.ok) {
      setListening(true);
    } else {
      recognitionRef.current = null;
      setVoiceError(t("web:aiCoach.voiceErrorGeneric", { defaultValue: "Voice input hit an unexpected error. Try again." }));
    }
  }

  async function onPressSubmit() {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-card bg-surface-2 p-6 shadow-2xl">
        <div className="flex justify-end">
          <button type="button" onClick={onDismiss} disabled={submitting} aria-label={t("common:actions.close", { defaultValue: "Close" }).toString()}>
            <EvaIcon name="close-outline" size={20} className="text-hint" />
          </button>
        </div>

        <h2 className="-mt-2 text-center text-lg font-bold text-primary">{title}</h2>
        <p className="mt-2 text-center text-sm text-hint">{subtitle}</p>

        <div className="mt-5 flex items-start gap-2">
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="button"
            onClick={toggleMic}
            aria-label={t("web:aiCoach.askByVoice", { defaultValue: "Ask by voice" }).toString()}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
              listening ? "border-danger bg-danger/10 text-danger" : "border-border bg-surface-1 text-hint hover:text-primary"
            }`}
          >
            <EvaIcon name="mic-outline" size={18} className={listening ? "animate-pulse" : ""} />
          </button>
        </div>
        {listening && <p className="mt-2 text-center text-xs text-danger">{t("web:dailyCheckin.listening", { defaultValue: "Listening… tap the mic again to stop." })}</p>}
        {voiceError && <p className="mt-2 text-center text-xs text-danger">{voiceError}</p>}

        <button
          type="button"
          disabled={!text.trim() || submitting}
          onClick={onPressSubmit}
          className="mt-5 w-full rounded-pill bg-brand py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {submitting ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("common:submit", { defaultValue: "Submit" })}
        </button>
        <button type="button" disabled={submitting} onClick={onDismiss} className="mt-3 w-full text-center text-sm text-hint hover:text-primary">
          {t("web:dailyCheckin.later", { defaultValue: "Maybe later" })}
        </button>
      </div>
    </div>,
    document.body
  );
}

export default DailyCheckInModal;
