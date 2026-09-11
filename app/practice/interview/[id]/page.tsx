"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import type { ApiError } from "@/lib/apiClient";
import * as interviewService from "@/lib/interviewService";
import type { InterviewSessionDetail } from "@/lib/interviewService";
import {
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  safeStartRecognition,
  describeSpeechError,
  transcriptFromEvent,
  type MinimalSpeechRecognition,
} from "@/lib/speechRecognition";
import * as ttsService from "@/lib/ttsService";

// The real live mock-interview session — real-time Q&A with the AI
// interviewer, Voice or Text mode, ending in the same AI-scored feedback
// mobile gets. Replaces the static "This is where the live interview
// session would run... coming to the web app in a future pass" placeholder
// app/practice/mock-interviews/page.tsx used to show right after session
// creation (product report: "Why are you leaving this feature out of the
// web app... all the features in the mobile app must also be in the web
// app too").
//
// Text, Voice, AND Video mode are all fully real here — same backend
// endpoints, same session/feedback pipeline as mobile (see
// lib/interviewService.ts's header comment).
//
// Voice mode reuses the exact same continuous-listening, silence-based
// turn-detection model as app/ai-coach/voice/page.tsx (see that file's own
// header comment for the full honest carries-over/doesn't-carry-over
// breakdown of what a browser can and can't do versus mobile's native
// duplex voice pipeline) — same SpeechRecognition + ElevenLabs TTS
// building blocks, just driving an interview Q&A loop instead of a coach
// chat.
//
// Video mode runs that exact same Q&A loop underneath (real-time speech is
// still the actual interview mechanism — a browser has no equivalent to
// mobile's native audio-session pipeline for anything else) and adds real
// getUserMedia camera capture on top: a live self-view preview, a
// MediaRecorder recording of the whole session uploaded via the existing
// POST .../video endpoint on End, and a periodic webcam snapshot sent to a
// real AI-vision backend call (analyze-camera-frame) whose output is
// relayed into the SAME CameraAnalysisFrame timeline mobile's on-device ML
// Kit face detector writes to — so replay/scoring work identically for a
// web session (product report: "For video mode I think it can be
// accomplishable in web too... make use of AI and some APIs... implement
// it perfectly on web too"). If the browser can't grant camera access, the
// candidate is offered Voice or Text instead rather than being dead-ended.
const SILENCE_MS = 1300;

type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

interface TranscriptTurn {
  role: "interviewer" | "candidate";
  text: string;
}

function fallbackLabelFor(type: string) {
  return type
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function LiveInterviewSessionPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;

  const [session, setSession] = useState<InterviewSessionDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [effectiveMode, setEffectiveMode] = useState<"voice" | "text" | "video" | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // Countdown — mirrors mobile's hard time-limit enforcement in
  // LiveInterviewSession.tsx (counts DOWN from the duration picked at
  // setup, auto-ends the session once it hits zero rather than just being
  // a cosmetic display).
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const endsAtRef = useRef<number | null>(null);
  const hasAutoEndedRef = useRef(false);

  // --- Text mode ---
  const [answerText, setAnswerText] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  // --- Voice mode --- (same state machine as app/ai-coach/voice/page.tsx)
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceUnsupported, setVoiceUnsupported] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const voicePhaseRef = useRef<VoicePhase>("idle");
  const sessionActiveRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkErrorStreakRef = useRef(0);
  const NETWORK_ERROR_LIMIT = 3;

  // --- Video mode --- (Voice mode's exact Q&A state machine above, plus
  // real camera capture/recording/frame-analysis on top)
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Deliberately infrequent — each sample is a real, billed AI-vision call
  // (see Saveur-Backend's analyze-camera-frame docstring), unlike mobile's
  // free on-device ML Kit sampling which can run every animation frame.
  const FRAME_ANALYSIS_INTERVAL_MS = 8000;

  useEffect(() => {
    voicePhaseRef.current = voicePhase;
  }, [voicePhase]);

  // --- Load the session (seeds mode/duration/type + whatever question is
  // already pending from setup's create_session call) ---
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await interviewService.getSession(sessionId);
        if (cancelled) return;
        if (detail.status === "completed") {
          router.replace(`/practice/session/${sessionId}`);
          return;
        }
        setSession(detail);
        setTranscript(detail.messages.map((m) => ({ role: m.role, text: m.text })));
        const last = detail.messages[detail.messages.length - 1];
        if (last && last.role === "interviewer") {
          setCurrentQuestion(last.text);
        } else {
          // Reload mid-session after an answer was submitted but before a
          // follow-up was generated (or a session with no messages at all)
          // — ask for one now rather than showing a blank screen.
          try {
            const next = await interviewService.getNextQuestion(sessionId);
            if (cancelled) return;
            setCurrentQuestion(next.text);
            setTranscript((prev) => [...prev, { role: "interviewer", text: next.text }]);
          } catch {
            // leave currentQuestion null — the render below shows a retry state
          }
        }
        const mode = detail.mode === "voice" || detail.mode === "text" || detail.mode === "video" ? detail.mode : "text";
        setEffectiveMode(mode);
        if (detail.durationMin) {
          endsAtRef.current = Date.now() + detail.durationMin * 60 * 1000;
          setRemainingSeconds(detail.durationMin * 60);
        }
      } catch (err) {
        if (cancelled) return;
        const apiErr = err as ApiError;
        setLoadError(
          apiErr.status === 404
            ? t("web:practice.interview.notFound", { defaultValue: "This session isn't available." })
            : apiErr.message || t("web:practice.interview.loadFailedDefault", { defaultValue: "Couldn't load this interview session." })
        );
        setSession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // --- Countdown ticker ---
  useEffect(() => {
    if (!endsAtRef.current) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((endsAtRef.current! - Date.now()) / 1000));
      setRemainingSeconds(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const onEnd = useCallback(async () => {
    if (!sessionId || isEnding) return;
    setIsEnding(true);
    setEndError(null);
    sessionActiveRef.current = false;
    recognitionRef.current?.abort();
    ttsService.cancel();
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    // Stop the recording and upload it BEFORE navigating away, so the
    // replay screen (app/practice/session/[id]/page.tsx) has a real
    // video_url the moment AI feedback finishes generating, same as
    // mobile's own end-of-session flow.
    const recorder = mediaRecorderRef.current;
    let uploadPromise: Promise<void> | null = null;
    if (recorder && recorder.state !== "inactive") {
      uploadPromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      }).then(async () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "video/webm" });
        const durationSec = recordingStartRef.current ? Math.round((Date.now() - recordingStartRef.current) / 1000) : 0;
        if (blob.size > 0) {
          try {
            await interviewService.uploadSessionVideo(sessionId, blob, durationSec);
          } catch {
            // best-effort — losing the recording is much less bad than
            // getting the candidate stuck unable to see their score.
          }
        }
      });
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    try {
      if (uploadPromise) await uploadPromise;
      await interviewService.endSession(sessionId);
      router.push(`/practice/session/${sessionId}`);
    } catch (err) {
      setEndError((err as ApiError).message || t("web:practice.interview.endFailedDefault", { defaultValue: "Couldn't end the session right now. Please try again." }));
      setIsEnding(false);
    }
  }, [sessionId, isEnding, router, t]);

  // Auto-end once the selected duration elapses — the actual enforcement
  // of the countdown, not just a display.
  useEffect(() => {
    if (remainingSeconds === null || hasAutoEndedRef.current || isEnding) return;
    if (remainingSeconds <= 0) {
      hasAutoEndedRef.current = true;
      onEnd();
    }
  }, [remainingSeconds, isEnding, onEnd]);

  // --- Text mode: submit + advance ---
  async function onSubmitTextAnswer() {
    const trimmed = answerText.trim();
    if (!trimmed || !sessionId || submittingAnswer) return;
    setSubmittingAnswer(true);
    setAnswerError(null);
    setTranscript((prev) => [...prev, { role: "candidate", text: trimmed }]);
    setAnswerText("");
    try {
      await interviewService.submitAnswer(sessionId, trimmed);
      const next = await interviewService.getNextQuestion(sessionId);
      setCurrentQuestion(next.text);
      setTranscript((prev) => [...prev, { role: "interviewer", text: next.text }]);
    } catch (err) {
      setAnswerError((err as ApiError).message || t("web:practice.interview.answerFailedDefault", { defaultValue: "Couldn't send your answer right now. Please try again." }));
    } finally {
      setSubmittingAnswer(false);
    }
  }

  // --- Voice mode: continuous listening + silence-based turn detection,
  // same model as app/ai-coach/voice/page.tsx (see that file for the full
  // writeup of why this — not real barge-in — is the honest browser
  // equivalent of mobile's native duplex pipeline). ---
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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      networkErrorStreakRef.current = 0;
      setLiveTranscript(transcriptFromEvent(event));
    };
    recognition.onerror = (event) => {
      const code = event?.error;
      if (code === "aborted" || code === "no-speech") return;
      if (code === "network") {
        networkErrorStreakRef.current += 1;
        if (networkErrorStreakRef.current >= NETWORK_ERROR_LIMIT) {
          sessionActiveRef.current = false;
          clearSilenceTimer();
          setVoicePhase("idle");
          setVoiceError(
            t("web:aiCoach.voiceErrorNetworkPersistent", {
              defaultValue:
                "Can't reach the speech recognition service after several tries. If you're using a privacy-focused browser (like Brave), try disabling its shields/privacy blocking for this site, or try a different browser such as Chrome or Edge.",
            })
          );
          return;
        }
        setVoiceError(describeSpeechError(code, t));
        return;
      }
      const message = describeSpeechError(code, t);
      if (message) setVoiceError(message);
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        sessionActiveRef.current = false;
        setVoicePhase("idle");
      }
    };
    recognition.onend = () => {
      if (!sessionActiveRef.current) return;
      if (voicePhaseRef.current === "listening") startRecognitionInternal();
    };
    recognitionRef.current = recognition;
    const result = safeStartRecognition(recognition);
    if (result.ok) {
      setVoicePhase("listening");
    } else {
      recognitionRef.current = null;
      setVoiceError(t("web:aiCoach.voiceErrorGeneric", { defaultValue: "Voice input hit an unexpected error. Try again." }));
      sessionActiveRef.current = false;
      setVoicePhase("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const speakAndListen = useCallback(
    (text: string) => {
      const resume = () => {
        if (sessionActiveRef.current) startRecognitionInternal();
        else setVoicePhase("idle");
      };
      setVoicePhase("speaking");
      void ttsService.speak(text, { language: i18n.language }).then(resume);
    },
    [startRecognitionInternal, i18n.language]
  );

  const sendVoiceTurn = useCallback(
    async (spokenText: string) => {
      const trimmed = spokenText.trim();
      if (!sessionId) return;
      if (!trimmed) {
        if (sessionActiveRef.current) startRecognitionInternal();
        return;
      }
      setVoiceError(null);
      setTranscript((prev) => [...prev, { role: "candidate", text: trimmed }]);
      try {
        await interviewService.submitAnswer(sessionId, trimmed);
        const next = await interviewService.getNextQuestion(sessionId);
        if (!sessionActiveRef.current) return;
        setCurrentQuestion(next.text);
        setTranscript((prev) => [...prev, { role: "interviewer", text: next.text }]);
        speakAndListen(next.text);
      } catch (err) {
        setVoiceError((err as ApiError).message || t("web:practice.interview.answerFailedDefault", { defaultValue: "Couldn't send your answer right now. Please try again." }));
        if (sessionActiveRef.current) startRecognitionInternal();
      }
    },
    [sessionId, speakAndListen, startRecognitionInternal, t]
  );

  // Silence-based turn detection.
  useEffect(() => {
    if (voicePhase !== "listening") return;
    clearSilenceTimer();
    if (!liveTranscript.trim()) return;
    silenceTimerRef.current = setTimeout(() => {
      if (voicePhaseRef.current !== "listening") return;
      const finalText = liveTranscript;
      setVoicePhase("thinking");
      setLiveTranscript("");
      recognitionRef.current?.stop();
      sendVoiceTurn(finalText);
    }, SILENCE_MS);
    return clearSilenceTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTranscript, voicePhase]);

  function startVoiceSession() {
    if (!currentQuestion) return;
    setVoiceStarted(true);
    setVoiceError(null);
    networkErrorStreakRef.current = 0;
    sessionActiveRef.current = true;
    speakAndListen(currentQuestion);
  }

  function interruptVoice() {
    if (voicePhaseRef.current !== "speaking") return;
    ttsService.cancel();
    if (!sessionActiveRef.current) setVoicePhase("idle");
  }

  // --- Video mode: real getUserMedia camera capture on top of the exact
  // same Voice-mode Q&A loop above. ---
  const setupCamera = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setCameraError(
        t("web:practice.interview.cameraUnsupported", {
          defaultValue: "Camera recording isn't supported in this browser — try Chrome or Edge, or continue in Voice or Text mode.",
        })
      );
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => {});
      }
      return true;
    } catch {
      setCameraError(
        t("web:practice.interview.cameraDenied", {
          defaultValue: "Couldn't access your camera or microphone. Check your browser's permissions for this site and try again, or continue in Voice or Text mode.",
        })
      );
      return false;
    }
  }, [t]);

  const startRecording = useCallback((stream: MediaStream) => {
    recordedChunksRef.current = [];
    const candidateType = "video/webm;codecs=vp8,opus";
    const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidateType) ? candidateType : "video/webm";
    try {
      const recorder = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType) ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
    } catch {
      // Recording isn't available in this browser — the interview still
      // runs fine, it just won't have a replay video afterward.
    }
  }, []);

  // One webcam snapshot -> real AI-vision analysis -> relayed into the same
  // CameraAnalysisFrame timeline mobile's on-device detector writes to.
  // Best-effort throughout: a missed/failed sample must never interrupt the
  // live interview.
  const captureAndAnalyzeFrame = useCallback(() => {
    if (!sessionId) return;
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    void (async () => {
      const analysis = await interviewService.analyzeCameraFrame(sessionId, dataUrl);
      if (analysis && analysis.faceDetected) {
        await interviewService.postCameraFrame(sessionId, analysis);
      }
    })();
  }, [sessionId]);

  async function startVideoSession() {
    if (!currentQuestion || voiceStarted) return;
    setCameraError(null);
    const ok = await setupCamera();
    if (!ok) return;
    if (cameraStreamRef.current) startRecording(cameraStreamRef.current);
    frameIntervalRef.current = setInterval(captureAndAnalyzeFrame, FRAME_ANALYSIS_INTERVAL_MS);
    setVoiceStarted(true);
    setVoiceError(null);
    networkErrorStreakRef.current = 0;
    sessionActiveRef.current = true;
    speakAndListen(currentQuestion);
  }

  // Voice input (SpeechRecognition) backs the Q&A loop in BOTH Voice and
  // Video mode — check support for either as soon as either is selected.
  useEffect(() => {
    if (effectiveMode !== "voice" && effectiveMode !== "video") return;
    if (!isSpeechRecognitionSupported()) {
      setVoiceUnsupported(t("web:aiCoach.voiceUnsupported", { defaultValue: "Voice input isn't supported in this browser yet — try Chrome or Edge." }));
    }
  }, [effectiveMode, t]);

  // Tear down mic/speech/camera on navigating away.
  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      recognitionRef.current?.abort();
      ttsService.cancel();
      clearSilenceTimer();
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // already stopped/unavailable
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sessionTypeLabel(type: string) {
    return t(`web:practice.mockInterviews.types.${type}`, { defaultValue: fallbackLabelFor(type) });
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          {session === undefined && !loadError && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 rounded-card" />
              <Skeleton className="h-40 rounded-card" />
            </div>
          )}

          {(loadError || session === null) && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
                <EvaIcon name="alert-circle-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:practice.interview.notFoundTitle", { defaultValue: "This session isn't available" })}</h1>
              <p className="text-sm text-hint">{loadError}</p>
              <Link href="/practice/mock-interviews" className="mt-2 text-sm font-medium text-brand hover:underline">
                {t("web:practice.interview.backToSetup", { defaultValue: "Back to Mock Interview setup" })}
              </Link>
            </div>
          )}

          {session && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-2 p-5">
                <div>
                  <h1 className="text-lg font-bold text-primary">
                    {sessionTypeLabel(session.type)}
                    {session.role ? ` · ${session.role}` : ""}
                    {session.company ? ` · ${session.company}` : ""}
                  </h1>
                  <p className="mt-0.5 text-sm text-hint">
                    {t(`web:practice.mockInterviews.modes.${session.mode}`, { defaultValue: session.mode })}
                  </p>
                </div>
                {remainingSeconds !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-1 px-3 py-1.5 text-sm font-semibold text-primary">
                    <EvaIcon name="clock-outline" size={14} />
                    {formatClock(remainingSeconds)}
                  </span>
                )}
              </div>

              {effectiveMode !== null && (
                <>
                  {transcript.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                      {transcript.map((m, i) => (
                        <div key={i} className={`flex ${m.role === "candidate" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] whitespace-pre-wrap rounded-card px-3.5 py-2.5 text-sm ${
                              m.role === "candidate" ? "bg-brand text-white" : "border border-border bg-surface-1 text-primary"
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {effectiveMode === "text" && (
                    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                      <textarea
                        rows={4}
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        disabled={submittingAnswer}
                        placeholder={t("web:practice.interview.answerPlaceholder", { defaultValue: "Type your answer…" }).toString()}
                        className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                      />
                      {answerError && <p className="text-sm text-danger">{answerError}</p>}
                      <div className="flex items-center justify-between gap-3">
                        <Button variant="outline" size="sm" onClick={onEnd} disabled={isEnding}>
                          {isEnding
                            ? t("web:practice.interview.ending", { defaultValue: "Ending…" })
                            : t("web:practice.interview.endInterview", { defaultValue: "End interview" })}
                        </Button>
                        <Button size="sm" onClick={onSubmitTextAnswer} disabled={!answerText.trim() || submittingAnswer}>
                          {submittingAnswer
                            ? t("web:practice.interview.submitting", { defaultValue: "Sending…" })
                            : t("web:practice.interview.submitAnswer", { defaultValue: "Submit answer" })}
                        </Button>
                      </div>
                    </div>
                  )}

                  {effectiveMode === "voice" && (
                    <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface-2 p-8">
                      {voiceUnsupported ? (
                        <>
                          <p className="text-center text-sm text-hint">{voiceUnsupported}</p>
                          <Button size="sm" variant="outline" onClick={() => setEffectiveMode("text")}>
                            {t("web:practice.interview.switchToText", { defaultValue: "Switch to Text mode instead" })}
                          </Button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (!voiceStarted) startVoiceSession();
                              else if (voicePhase === "speaking") interruptVoice();
                            }}
                            aria-label={
                              voicePhase === "speaking"
                                ? t("web:aiCoach.stopSpeaking", { defaultValue: "Stop speaking" })
                                : t("web:practice.interview.startInterview", { defaultValue: "Start interview" })
                            }
                            className="relative flex h-32 w-32 items-center justify-center rounded-full shadow-xl transition"
                            style={{ background: "linear-gradient(135deg, #0063F8 0%, #7EA8E2 55%, #FB923C 100%)" }}
                          >
                            <EvaIcon
                              name={voicePhase === "listening" ? "mic-outline" : voicePhase === "speaking" ? "close-circle-outline" : "play-circle-outline"}
                              size={36}
                              className="text-white drop-shadow"
                            />
                          </button>
                          <p className="text-sm font-medium text-hint">
                            {!voiceStarted
                              ? t("web:practice.interview.tapToStart", { defaultValue: "Tap to start the interview" })
                              : voicePhase === "listening"
                              ? liveTranscript || t("web:aiCoach.voiceStatusListeningPrompt", { defaultValue: "I'm listening — go ahead" })
                              : voicePhase === "thinking"
                              ? t("web:aiCoach.voiceStatusThinking", { defaultValue: "Thinking…" })
                              : voicePhase === "speaking"
                              ? t("web:aiCoach.voiceStatusSpeaking", { defaultValue: "Speaking… tap to interrupt" })
                              : ""}
                          </p>
                          {currentQuestion && <p className="max-w-md text-center text-primary">{currentQuestion}</p>}
                          {voiceError && <p className="max-w-md text-center text-sm text-danger">{voiceError}</p>}
                          <Button variant="outline" size="sm" onClick={onEnd} disabled={isEnding}>
                            {isEnding
                              ? t("web:practice.interview.ending", { defaultValue: "Ending…" })
                              : t("web:practice.interview.endInterview", { defaultValue: "End interview" })}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {/* BUG FIX (product report, with a full-screen video-call
                      screenshot for reference: "I want the camera screen to
                      cover the whole screen just like the way it covered
                      the screen in the mobile app... the transcript should
                      appear transparently just like the way it is in the
                      mobile"): this used to be a small boxed camera preview
                      sitting inside the same bordered card as Voice/Text
                      mode. Mirrors mobile's LiveInterviewSession.tsx video-
                      mode redesign instead — a real full-bleed `fixed
                      inset-0` layer (breaks out of AppShell's nav/max-w-3xl
                      container entirely, same as mobile using the device's
                      whole screen with no nav chrome visible), with the
                      question/status/live-transcript rendered in a
                      semi-transparent "glass" card floating OVER the video
                      (bg-black/45 + backdrop-blur) instead of in an opaque
                      white card below it — mobile's own captionGlassCard. */}
                  {effectiveMode === "video" && (
                    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
                      {voiceUnsupported || cameraError ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                          <p className="max-w-sm text-sm text-white/80">{voiceUnsupported || cameraError}</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setCameraError(null);
                                setEffectiveMode("voice");
                              }}
                            >
                              {t("web:practice.interview.continueInVoice", { defaultValue: "Continue in Voice mode" })}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/30 text-white hover:bg-white/10"
                              onClick={() => {
                                setCameraError(null);
                                setEffectiveMode("text");
                              }}
                            >
                              {t("web:practice.interview.continueInText", { defaultValue: "Continue in Text mode" })}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <video
                            ref={cameraVideoRef}
                            muted
                            playsInline
                            autoPlay
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ transform: "scaleX(-1)" }}
                          />

                          {/* Floating glass header — recording indicator +
                              countdown, same idea as mobile's
                              floatingHeaderRow/liveIndicatorRow. */}
                          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
                            <div>
                              {voiceStarted && (
                                <span className="inline-flex items-center gap-1.5 rounded-pill bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                                  <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
                                  {t("web:practice.interview.recording", { defaultValue: "Recording" })}
                                </span>
                              )}
                            </div>
                            {remainingSeconds !== null && (
                              <span className="inline-flex items-center gap-1.5 rounded-pill bg-black/50 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
                                <EvaIcon name="clock-outline" size={14} />
                                {formatClock(remainingSeconds)}
                              </span>
                            )}
                          </div>

                          {/* Floating glass caption card — question + live
                              status + the candidate's own live transcript,
                              all rendered transparently over the camera
                              feed rather than in a solid card beneath it. */}
                          <div className="absolute inset-x-0 bottom-28 flex flex-col items-center gap-2 px-6">
                            <div className="max-w-md rounded-card bg-black/45 px-4 py-3 text-center backdrop-blur">
                              <p className="text-xs font-medium text-white/70">
                                {!voiceStarted
                                  ? t("web:practice.interview.tapToStartVideo", { defaultValue: "Tap to turn on your camera and start the interview" })
                                  : voicePhase === "listening"
                                  ? t("web:aiCoach.voiceStatusListeningPrompt", { defaultValue: "I'm listening — go ahead" })
                                  : voicePhase === "thinking"
                                  ? t("web:aiCoach.voiceStatusThinking", { defaultValue: "Thinking…" })
                                  : voicePhase === "speaking"
                                  ? t("web:aiCoach.voiceStatusSpeaking", { defaultValue: "Speaking… tap to interrupt" })
                                  : ""}
                              </p>
                              {currentQuestion && <p className="mt-1 text-sm text-white">{currentQuestion}</p>}
                              {voicePhase === "listening" && liveTranscript && (
                                <p className="mt-1.5 text-sm italic text-white/85">&ldquo;{liveTranscript}&rdquo;</p>
                              )}
                            </div>
                            {voiceError && <p className="max-w-md text-center text-xs text-tint-orange-text">{voiceError}</p>}
                          </div>

                          {/* Floating bottom controls — orb + End Interview,
                              same pairing as mobile's floatingControlsRow. */}
                          <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-6">
                            <button
                              type="button"
                              onClick={() => {
                                if (!voiceStarted) void startVideoSession();
                                else if (voicePhase === "speaking") interruptVoice();
                              }}
                              aria-label={
                                voicePhase === "speaking"
                                  ? t("web:aiCoach.stopSpeaking", { defaultValue: "Stop speaking" })
                                  : t("web:practice.interview.startInterview", { defaultValue: "Start interview" })
                              }
                              className="relative flex h-16 w-16 items-center justify-center rounded-full shadow-xl ring-2 ring-white/25 transition"
                              style={{ background: "linear-gradient(135deg, #0063F8 0%, #7EA8E2 55%, #FB923C 100%)" }}
                            >
                              <EvaIcon
                                name={voicePhase === "listening" ? "mic-outline" : voicePhase === "speaking" ? "close-circle-outline" : "play-circle-outline"}
                                size={24}
                                className="text-white drop-shadow"
                              />
                            </button>
                            <Button
                              size="sm"
                              onClick={onEnd}
                              disabled={isEnding}
                              className="backdrop-blur"
                              style={{ background: "rgba(220,38,38,0.9)", color: "#fff" }}
                            >
                              {isEnding
                                ? t("web:practice.interview.ending", { defaultValue: "Ending…" })
                                : t("web:practice.interview.endInterview", { defaultValue: "End interview" })}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {endError && <p className="text-sm text-danger">{endError}</p>}
                </>
              )}
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
