"use client";

import apiClient, { API_BASE_URL } from "./apiClient";
import { isSpeechSynthesisSupported } from "./speechRecognition";

// Real ElevenLabs voice for the web AI Career Coach — POST /api/v1/tts/speak
// (Saveur-Backend/app/api/tts.py), the exact same endpoint mobile's
// services/speechService.ts already uses instead of raw on-device TTS. This
// mirrors that file's two-tier resilience model: try the real ElevenLabs
// voice first, and on ANY failure — network error, non-2xx response, a
// missing audio_url, or the <audio> element itself erroring or failing to
// start — silently fall back to the browser's built-in window.speechSynthesis
// so the coach is never left mute just because ElevenLabs/the backend had a
// bad moment.
//
// There's no native audio session to juggle on web the way mobile's
// speakRemote()/speakOnDevice() do, but the same monotonic-token pattern as
// that file's `speechToken` is used here: it lets a newer speak() call (or an
// explicit cancel()) invalidate whatever's currently in flight, whether
// that's a /tts/speak request that hasn't resolved yet or audio that's
// already partway through playing.

interface TtsSpeakResponse {
  audio_url: string;
}

// A single shared <audio> element (module-level singleton), same idea as
// window.speechSynthesis itself being a singleton — so cancel() always has
// exactly one thing to reach for, regardless of which page/component called
// speak() last.
let audioEl: HTMLAudioElement | null = null;
function getAudioEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

let token = 0;
function isStale(t: number): boolean {
  return t !== token;
}

// Force-resolves whichever playback promise (ElevenLabs <audio> or the
// speechSynthesis fallback) is currently in flight. Set by whichever path is
// actually playing right now; cleared once it settles on its own. This is
// what lets cancel() (below) deterministically settle speak()'s returned
// promise immediately — audioEl.pause() and window.speechSynthesis.cancel()
// don't reliably fire an event a listener can depend on across browsers (in
// particular, pause() fires no event at all), so callers that chain a
// "resume listening" step off speak()'s promise need this to fire on demand.
let currentSettle: (() => void) | null = null;

// audio_url from the backend is relative ("/api/v1/tts/audio/<id>.mp3") — the
// API's own origin has to be prepended, same normalization as mobile's
// speechService.ts resolveAudioUrl.
function resolveAudioUrl(audioUrl: string): string {
  return /^https?:\/\//i.test(audioUrl) ? audioUrl : `${API_BASE_URL}${audioUrl}`;
}

function playAudioUrl(url: string, myToken: number): Promise<void> {
  const audio = getAudioEl();
  if (!audio) {
    return Promise.reject(new Error("Audio playback isn't available in this environment."));
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (currentSettle === finish) currentSettle = null;
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onEnded = () => finish();
    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Audio playback failed."));
    };

    currentSettle = finish;
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.src = url;
    audio.play().catch((err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error("Audio playback failed to start."));
    });

    if (isStale(myToken)) {
      // Superseded (a cancel() or a newer speak() call) in the brief window
      // between this promise executor starting and now — don't let stale
      // audio keep loading/playing in the background.
      audio.pause();
      finish();
    }
  });
}

async function speakRemote(text: string, language: string | undefined, myToken: number): Promise<void> {
  const data = await apiClient.post<TtsSpeakResponse>(
    "/api/v1/tts/speak",
    language ? { text, language } : { text }
  );
  // Superseded while the request was in flight — never start playing audio
  // for a call nobody's waiting on anymore.
  if (isStale(myToken)) return;
  if (!data?.audio_url) {
    throw new Error("TTS backend did not return an audio_url.");
  }
  const url = resolveAudioUrl(data.audio_url);
  if (isStale(myToken)) return;
  await playAudioUrl(url, myToken);
}

/**
 * On-device fallback — the original (only) implementation this whole module
 * replaces as the primary path. Used whenever speakRemote() fails for any
 * reason.
 */
function speakOnDevice(text: string, myToken: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !isSpeechSynthesisSupported() || isStale(myToken)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (currentSettle === finish) currentSettle = null;
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    currentSettle = finish;
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Speak `text` aloud and resolve once speech finishes — via the real
 * ElevenLabs voice from the backend if at all possible, falling back to
 * window.speechSynthesis on any failure (network error, non-2xx, missing
 * audio_url, or a playback error) so the coach is never left silently mute.
 * Never rejects, so callers can unconditionally chain a "resume listening /
 * go idle" step off it — the direct replacement for the old
 * utterance.onend/utterance.onerror pair.
 *
 * `language` is optional — omit it to let the backend's own
 * resolve_language() fall back to the authenticated user's profile locale.
 */
export async function speak(text: string, options?: { language?: string }): Promise<void> {
  const myToken = ++token;
  try {
    await speakRemote(text, options?.language, myToken);
  } catch {
    if (!isStale(myToken)) {
      await speakOnDevice(text, myToken);
    }
  }
}

/**
 * Stop whatever's currently speaking (ElevenLabs <audio> playback or the
 * speechSynthesis fallback) and invalidate any in-flight /tts/speak request
 * that hasn't started playing yet — the equivalent of
 * window.speechSynthesis.cancel() for this module, and the one to call from
 * interrupt/cleanup/end-session handlers instead of that directly.
 *
 * Also force-resolves speak()'s currently-pending promise right away, rather
 * than leaving a caller waiting on a browser event (audioEl.pause() in
 * particular never fires one) that would otherwise never come.
 */
export function cancel(): void {
  token += 1;
  const settle = currentSettle;
  currentSettle = null;
  if (settle) settle();
  if (audioEl) {
    audioEl.pause();
    try {
      audioEl.currentTime = 0;
    } catch {
      // Some browsers throw setting currentTime with no media loaded yet —
      // harmless, nothing is playing either way.
    }
  }
  if (typeof window !== "undefined" && isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
