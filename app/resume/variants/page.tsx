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

// Real backend contract — Saveur-Backend/app/api/resume_variants.py
//   GET  /api/v1/resume/variants -> {items: ResumeVariant[]}
//   POST /api/v1/resume/variants -> ResumeVariant (body: {label, target_role, target_company?})
//   DELETE /api/v1/resume/variants/<id>
// Creation is Pro Premium-gated (@require_premium); listing/viewing is just @require_auth.
interface ResumeVariant {
  id: number;
  label: string;
  target_role: string;
  target_company?: string | null;
  updated_at?: string;
}

export default function ResumeVariantsPage() {
  const { t } = useTranslation();
  const [variants, setVariants] = useState<ResumeVariant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [label, setLabel] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await apiClient.get<{ items: ResumeVariant[] }>("/api/v1/resume/variants");
      setVariants(data.items);
    } catch (err) {
      setError((err as ApiError).message || t("web:resume.variants.loadFailedDefault", { defaultValue: "Couldn't load your resume variants." }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !targetRole.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/resume/variants", {
        label: label.trim(),
        target_role: targetRole.trim(),
        target_company: targetCompany.trim() || undefined,
      });
      setLabel("");
      setTargetRole("");
      setTargetCompany("");
      await load();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || t("web:resume.variants.createFailedDefault", { defaultValue: "Couldn't create that variant right now." }));
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiClient.delete(`/api/v1/resume/variants/${id}`);
      setVariants((prev) => (prev ? prev.filter((v) => v.id !== id) : prev));
    } catch {
      // no-op
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:resume.variants.title", { defaultValue: "Resume Variants" })}
            subtitle={t("web:resume.variants.subtitle", { defaultValue: "Save multiple AI-tailored resumes side by side, one per target role or company." })}
          />

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:resume.variants.premiumRequiredTitle", { defaultValue: "Creating variants is a Premium feature" })}</h2>
              <p className="text-sm text-hint">{t("web:resume.variants.premiumRequiredSubtitle", { defaultValue: "Upgrade your plan to save multiple tailored resume variants." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <form onSubmit={handleCreate} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <TextField
              label={t("web:resume.variants.labelLabel", { defaultValue: "Label" })}
              placeholder={t("web:resume.variants.labelPlaceholder", { defaultValue: "e.g. Backend @ Startups" })}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
            <TextField
              label={t("web:resume.variants.targetRoleLabel", { defaultValue: "Target role" })}
              placeholder={t("web:resume.variants.targetRolePlaceholder", { defaultValue: "e.g. Senior Backend Engineer" })}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              required
            />
            <TextField
              label={t("web:resume.variants.targetCompanyLabel", { defaultValue: "Target company (optional)" })}
              placeholder={t("web:resume.variants.targetCompanyPlaceholder", { defaultValue: "e.g. Acme Corp" })}
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
            />
            <Button type="submit" disabled={creating || !label.trim() || !targetRole.trim()} className="mt-1 w-full">
              {creating ? t("web:resume.variants.creating", { defaultValue: "Creating…" }) : t("web:resume.variants.createVariant", { defaultValue: "Create variant" })}
            </Button>
          </form>

          {variants && variants.length === 0 && <p className="text-sm text-hint">{t("web:resume.variants.empty", { defaultValue: "No variants yet — create one above." })}</p>}

          {variants && variants.length > 0 && (
            <div className="flex flex-col gap-3">
              {variants.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-4">
                  <div>
                    <h3 className="font-medium text-primary">{v.label}</h3>
                    <p className="text-sm text-hint">
                      {v.target_role}
                      {v.target_company ? ` · ${v.target_company}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(v.id)}>
                    {t("web:resume.variants.delete", { defaultValue: "Delete" })}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
