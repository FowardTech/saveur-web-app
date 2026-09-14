"use client";

import { useEffect, useRef, useState } from "react";
import { EvaIcon } from "@/components/icons/EvaIcon";
import * as learningService from "@/lib/learningService";
import type { CourseVideo, CourseVideoContext } from "@/lib/learningService";

// Web counterpart to mobile's components/InAppVideoPlayer.tsx — plays a
// recommended video entirely inside the app via YouTube's official IFrame
// Player API (never opens youtube.com or an external tab). YouTube-embed-only
// is a real ToS constraint on the recommendation source itself (see
// Saveur-Backend/app/services/learning_video_service.py's own docstring):
// YouTube requires embedded playback to go through its own official player,
// which always carries a small amount of unremovable attribution (video
// title bar, a YouTube logo, a "watch on YouTube" affordance baked into the
// player chrome itself) — there is no compliant way to strip that while
// still playing real YouTube video content. `modestbranding=1&rel=0` below
// are real embed parameters that minimize (but per YouTube's own docs,
// cannot fully remove) that chrome, same as mobile's player.
//
// UPGRADE (product reports: "The videos in the learning course are supposed
// to play in the web app video player so that we can track the video where
// the user reached during watching... that's why I want us to use our own
// video player" / "Continue video is not implemented in the web version").
// This used to be a bare `<iframe src={video.embedUrl}>` with no way to know
// how far the learner got, and no resume support. Now uses YouTube's real
// IFrame Player API (loaded once, cached at module scope) so this can
// genuinely track playback position and report it back to the backend —
// the same mechanism mobile's WebView-hosted version already uses, just
// without needing an injected local HTML page (that trick was specifically
// a WebView postMessage-bridge workaround; on plain web the IFrame API talks
// directly to this component via its own JS callbacks).
interface InAppVideoPlayerProps {
  video: CourseVideo | null;
  context?: CourseVideoContext;
  onClose: () => void;
  /** Resume playback from this position (seconds) — product report: "the
   * app should always know where i stopped in the video and then i can
   * continue from where i stopped". Omitted/0 plays from the start. */
  startSeconds?: number;
}

interface YTPlayerInstance {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}
interface YTPlayerEvent {
  target: YTPlayerInstance;
  data: number;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (e: YTPlayerEvent) => void;
        onStateChange?: (e: YTPlayerEvent) => void;
        onError?: (e: { data: number }) => void;
      };
    }
  ) => YTPlayerInstance;
}

function getYT(): YTNamespace | undefined {
  return (window as unknown as { YT?: YTNamespace }).YT;
}

// Loaded once for the whole app's lifetime — cached at module scope so
// reopening the player (or opening a second one elsewhere) never injects
// the script tag twice.
let apiLoadPromise: Promise<void> | null = null;
function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (getYT()?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    const w = window as unknown as { onYouTubeIframeAPIReady?: () => void };
    const prevCallback = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.body.appendChild(script);
  });
  return apiLoadPromise;
}

const REPORT_INTERVAL_MS = 5000;
// YT.PlayerState values per YouTube's IFrame API docs.
const YT_STATE_PLAYING = 1;
const YT_STATE_PAUSED = 2;
const YT_STATE_ENDED = 0;

export function InAppVideoPlayer({ video, context, onClose, startSeconds }: InAppVideoPlayerProps) {
  const [isSaved, setIsSaved] = useState(!!video?.isSaved);
  const [isSaving, setIsSaving] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const reportTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Logged the moment the player actually opens, same as mobile — best
  // effort, never blocks playback (see learningService.logVideoWatch).
  useEffect(() => {
    setIsSaved(!!video?.isSaved);
    setPlaybackError(false);
    if (video) learningService.logVideoWatch(video, context);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.videoId]);

  // Real YouTube IFrame Player API wiring — position tracking (product
  // report: "the app should always know where i stopped in the video")
  // plus resume support via `startSeconds` (product report: "Continue video
  // is not implemented in the web version"). A saved position within a few
  // seconds of the video's own end (or a negative/NaN value) isn't a
  // meaningful resume point — start from 0 rather than reopening a
  // just-finished video one tick before its own end card, same guard
  // mobile's player uses.
  useEffect(() => {
    if (!video) return;
    let cancelled = false;
    const resumeFrom = startSeconds && Number.isFinite(startSeconds) && startSeconds > 0 ? Math.floor(startSeconds) : 0;

    const stopReporting = () => {
      if (reportTimerRef.current) {
        clearInterval(reportTimerRef.current);
        reportTimerRef.current = null;
      }
    };
    const reportTime = () => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const current = player.getCurrentTime();
        const duration = player.getDuration();
        void learningService.updateVideoPosition(video.videoId, current, duration > 0 ? duration : undefined);
      } catch {
        // Player not ready/destroyed mid-tick — ignore, the next tick (or
        // the pause/end report) will catch up.
      }
    };
    const startReporting = () => {
      if (reportTimerRef.current) return;
      reportTimerRef.current = setInterval(reportTime, REPORT_INTERVAL_MS);
    };

    loadYouTubeIframeApi().then(() => {
      if (cancelled || !containerRef.current) return;
      const YT = getYT();
      if (!YT) {
        setPlaybackError(true);
        return;
      }
      playerRef.current = new YT.Player(containerRef.current, {
        videoId: video.videoId,
        playerVars: {
          playsinline: 1,
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
          start: resumeFrom,
        },
        events: {
          onStateChange: (e) => {
            if (e.data === YT_STATE_PLAYING) {
              startReporting();
            } else {
              stopReporting();
              if (e.data === YT_STATE_PAUSED || e.data === YT_STATE_ENDED) reportTime();
            }
          },
          // Error codes: 2 invalid param, 5 HTML5 player error, 100 video
          // not found/removed/private, 101/150 embedding disallowed by the
          // video owner — every one of these means "can't play this here",
          // so all are treated the same, same as mobile's player.
          onError: () => setPlaybackError(true),
        },
      });
    });

    return () => {
      cancelled = true;
      stopReporting();
      try {
        playerRef.current?.destroy();
      } catch {
        // Already torn down / never finished initializing — nothing to clean up.
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.videoId]);

  if (!video) return null;

  async function onToggleSave() {
    if (!video || isSaving) return;
    const next = !isSaved;
    setIsSaved(next); // optimistic
    setIsSaving(true);
    const ok = await learningService.setVideoSaved(video, next, context);
    if (!ok) setIsSaved(!next); // revert on failure
    setIsSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <div className="flex w-full max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-white">{video.title}</p>
          <div className="flex shrink-0 items-center gap-1">
            {/* Save toggle right in the player — same place mobile's does,
                reusing the same star icon web's Saved Videos list already
                uses for this (app/learning/saved/page.tsx), not mobile's
                bookmark icon, for visual consistency with the rest of this
                app's saved-video affordances. */}
            <button
              type="button"
              onClick={onToggleSave}
              disabled={isSaving}
              aria-label="Save video"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-60"
            >
              <EvaIcon name="star-outline" size={18} className={isSaved ? "text-warning-text" : "text-white"} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close video"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <EvaIcon name="close-outline" size={20} />
            </button>
          </div>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
          {playbackError ? (
            // Clean in-app fallback — no YouTube branding, logo, or native
            // error chrome, same as mobile's player.
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
              <EvaIcon name="video-off-outline" size={28} className="text-white/60" />
              <p className="text-sm text-white/80">This video can&apos;t be played right now.</p>
            </div>
          ) : (
            <div key={video.videoId} ref={containerRef} className="h-full w-full" />
          )}
        </div>
        {video.channel && <p className="text-sm text-white/70">{video.channel}</p>}
      </div>
    </div>
  );
}
