"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/dream_companies.py
//   GET  /api/v1/dream-companies      -> DreamCompany[]
//   POST /api/v1/dream-companies      -> DreamCompany  (body: {company, role?})
//   POST /api/v1/dream-companies/<id>/priority -> DreamCompany
//   DELETE /api/v1/dream-companies/<id>
// Pro Premium-gated (@require_premium).
interface DreamCompany {
  id: number;
  company: string;
  target_role?: string | null;
  is_top_choice: boolean;
  logo_url?: string | null;
  readiness_score: number;
  research_pending: boolean;
  intel?: { overview?: string } | null;
}

export default function DreamCompaniesPage() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<DreamCompany[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const data = await apiClient.get<DreamCompany[]>("/api/v1/dream-companies");
      setCompanies(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || t("web:career.dreamCompanies.loadFailedDefault", { defaultValue: "Couldn't load your dream companies." }));
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/dream-companies", { company: company.trim(), role: role.trim() || undefined });
      setCompany("");
      setRole("");
      await load();
    } catch (err) {
      setError((err as ApiError).message || t("web:career.dreamCompanies.addFailedDefault", { defaultValue: "Couldn't add that company right now." }));
    } finally {
      setAdding(false);
    }
  }

  async function handleTogglePriority(c: DreamCompany) {
    try {
      const data = await apiClient.post<DreamCompany>(`/api/v1/dream-companies/${c.id}/priority`, {
        is_top_choice: !c.is_top_choice,
      });
      setCompanies((prev) => (prev ? prev.map((row) => (row.id === c.id ? data : row)) : prev));
    } catch {
      // no-op
    }
  }

  async function handleRemove(id: number) {
    try {
      await apiClient.delete(`/api/v1/dream-companies/${id}`);
      setCompanies((prev) => (prev ? prev.filter((row) => row.id !== id) : prev));
    } catch {
      // no-op
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:career.dreamCompanies.title", { defaultValue: "Dream Companies" })}
            subtitle={t("web:career.dreamCompanies.subtitle", { defaultValue: "Track target companies with AI research and a real readiness score." })}
          />

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:career.dreamCompanies.premiumRequiredTitle", { defaultValue: "Dream Companies is a Premium feature" })}</h2>
              <p className="text-sm text-hint">{t("web:career.dreamCompanies.premiumRequiredSubtitle", { defaultValue: "Upgrade your plan to track companies and get AI research on each." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {!premiumRequired && (
            <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5 sm:flex-row sm:items-end">
              <div className="flex-1">
                <TextField
                  label={t("web:career.dreamCompanies.companyLabel", { defaultValue: "Company" })}
                  placeholder={t("web:career.dreamCompanies.companyPlaceholder", { defaultValue: "e.g. Acme Corp" })}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1">
                <TextField
                  label={t("web:career.dreamCompanies.targetRoleLabel", { defaultValue: "Target role (optional)" })}
                  placeholder={t("web:career.dreamCompanies.targetRolePlaceholder", { defaultValue: "e.g. Product Manager" })}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={adding || !company.trim()}>
                {adding ? t("web:career.dreamCompanies.adding", { defaultValue: "Adding…" }) : t("web:career.dreamCompanies.add", { defaultValue: "Add" })}
              </Button>
            </form>
          )}

          {companies && companies.length === 0 && !premiumRequired && (
            <p className="text-sm text-hint">{t("web:career.dreamCompanies.empty", { defaultValue: "No companies tracked yet — add one above to get started." })}</p>
          )}

          {companies && companies.length > 0 && (
            <div className="flex flex-col gap-3">
              {companies.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text font-semibold">
                      {c.company[0]?.toUpperCase()}
                    </span>
                    <div>
                      <h3 className="font-medium text-primary">
                        {c.company}
                        {c.is_top_choice && <EvaIcon name="star" size={14} className="ml-1.5 inline text-brand" />}
                      </h3>
                      <p className="text-sm text-hint">
                        {c.target_role || t("web:career.dreamCompanies.noTargetRole", { defaultValue: "No target role set" })} ·{" "}
                        {c.research_pending
                          ? t("web:career.dreamCompanies.researching", { defaultValue: "Researching…" })
                          : t("web:career.dreamCompanies.readyPercent", { defaultValue: "{{score}}% ready", score: c.readiness_score })}
                      </p>
                      {c.intel?.overview && <p className="mt-1 max-w-md text-xs text-hint">{c.intel.overview.slice(0, 140)}…</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleTogglePriority(c)}>
                      {c.is_top_choice
                        ? t("web:career.dreamCompanies.unmarkTopChoice", { defaultValue: "Unmark top choice" })
                        : t("web:career.dreamCompanies.markTopChoice", { defaultValue: "Mark top choice" })}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(c.id)}>
                      {t("web:career.dreamCompanies.remove", { defaultValue: "Remove" })}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
