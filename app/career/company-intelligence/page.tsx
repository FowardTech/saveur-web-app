"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/company_intel.py
//   POST /api/v1/company-intel/research -> {company, overview, recent_developments,
//     culture_notes, likely_questions, talking_points, salary_range, interview_process, sources}
// @require_pro (Saveur-Backend/app/api/company_intel.py) — matches mobile's
// src/more/CompanyIntelligence.tsx (`if (!isPro) return <ProLockGate .../>`,
// variant="pro"/"Basic feature"). GATING GAP FIX: this page used to just
// `catch` a 402 into the same generic "Couldn't research that company right
// now" error text as any other failure — a free user got a confusing
// message instead of an upsell. Now gated the same way job-alerts/
// mock-interviews already established: preemptively via AuthProvider's real
// `isPro` (so a free user never even fills out the form) with the POST's
// 402 kept as a reactive fallback in case entitlement state is stale.
interface Intel {
  company: string;
  overview: string;
  recent_developments: string[];
  culture_notes: string;
  likely_questions: string[];
  talking_points: string[];
  salary_range: string;
  interview_process: string;
  sources: string[];
}

function CompanyIntelligencePageInner() {
  const { t } = useTranslation();
  const { isPro } = useAuth();
  const searchParams = useSearchParams();
  // Prefills from the Dream Company Dashboard's "Look up any company" link
  // (app/career/dream-companies/page.tsx, ?company=<name>&role=<role>) —
  // mirrors mobile's CompanyIntelligence.tsx seeding company/role from
  // route.params without auto-submitting; the user still taps "Research".
  const [company, setCompany] = useState(() => searchParams.get("company") ?? "");
  const [role, setRole] = useState(() => searchParams.get("role") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [intel, setIntel] = useState<Intel | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    setLoading(true);
    setError(null);
    setIntel(null);
    try {
      const data = await apiClient.post<Intel>("/api/v1/company-intel/research", {
        company: company.trim(),
        role: role.trim() || undefined,
      });
      setIntel(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:career.companyIntelligence.researchFailedDefault", { defaultValue: "Couldn't research that company right now." }));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:career.companyIntelligence.title", { defaultValue: "Company Intelligence" })}
            subtitle={t("web:career.companyIntelligence.subtitle", { defaultValue: "AI research on a target company before your interview." })}
          />

          {(proRequired || !isPro) && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:career.companyIntelligence.proRequiredTitle", { defaultValue: "Company Intelligence is a Basic feature" })}</h2>
              <p className="text-sm text-hint">{t("web:career.companyIntelligence.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above to get real, AI-researched company facts and likely interview questions." })}</p>
            </div>
          )}

          {isPro && !proRequired && (
          <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <TextField
              label={t("web:career.companyIntelligence.companyLabel", { defaultValue: "Company" })}
              placeholder={t("web:career.companyIntelligence.companyPlaceholder", { defaultValue: "e.g. Acme Corp" })}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
            <TextField
              label={t("web:career.companyIntelligence.roleLabel", { defaultValue: "Role (optional)" })}
              placeholder={t("web:career.companyIntelligence.rolePlaceholder", { defaultValue: "e.g. Product Manager" })}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading || !company.trim()} className="mt-1 w-full">
              {loading ? t("web:career.companyIntelligence.researching", { defaultValue: "Researching…" }) : t("web:career.companyIntelligence.researchCompany", { defaultValue: "Research company" })}
            </Button>
          </form>

          {intel && (
            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h2 className="font-semibold text-primary">{intel.company}</h2>
                <p className="mt-2 text-sm text-hint">{intel.overview}</p>
              </div>

              {intel.recent_developments?.length > 0 && (
                <Section title={t("web:career.companyIntelligence.recentDevelopments", { defaultValue: "Recent developments" })} items={intel.recent_developments} />
              )}
              {intel.culture_notes && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">{t("web:career.companyIntelligence.cultureNotes", { defaultValue: "Culture notes" })}</h3>
                  <p className="mt-2 text-sm text-hint">{intel.culture_notes}</p>
                </div>
              )}
              {intel.likely_questions?.length > 0 && (
                <Section title={t("web:career.companyIntelligence.likelyQuestions", { defaultValue: "Likely interview questions" })} items={intel.likely_questions} />
              )}
              {intel.talking_points?.length > 0 && (
                <Section title={t("web:career.companyIntelligence.talkingPoints", { defaultValue: "Talking points" })} items={intel.talking_points} />
              )}
              {intel.salary_range && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">{t("web:career.companyIntelligence.salaryRange", { defaultValue: "Salary range" })}</h3>
                  <p className="mt-2 text-sm text-hint">{intel.salary_range}</p>
                </div>
              )}
              {intel.interview_process && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">{t("web:career.companyIntelligence.interviewProcess", { defaultValue: "Interview process" })}</h3>
                  <p className="mt-2 text-sm text-hint">{intel.interview_process}</p>
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

// useSearchParams() requires a Suspense boundary in the app router (same
// pattern as app/practice/mock-interviews/page.tsx).
export default function CompanyIntelligencePage() {
  return (
    <Suspense fallback={null}>
      <CompanyIntelligencePageInner />
    </Suspense>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-card border border-border bg-surface-2 p-5">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-hint">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
