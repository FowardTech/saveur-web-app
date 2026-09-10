"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import apiClient from "@/lib/apiClient";

// Web port of Saveur (mobile)'s src/more/DailyIndustryNews.tsx — a real,
// web-search-grounded (Perplexity) daily digest tailored to the learner's
// own industries/desired roles. Real backend — Saveur-Backend/app/api/
// news.py: GET /api/v1/news/today -> DailyNews (lazy-generated + cached per
// day, @require_premium).
interface NewsItem {
  headline: string;
  summary: string;
  source_url?: string;
  source_name?: string;
}
interface DailyNews {
  items: NewsItem[];
}

export default function NewsPage() {
  const { t, i18n } = useTranslation();
  const { isPremium } = useAuth();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    apiClient
      .get<DailyNews>("/api/v1/news/today", { params: { language: i18n.language || "en" } })
      .then((data) => setItems(data.items ?? []))
      .catch(() => setError(t("web:news.loadFailedDefault", { defaultValue: "Couldn't load today's news right now." })));
  }

  useEffect(() => {
    if (isPremium) load();
    else setItems([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  if (!isPremium) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            <PageHeader title={t("web:news.title", { defaultValue: "Daily Industry News" })} />
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:news.premiumRequiredTitle", { defaultValue: "Daily Industry News is a Premium feature" })}</h2>
              <p className="text-sm text-hint">{t("web:news.premiumRequiredSubtitle", { defaultValue: "A real, AI-curated daily digest of news relevant to your industry and target roles." })}</p>
            </div>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
          <PageHeader title={t("web:news.title", { defaultValue: "Daily Industry News" })} subtitle={t("web:news.subtitle", { defaultValue: "Today's headlines relevant to your industry and target roles." })} />

          {items === null && !error && <SkeletonRows count={3} />}

          {error && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-danger">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={load}>
                {t("common:try_again", { defaultValue: "Try again" })}
              </Button>
            </div>
          )}

          {items && items.length === 0 && !error && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <EvaIcon name="globe-outline" size={22} className="text-hint" />
              <p className="text-sm text-hint">{t("web:news.empty", { defaultValue: "No news digest available right now — check back later today." })}</p>
            </div>
          )}

          {items && items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map((item, i) => (
                <div key={i} className="rounded-card border border-border bg-surface-2 p-5">
                  <h2 className="font-semibold text-primary">{item.headline}</h2>
                  <p className="mt-2 text-sm text-hint">{item.summary}</p>
                  {item.source_url && (
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                      <EvaIcon name="external-link-outline" size={14} />
                      {item.source_name || item.source_url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
