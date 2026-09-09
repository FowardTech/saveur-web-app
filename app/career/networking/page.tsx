"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/networking.py
//   POST /api/v1/networking/message -> {message}  (body: {recipient_role, context, tone})
const TONES = ["friendly", "professional", "concise", "enthusiastic"];

export default function NetworkingAssistantPage() {
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
      setError((err as ApiError).message || "Couldn't draft a message right now. Please try again.");
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
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
        <PageHeader title="Networking Assistant" subtitle="Draft LinkedIn outreach messages tailored to your target contact." />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
          <TextField
            label="Recipient's role"
            placeholder="e.g. Engineering Manager at Acme Corp"
            value={recipientRole}
            onChange={(e) => setRecipientRole(e.target.value)}
            required
          />
          <TextField
            label="Context"
            placeholder="e.g. Applying for the Senior Backend Engineer role, met at a career fair"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <SelectField label="Tone" value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </SelectField>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading || !recipientRole.trim()} className="mt-1 w-full">
            {loading ? "Drafting…" : "Draft message"}
          </Button>
        </form>

        {message && (
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
            <p className="whitespace-pre-wrap text-sm text-primary">{message}</p>
            <Button variant="outline" size="sm" onClick={handleCopy} className="w-fit">
              {copied ? "Copied!" : "Copy message"}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
