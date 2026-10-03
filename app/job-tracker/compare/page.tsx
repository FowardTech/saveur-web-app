"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { guessCompanyLogoUrl } from "@/lib/companyData";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

interface Offer {
  id: number;
  company: string;
  role: string;
  stage: string;
  location?: string;
  company_logo_url?: string;
  offer_amount?: number | null;
  offer_currency?: string | null;
  offer_deadline?: number | null;
}

// Side-by-side comparison of every application currently at the Offer stage.
// Web port of the mobile "Compare offers" screen, with a % difference vs the
// highest offer so the gap is visible at a glance.
export default function CompareOffersPage() {
  const { t, i18n } = useTranslation();
  const { loading: authLoading } = useAuth();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    apiClient
      .get<Offer[]>("/api/v1/tracker/applications")
      .then((all) => setOffers((all ?? []).filter((a) => a.stage === "Offer")))
      .catch((e) => {
        setError((e as ApiError).message || t("web:compareOffers.loadFailed", { defaultValue: "Couldn't load your offers." }));
        setOffers([]);
      });
  }, [authLoading, t]);

  const amounts = (offers ?? []).map((o) => o.offer_amount).filter((v): v is number => v != null);
  const currencies = new Set((offers ?? []).map((o) => o.offer_currency).filter(Boolean));
  const comparable = amounts.length >= 2 && currencies.size <= 1;
  const best = comparable ? Math.max(...amounts) : null;
  const notSet = t("web:compareOffers.notSet", { defaultValue: "Not set" });
  const fmtDate = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleDateString(i18n.language, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : notSet;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
          <Link href="/job-tracker" className="text-sm font-medium text-hint hover:text-primary">
            ← {t("web:compareOffers.back", { defaultValue: "Back to Job Tracker" })}
          </Link>
          <PageHeader
            title={t("web:compareOffers.title", { defaultValue: "Compare offers" })}
            subtitle={t("web:compareOffers.subtitle", { defaultValue: "Every application at the Offer stage, side by side." })}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          {offers === null ? (
            <SkeletonRows />
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface-2 p-10 text-center">
              <EvaIcon name="award-outline" size={32} className="text-hint" />
              <h2 className="text-base font-bold text-primary">{t("web:compareOffers.emptyTitle", { defaultValue: "No offers yet" })}</h2>
              <p className="text-sm text-hint">{t("web:compareOffers.emptyBody", { defaultValue: "Once an application reaches the Offer stage, it'll show up here." })}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => {
                const isBest = best !== null && o.offer_amount === best;
                const diff = best && o.offer_amount != null && !isBest ? Math.round(((o.offer_amount - best) / best) * 100) : null;
                return (
                  <div key={o.id} className={`flex flex-col gap-4 rounded-card border bg-surface-2 p-5 ${isBest ? "border-primary" : "border-border"}`}>
                    <div className="flex items-center gap-3">
                      <CompanyLogoAvatar companyName={o.company} logoUrl={o.company_logo_url || guessCompanyLogoUrl(o.company)} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-primary">{o.company}</p>
                        <p className="truncate text-xs text-hint">{o.role}</p>
                      </div>
                      {isBest && (
                        <span className="rounded-pill bg-solid px-2.5 py-1 text-xs font-bold text-solid-fg">
                          {t("web:compareOffers.highest", { defaultValue: "Highest" })}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                      <div>
                        <p className="text-xs text-hint">{t("web:compareOffers.offer", { defaultValue: "Offer" })}</p>
                        <p className="text-lg font-bold text-primary">
                          {o.offer_amount != null ? `${o.offer_currency ?? ""} ${o.offer_amount.toLocaleString(i18n.language)}`.trim() : notSet}
                        </p>
                        {diff !== null && <p className="text-xs text-hint">{diff}% {t("web:compareOffers.vsHighest", { defaultValue: "vs highest" })}</p>}
                      </div>
                      <div>
                        <p className="text-xs text-hint">{t("web:compareOffers.deadline", { defaultValue: "Decision deadline" })}</p>
                        <p className="text-lg font-bold text-primary">{fmtDate(o.offer_deadline)}</p>
                      </div>
                    </div>
                    <Link href={`/career/salary-benchmark?kind=offer&title=${encodeURIComponent(o.role)}&location=${encodeURIComponent(o.location ?? "")}&salary=${o.offer_amount ?? ""}&currency=${encodeURIComponent(o.offer_currency ?? "")}`} className="text-sm font-medium text-link hover:underline">
                      {t("web:compareOffers.analyze", { defaultValue: "Analyze this offer" })}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
