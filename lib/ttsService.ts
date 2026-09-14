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
  if (!audioEl) {
    audioEl = new Audio();
    // BUG FIX (product report: "The AI voice is not heard when the video
    // replay is playing, Just the user's voice that is heard" — still
    // reproducing even after buildRecordingStream below was wired up to
    // mix the AI's audio into the recording). Root cause: the TTS audio
    // is served from the BACKEND's origin (API_BASE_URL), a different
    // origin than the web app itself, and a plain <audio> element with no
    // `crossOrigin` set fetches cross-origin media in a mode the browser
    // always treats as "opaque"/tainted for Web Audio API purposes --
    // regardless of whether the server sends CORS headers. A tainted
    // source plays back completely normally through speakers (which is
    // why the candidate always DID hear the AI voice live, masking this)
    // but produces pure SILENCE the moment anything tries to read its
    // actual audio samples via the Web Audio graph -- exactly what
    // buildRecordingStream's createMediaElementSource()->
    // MediaStreamAudioDestinationNode capture does. `crossOrigin =
    // "anonymous"` makes the browser fetch it as a real (uncredentialed)
    // CORS request instead, so the captured samples are no longer
    // silenced -- the backend's GET /api/v1/tts/audio/<id>.mp3 needs no
    // auth and CORS_ORIGINS already covers the web app's own origin
    // (same CORS config every other API call here already relies on), so
    // this needs no server-side change. Must be set before any `src` is
    // ever assigned (see playAudioUrl below), which is why this lives
    // right here at creation time on this shared singleton element.
    audioEl.crossOrigin = "anonymous";
  }
  return audioEl;
}

let token = 0;
function isStale(t: number): boolean {
  return t !== token;
}

// BUG FIX (product report: "the barge to interrupt is not working"). This
// used to only exist INSIDE playAudioUrl/speakOnDevice, each managing its
// own local `currentSettle` — meaning cancel() had nothing to force-resolve
// during the window between speak() being called and audio ACTUALLY
// starting to play (i.e. while the POST /api/v1/tts/speak request for the
// audio_url is still in flight, which can easily take a couple of seconds
// for a real ElevenLabs generation). Tapping "interrupt" during that window
// bumped `token` (correctly making the eventual response stale, so audio
// never started), but nothing settled the caller's pending speak() promise
// right away — the UI stayed stuck showing "speaking" until that in-flight
// network request finally resolved on its own, which looked and felt like
// interrupt "not working" even though it technically caught up eventually.
// Now a single resolver is registered for the ENTIRE top-level speak() call,
// from the moment it starts, so cancel() can force-settle it instantly
// regardless of which internal stage (fetching the URL, or already playing
// it) is currently running.
const pendingResolvers = new Set<() => void>();

// audio_url from the backend is relative ("/api/v1/tts/audio/<id>.mp3") — the
// API's own origin has to be prepended, same normalization as mobile's
// speechService.ts resolveAudioUrl.
function resolveAudioUrl(audioUrl: string): string {
  return /^https?:\/\//i.test(audioUrl) ? audioUrl : `${API_BASE_URL}${audioUrl}`;
}

function playAudioUrl(url: string, myToken: number, onSettle: () => void): Promise<void> {
  const audio = getAudioEl();
  if (!audio) {
    onSettle();
    return Promise.reject(new Error("Audio playback isn't available in this environment."));
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      onSettle();
      resolve();
    };
    const onEnded = () => finish();
    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      onSettle();
      reject(new Error("Audio playback failed."));
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.src = url;
    audio.play().catch((err) => {
      if (settled) return;
      settled = true;
      cleanup();
      onSettle();
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

async function speakRemote(text: string, language: string | undefined, myToken: number, onSettle: () => void): Promise<void> {
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
  await playAudioUrl(url, myToken, onSettle);
}

/**
 * On-device fallback — the original (only) implementation this whole module
 * replaces as the primary path. Used whenever speakRemote() fails for any
 * reason.
 */
function speakOnDevice(text: string, myToken: number, onSettle: () => void): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !isSpeechSynthesisSupported() || isStale(myToken)) {
      onSettle();
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      onSettle();
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
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
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      pendingResolvers.delete(finish);
      resolve();
    };
    // Registered BEFORE the network call even starts (see this module's own
    // comment on pendingResolvers above) — this is the fix that lets
    // cancel() interrupt instantly no matter which stage is in flight.
    pendingResolvers.add(finish);

    (async () => {
      try {
        await speakRemote(text, options?.language, myToken, finish);
        finish();
      } catch {
        if (!isStale(myToken)) {
          await speakOnDevice(text, myToken, finish);
        }
        finish();
      }
    })();
  });
}

/**
 * Stop whatever's currently speaking (ElevenLabs <audio> playback or the
 * speechSynthesis fallback) and force-settle any speak() call currently in
 * flight, immediately — whether it's already playing audio or still
 * fetching the audio_url from the backend. This is the equivalent of
 * window.speechSynthesis.cancel() for this module, and the one to call from
 * interrupt/cleanup/end-session handlers instead of that directly.
 */
export function cancel(): void {
  token += 1;
  const resolvers = Array.from(pendingResolvers);
  pendingResolvers.clear();
  resolvers.forEach((resolve) => resolve());
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

// ---------------------------------------------------------------------------
// BUG FIX (product report: "In the video play recording I only heard the
// users voice but did not hear the AI voice"): speak() above plays the AI's
// ElevenLabs audio straight to the default output device via the shared
// <audio> element — that's real, audible playback for the candidate, but
// it's NOT part of any MediaStream, so a Video-mode MediaRecorder recording
// (which only ever captures the tracks it's explicitly given — the camera +
// mic tracks from getUserMedia) could only ever end up with the
// candidate's own voice on it, never the interviewer's.
//
// buildRecordingStream() routes the SAME shared <audio> element's output
// through a Web Audio graph so it becomes a real, capturable MediaStream
// track, mixed together with the candidate's own mic input into ONE
// combined audio track (MediaRecorder does not reliably mix multiple
// separate audio tracks handed to it across browsers — the mixing has to
// happen in the audio graph itself, before MediaRecorder ever sees it).
// The element is also explicitly reconnected to the AudioContext's own
// destination, since attaching a MediaElementSourceNode to an element
// silences its normal output unless something re-connects it onward.
// ---------------------------------------------------------------------------

let sharedAudioContext: AudioContext | null = null;
let sharedTtsSourceNode: MediaElementAudioSourceNode | null = null;
let sharedMixDestNode: MediaStreamAudioDestinationNode | null = null;

/**
 * Returns a new MediaStream combining `cameraStream`'s video track with ONE
 * mixed audio track containing both the candidate's own mic input AND
 * whatever the AI voice is speaking through ttsService.speak() at the time —
 * for MediaRecorder to record instead of `cameraStream` directly. Falls
 * back to returning `cameraStream` unchanged (AI voice will be missing from
 * the recording, same as before this fix) if the Web Audio API isn't
 * available in this browser at all. Safe to call once per recording
 * session — the underlying AudioContext/source node are created lazily and
 * cached at module scope, since createMediaElementSource can only ever be
 * attached to a given <audio> element once for its whole lifetime.
 */
export function buildRecordingStream(cameraStream: MediaStream): MediaStream {
  const audio = getAudioEl();
  const AudioContextCtor = typeof window !== "undefined" ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
  if (!audio || !AudioContextCtor) return cameraStream;
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContextCtor();
    }
    if (sharedAudioContext.state === "suspended") {
      void sharedAudioContext.resume();
    }
    if (!sharedMixDestNode) {
      sharedMixDestNode = sharedAudioContext.createMediaStreamDestination();
    }
    if (!sharedTtsSourceNode) {
      sharedTtsSourceNode = sharedAudioContext.createMediaElementSource(audio);
      sharedTtsSourceNode.connect(sharedAudioContext.destination); // keep it audible to the candidate
      sharedTtsSourceNode.connect(sharedMixDestNode); // also capturable
    }
    const micTracks = cameraStream.getAudioTracks();
    if (micTracks.length > 0) {
      // A fresh MediaStreamSourceNode per call — the mic track comes from a
      // brand new getUserMedia stream each interview session, so there's no
      // stale node to reuse here the way the TTS element's node is reused.
      // NOT connected to sharedAudioContext.destination — the raw mic
      // input already reaches the candidate acoustically; routing it back
      // out through the speakers here would just create an echo.
      const micSource = sharedAudioContext.createMediaStreamSource(new MediaStream(micTracks));
      micSource.connect(sharedMixDestNode);
    }
    return new MediaStream([...cameraStream.getVideoTracks(), ...sharedMixDestNode.stream.getAudioTracks()]);
  } catch {
    // Any Web Audio failure — fall back to recording just the camera/mic
    // stream, still better than no recording at all.
    return cameraStream;
  }
}
