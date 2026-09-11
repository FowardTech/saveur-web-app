"use client";

import { useEffect } from "react";
import { EvaIcon } from "@/components/icons/EvaIcon";
import * as learningService from "@/lib/learningService";
import type { CourseVideo, CourseVideoContext } from "@/lib/learningService";

// Web counterpart to mobile's components/InAppVideoPlayer.tsx — plays a
// recommended video entirely inside the app via a YouTube iframe embed
// (never opens youtube.com or an external tab). YouTube-embed-only is a
// real ToS constraint on the recommendation source itself (see
// Saveur-Backend/app/services/learning_video_service.py's own docstring),
// not a scoping choice made here.
interface InAppVideoPlayerProps {
  video: CourseVideo | null;
  context?: CourseVideoContext;
  onClose: () => void;
}

export function InAppVideoPlayer({ video, context, onClose }: InAppVideoPlayerProps) {
  // Logged the moment the player actually opens, same as mobile — best
  // effort, never blocks playback (see learningService.logVideoWatch).
  useEffect(() => {
    if (video) learningService.logVideoWatch(video, context);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.videoId]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <div className="flex w-full max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-white">{video.title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <EvaIcon name="close-outline" size={20} />
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
          <iframe
            key={video.videoId}
            src={`${video.embedUrl}?autoplay=1&rel=0`}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {video.channel && <p className="text-sm text-white/70">{video.channel}</p>}
      </div>
    </div>
  );
}
