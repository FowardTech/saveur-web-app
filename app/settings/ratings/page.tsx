"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { getMyRatings, type AppRating } from "@/lib/appRatingService";

// Web port of mobile's src/more/MyRatings.tsx (product report: "you did not
// implement ratings in the web app... just the way it is in the mobile
// app" -- the backend's own docstring is explicit that ratings should be
// "seen in the admin and the user that sent the ratings too"). Real
// backend: GET /api/v1/ratings/mine -> {ratings: [...]}, newest first.
export default function MyRatingsPage() {
  const { t } = useTranslation();
  const [ratings, setRatings] = useState<AppRating[] | null>(null);

  useEffect(() => {
    getMyRatings()
      .then(setRatings)
      .catch(() => setRatings([]));
  }, []);

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:myRatings.title", { defaultValue: "My Ratings" })}
            subtitle={t("web:myRatings.subtitle", { defaultValue: "Ratings you've submitted about your experience with Saveur." })}
          />

          {ratings === null ? (
            <SkeletonRows count={3} />
          ) : ratings.length === 0 ? (
            <div className="rounded-card border border-dashed border-border p-10 text-center">
              <p className="text-sm text-hint">
                {t("web:myRatings.empty", { defaultValue: "You haven't submitted a rating yet — one will pop up here once you do." })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {ratings.map((r) => (
                <div key={r.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <EvaIcon key={n} name="star-outline" size={16} className={n <= r.score ? "text-brand" : "text-hint/40"} />
                      ))}
                    </div>
                    <p className="text-xs text-hint">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                  {r.comment && <p className="text-sm text-primary">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
