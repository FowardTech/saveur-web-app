"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/career_dna.py
//   GET  /api/v1/career-dna          -> {has_profile, traits, narrative, signal_count, version, generated_at, next_step_action_ids}
//   POST /api/v1/career-dna/refresh  -> same shape
// Pro Premium-gated (@require_premium).
interface CareerDnaPayload {
  has_profile: boolean;
  traits?: Record<string, number | string>;
  narrative?: string;
  signal_count?: number;
  version?: number;
  generated_at?: string;
}

export default function CareerDnaPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<CareerDnaPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await apiClient.get<CareerDnaPayload>("/api/v1/career-dna");
      setProfile(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || t("web:career.dna.loadFailedDefault", { defaultValue: "Couldn't load your Career DNA profile." }));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Intentional fetch-on-mount — load() sets state once its async GET
    // resolves, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiClient.post<CareerDnaPayload>("/api/v1/career-dna/refresh");
      setProfile(data);
    } catch (err) {
      setError((err as ApiError).message || t("web:career.dna.refreshFailedDefault", { defaultValue: "Couldn't refresh your profile right now." }));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:career.dna.title", { defaultValue: "Career DNA" })}
            subtitle={t("web:career.dna.subtitle", { defaultValue: "An AI-built profile of your work style, built from your real activity in the app." })}
          />

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:career.dna.premiumRequiredTitle", { defaultValue: "Career DNA is a Premium feature" })}</h2>
              <p className="text-sm text-hint">{t("web:career.dna.premiumRequiredSubtitle", { defaultValue: "Upgrade your plan to unlock your AI-built career profile." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          {loading && !premiumRequired && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-28 rounded-card" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SkeletonCard className="h-20" />
                <SkeletonCard className="h-20" />
                <SkeletonCard className="h-20" />
              </div>
            </div>
          )}

          {profile && !profile.has_profile && !premiumRequired && (
            <div className="rounded-card border border-dashed border-border p-6 text-center text-sm text-hint">
              {t("web:career.dna.notEnoughData", {
                defaultValue:
                  "Keep using the app — mock interviews, resume tools, learning courses — and your Career DNA profile will unlock once there's enough activity to build one.",
              })}
            </div>
          )}

          {profile && profile.has_profile && (
            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-border bg-gradient-to-br from-brand/15 via-accent-purple/10 to-transparent p-6">
                <p className="text-sm leading-relaxed text-primary">{profile.narrative}</p>
                <p className="mt-3 text-xs text-hint">
                  {t("web:career.dna.versionLine", { defaultValue: "Version {{version}} · built from {{count}} signal(s)", version: profile.version, count: profile.signal_count })}
                </p>
              </div>

              {profile.traits && Object.keys(profile.traits).length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(profile.traits).map(([trait, value]) => (
                    <div key={trait} className="rounded-card border border-border bg-surface-2 p-4 text-center">
                      <p className="text-lg font-bold text-brand">{String(value)}</p>
                      <p className="mt-1 text-xs capitalize text-hint">{trait.replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="w-fit">
                {refreshing ? t("web:career.dna.refreshing", { defaultValue: "Refreshing…" }) : t("web:career.dna.refreshProfile", { defaultValue: "Refresh my profile" })}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
