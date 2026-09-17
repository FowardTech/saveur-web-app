"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import { getSavedVideos, setVideoSaved, type CourseVideo } from "@/lib/learningService";
import { InAppVideoPlayer } from "@/components/learning/InAppVideoPlayer";

// Web port of mobile's src/more/SavedVideos.tsx (product report: "The
// Saved card is not implemented in the web app. You need to implement
// it" — confirmed to mean the "Saved Videos" list screen: the bookmark
// toggle on a recommended-video card already existed on web
// (app/learning/course/[courseId]/page.tsx's onToggleSaveVideo), but a
// user who saved one had nowhere to actually review it afterward — a save
// button with nowhere to review what was saved isn't a real feature).
// Same Premium gate as Learning Courses itself (GET /videos/saved is
// @require_premium on the backend). Reached from a "Saved Videos" link on
// app/learning/page.tsx's header.
export default function SavedVideosPage() {
  const { t } = useTranslation();
  const { isPremium } = useAuth();
  const [videos, setVideos] = useState<CourseVideo[] | null>(null);
  const [playerVideo, setPlayerVideo] = useState<CourseVideo | null>(null);

  const load = useCallback(() => {
    getSavedVideos().then(setVideos);
  }, []);

  useEffect(() => {
    if (isPremium) load();
  }, [isPremium, load]);

  async function onUnsave(video: CourseVideo, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Optimistic — matches the course page's own onToggleSaveVideo pattern.
    setVideos((prev) => (prev ?? []).filter((v) => v.videoId !== video.videoId));
    const ok = await setVideoSaved(video, false, { topic: video.topic ?? undefined, moduleTitle: video.moduleTitle ?? undefined, courseId: video.courseId ?? undefined });
    if (!ok) load(); // resync if the unsave actually failed server-side
  }

  if (!isPremium) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <PageHeader title={t("web:learning.savedVideos.title", { defaultValue: "Saved Videos" })} />
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-tint-purple p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-1 text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:learning.savedVideos.title", { defaultValue: "Saved Videos" })}</h2>
              <p className="text-sm text-hint">
                {t("web:learning.savedVideos.premiumGateDescription", {
                  defaultValue: "Bookmark Learning Course videos to come back to later — Saved Videos is a Premium feature.",
                })}
              </p>
            </div>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:learning.savedVideos.title", { defaultValue: "Saved Videos" })}
            subtitle={t("web:learning.savedVideos.subtitle", { defaultValue: "Videos you've bookmarked from Learning Course lessons." })}
          />

          {videos === null && <SkeletonRows count={3} />}

          {/* BUG FIX (task #46 visual quality pass): was a hand-rolled
              empty state (bare icon, no circular background, no bold
              title) instead of the shared EmptyState component every
              other empty list in the app uses (applications, job alerts,
              career diary, etc.) -- inconsistent and visibly lower-
              fidelity than its siblings. */}
          {videos !== null && videos.length === 0 && (
            <EmptyState
              icon="star-outline"
              title={t("web:learning.savedVideos.emptyTitle", { defaultValue: "No saved videos yet" })}
              description={t("web:learning.savedVideos.empty", { defaultValue: "Videos you save from a Learning Course lesson will show up here." })}
            />
          )}

          {videos !== null && videos.length > 0 && (
            <div className="flex flex-col gap-3">
              {videos.map((video, i) => (
                <button
                  key={video.videoId}
                  type="button"
                  onClick={() => setPlayerVideo(video)}
                  className={`flex items-center gap-3 rounded-card border border-border p-3 text-left transition hover:border-brand/40 ${
                    ["bg-tint-orange", "bg-tint-mint", "bg-tint-purple", "bg-tint-rose"][i % 4]
                  }`}
                >
                  <div className="relative h-[60px] w-[90px] shrink-0 overflow-hidden rounded-lg bg-surface-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail, not a local/optimizable asset */}
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <EvaIcon name="play-circle-outline" size={22} className="text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-primary">{video.title}</p>
                    {video.channel && <p className="mt-0.5 truncate text-xs text-hint">{video.channel}</p>}
                    {video.moduleTitle && (
                      <p className="mt-0.5 truncate text-xs text-hint">
                        {t("web:learning.savedVideos.fromLesson", { defaultValue: "From: {{lesson}}", lesson: video.moduleTitle })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => onUnsave(video, e)}
                    aria-label={t("web:learning.savedVideos.unsave", { defaultValue: "Remove from saved" })}
                    className="shrink-0 p-1.5 text-warning-text hover:opacity-70"
                  >
                    <EvaIcon name="star-outline" size={18} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        <InAppVideoPlayer
          video={playerVideo}
          context={{ topic: playerVideo?.topic ?? undefined, moduleTitle: playerVideo?.moduleTitle ?? undefined, courseId: playerVideo?.courseId ?? undefined }}
          onClose={() => {
            setPlayerVideo(null);
            load(); // pick up an unsave that happened inside the player, once it gets one
          }}
        />
      </AppShell>
    </RequireAuth>
  );
}
