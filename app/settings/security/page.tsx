"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/two_factor.py
//   GET  /api/v1/auth/2fa/status  -> {enabled}
//   POST /api/v1/auth/2fa/send    -> {sent, email_hint}  (body: {purpose: "enable"})
//   POST /api/v1/auth/2fa/verify  -> {verified, two_factor_enabled}  (body: {code, purpose})
//   POST /api/v1/auth/2fa/disable -> {two_factor_enabled: false}
export default function SecuritySettingsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);

  async function load() {
    try {
      const data = await apiClient.get<{ enabled: boolean }>("/api/v1/auth/2fa/status");
      setEnabled(data.enabled);
    } catch (err) {
      setError((err as ApiError).message || "Couldn't load your security settings.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSendCode() {
    setSending(true);
    setError(null);
    try {
      const data = await apiClient.post<{ sent: boolean; email_hint: string }>("/api/v1/auth/2fa/send", {
        purpose: "enable",
      });
      setEmailHint(data.email_hint);
    } catch (err) {
      setError((err as ApiError).message || "Couldn't send a verification code right now.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifying(true);
    setError(null);
    try {
      const data = await apiClient.post<{ verified: boolean; two_factor_enabled: boolean }>("/api/v1/auth/2fa/verify", {
        code: code.trim(),
        purpose: "enable",
      });
      setEnabled(data.two_factor_enabled);
      setEmailHint(null);
      setCode("");
    } catch (err) {
      setError((err as ApiError).message || "That code didn't work — try sending a new one.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleDisable() {
    setDisabling(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/auth/2fa/disable");
      setEnabled(false);
    } catch (err) {
      setError((err as ApiError).message || "Couldn't disable two-factor authentication right now.");
    } finally {
      setDisabling(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-xl flex-col gap-8 pb-10">
          <PageHeader title="Security" subtitle="Protect your account with email-code two-factor authentication." />

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                <EvaIcon name="shield-outline" size={20} />
              </span>
              <div>
                <h2 className="font-semibold text-primary">Two-factor authentication</h2>
                <p className="text-sm text-hint">
                  {enabled === null ? "Loading…" : enabled ? "Enabled — a code is sent to your email at login." : "Not enabled."}
                </p>
              </div>
            </div>

            {enabled === true && (
              <Button variant="outline" onClick={handleDisable} disabled={disabling} className="w-fit">
                {disabling ? "Disabling…" : "Disable 2FA"}
              </Button>
            )}

            {enabled === false && !emailHint && (
              <Button onClick={handleSendCode} disabled={sending} className="w-fit">
                {sending ? "Sending…" : "Enable 2FA"}
              </Button>
            )}

            {enabled === false && emailHint && (
              <form onSubmit={handleVerify} className="flex flex-col gap-3">
                <p className="text-sm text-hint">Enter the code sent to {emailHint}.</p>
                <TextField label="Verification code" value={code} onChange={(e) => setCode(e.target.value)} required />
                <Button type="submit" disabled={verifying || !code.trim()} className="w-fit">
                  {verifying ? "Verifying…" : "Verify & enable"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
