"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import * as learningService from "@/lib/learningService";
import type { CourseVideo } from "@/lib/learningService";
import { InAppVideoPlayer } from "@/components/learning/InAppVideoPlayer";

/**
 * Web counterpart to mobile's src/home/ContinueLearningCard.tsx (video
 * half only — see that file's own comment on why a video mid-playback
 * takes priority over a course module when both exist; web doesn't have a
 * "continue course" home card yet, so this only ever needs to handle the
 * video case). Product report: "Continue video is not implemented in the
 * web version." Self-contained: fetches its own data via
 * GET /api/v1/learning/videos/continue and renders nothing when there's
 * nothing to resume, so it's always safe to mount unconditionally on the
 * dashboard.
 */
export function ContinueWatchingCard() {
  const { t } = useTranslation();
  const [video, setVideo] = useState<CourseVideo | null | undefined>(undefined);
  const [playing, setPlaying] = useState(false);

  const load = () => {
    learningService
      .getContinueVideo()
      .then(setVideo)
      .catch(() => setVideo(null));
  };

  useEffect(() => {
    load();
  }, []);

  if (video === undefined || video === null) return null;

  const progressPct =
    video.durationSeconds && video.durationSeconds > 0
      ? Math.min(100, Math.round(((video.lastPositionSeconds ?? 0) / video.durationSeconds) * 100))
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="flex items-center gap-3 rounded-card border border-border bg-tint-mint p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-1 text-tint-mint-text">
          <EvaIcon name="play-circle-outline" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-primary">
            {t("web:dashboard.continueWatchingTitle", { defaultValue: "Continue watching" })}: {video.title}
          </p>
          <p className="truncate text-sm text-hint">
            {progressPct != null
              ? t("web:dashboard.continueWatchingPct", { defaultValue: "{{pct}}% watched", pct: progressPct })
              : t("web:dashboard.continueWatchingGeneric", { defaultValue: "Video lesson" })}
          </p>
        </div>
        <EvaIcon name="arrow-forward-outline" size={18} className="shrink-0 text-hint" />
      </button>

      <InAppVideoPlayer
        video={playing ? video : null}
        context={{ topic: video.topic ?? undefined, moduleTitle: video.moduleTitle ?? undefined, courseId: video.courseId ?? undefined }}
        startSeconds={video.lastPositionSeconds}
        onClose={() => {
          setPlaying(false);
          // The just-closed session may have moved the resume position (or
          // finished the video entirely, dropping it off get_continue_video
          // altogether) — refresh so this card doesn't keep showing a stale
          // pre-watch snapshot, or a video that no longer belongs here.
          load();
        }}
      />
    </>
  );
}
