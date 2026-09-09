"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/networking.py
//   POST /api/v1/networking/message -> {message}  (body: {recipient_role, context, tone})
const TONES = ["friendly", "professional", "concise", "enthusiastic"];

export default function NetworkingAssistantPage() {
  const { t } = useTranslation();
  const [recipientRole, setRecipientRole] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("friendly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiClient.post<{ message: string }>("/api/v1/networking/message", {
        recipient_role: recipientRole.trim(),
        context: context.trim(),
        tone,
      });
      setMessage(data.message);
    } catch (err) {
      setError((err as ApiError).message || t("web:career.networking.draftFailedDefault", { defaultValue: "Couldn't draft a message right now. Please try again." }));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:career.networking.title", { defaultValue: "Networking Assistant" })}
            subtitle={t("web:career.networking.subtitle", { defaultValue: "Draft LinkedIn outreach messages tailored to your target contact." })}
          />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <TextField
              label={t("web:career.networking.recipientRoleLabel", { defaultValue: "Recipient's role" })}
              placeholder={t("web:career.networking.recipientRolePlaceholder", { defaultValue: "e.g. Engineering Manager at Acme Corp" })}
              value={recipientRole}
              onChange={(e) => setRecipientRole(e.target.value)}
              required
            />
            <TextField
              label={t("web:career.networking.contextLabel", { defaultValue: "Context" })}
              placeholder={t("web:career.networking.contextPlaceholder", { defaultValue: "e.g. Applying for the Senior Backend Engineer role, met at a career fair" })}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <SelectField label={t("web:career.networking.toneLabel", { defaultValue: "Tone" })} value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map((tn) => (
                <option key={tn} value={tn}>
                  {t(`web:career.networking.tones.${tn}`, { defaultValue: tn[0].toUpperCase() + tn.slice(1) })}
                </option>
              ))}
            </SelectField>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading || !recipientRole.trim()} className="mt-1 w-full">
              {loading ? t("web:career.networking.drafting", { defaultValue: "Drafting…" }) : t("web:career.networking.draftMessage", { defaultValue: "Draft message" })}
            </Button>
          </form>

          {message && (
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
              <p className="whitespace-pre-wrap text-sm text-primary">{message}</p>
              <Button variant="outline" size="sm" onClick={handleCopy} className="w-fit">
                {copied ? t("web:career.networking.copied", { defaultValue: "Copied!" }) : t("web:career.networking.copyMessage", { defaultValue: "Copy message" })}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
