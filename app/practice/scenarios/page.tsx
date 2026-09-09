"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/practical.py
//   GET  /api/v1/practical/types    -> {types: string[]}
//   POST /api/v1/practical/sessions -> {session: {...}, step: {situation, choices, is_final}}
// Gated behind the "practical_scenario" paid add-on (@require_addon).
const PRACTICAL_TYPES = ["healthcare", "sales", "marketing", "finance", "consulting", "science"];

function fallbackLabelFor(type: string) {
  return type[0].toUpperCase() + type.slice(1);
}

interface StepResult {
  situation: string;
  choices: { id: string; text: string }[];
  is_final: boolean;
}

export default function PracticalScenariosSetupPage() {
  const { t } = useTranslation();
  const [type, setType] = useState(PRACTICAL_TYPES[0]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);
  const [step, setStep] = useState<StepResult | null>(null);

  function labelFor(value: string) {
    return t(`web:practice.scenarios.types.${value}`, { defaultValue: fallbackLabelFor(value) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAddonRequired(false);
    setStep(null);
    try {
      const data = await apiClient.post<{ session: { id: number }; step: StepResult }>(
        "/api/v1/practical/sessions",
        { type, role: role.trim() || undefined }
      );
      setStep(data.step);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402) {
        setAddonRequired(true);
      } else {
        setError(apiErr.message || t("web:practice.scenarios.startFailedDefault", { defaultValue: "Couldn't start a scenario. Please try again." }));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:practice.scenarios.title", { defaultValue: "Practical Scenarios" })}
            subtitle={t("web:practice.scenarios.subtitle", { defaultValue: "Hands-on, multi-step judgment scenarios for non-engineering roles." })}
          />

          {addonRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:practice.scenarios.addonRequiredTitle", { defaultValue: "Practical Scenarios is a paid add-on" })}</h2>
              <p className="text-sm text-hint">
                {t("web:practice.scenarios.addonRequiredSubtitle", {
                  defaultValue: "Purchase the Practical Scenarios add-on from your account to unlock this practice mode.",
                })}
              </p>
            </div>
          )}

          {!step && !addonRequired && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <SelectField
                label={t("web:practice.scenarios.scenarioTypeLabel", { defaultValue: "Scenario type" })}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {PRACTICAL_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {labelFor(pt)}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={t("web:practice.scenarios.roleLabel", { defaultValue: "Role (optional)" })}
                placeholder={t("web:practice.scenarios.rolePlaceholder", { defaultValue: "e.g. Registered Nurse, Account Executive" })}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? t("web:practice.scenarios.startingLabel", { defaultValue: "Starting…" }) : t("web:practice.scenarios.startScenario", { defaultValue: "Start scenario" })}
              </Button>
            </form>
          )}

          {step && (
            <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                  <EvaIcon name="checkmark-circle-2-outline" size={22} />
                </span>
                <h2 className="font-semibold text-primary">{t("web:practice.scenarios.scenarioStarted", { defaultValue: "Scenario started" })}</h2>
              </div>

              <div className="rounded-lg bg-surface-1 p-4">
                <p className="text-sm text-primary">{step.situation}</p>
              </div>

              <div className="flex flex-col gap-2">
                {step.choices.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-primary">
                    <span className="font-medium uppercase text-hint">{c.id}.</span> {c.text}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-hint">
                {t("web:practice.scenarios.interactivePlaceholder", {
                  defaultValue:
                    "This is where the interactive scenario would continue — choosing an option here would advance the story and eventually produce a judgment-quality assessment. That full interactive flow is coming to the web app in a future pass; the session above is saved to your account the same as on mobile.",
                })}
              </div>

              <Button variant="outline" onClick={() => setStep(null)}>
                {t("web:practice.scenarios.startAnother", { defaultValue: "Start another scenario" })}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
