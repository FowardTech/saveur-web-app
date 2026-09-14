"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import apiClient from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

// Web port of Saveur (mobile)'s src/auth/ForgetPassword.tsx — product
// report: "You did not add forgot password to that web version." Web's
// login page had a password field and a "Register" link but no way at all
// to recover a forgotten password.
//
// Same real backend contract mobile already uses — POST
// /api/v1/email/send-password-reset (Saveur-Backend/app/api/email.py,
// public/no-auth) generates a Firebase-hosted reset link server-side and
// emails it via Resend. The actual password change happens on Firebase's
// own hosted reset page after the user taps the emailed link, not in this
// app — same as mobile. Always responds {sent: true} regardless of whether
// the address has an account (avoids leaking account existence), so the
// confirmation below shows unconditionally on a successful call, matching
// that behavior.
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/email/send-password-reset", { email: email.trim() }, { auth: false });
      setSent(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("web:auth.resetEmailFailedDefault", { defaultValue: "Could not send that. Please try again in a moment." })));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t("web:auth.forgotPasswordTitle", { defaultValue: "Forgot your password?" })}
      subtitle={t("web:auth.forgotPasswordSubtitle", { defaultValue: "Enter your email and we'll send you a link to reset it." })}
      footer={
        <Link href="/login" className="font-medium text-link hover:underline">
          {t("web:auth.backToSignIn", { defaultValue: "Back to sign in" })}
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm font-medium text-success-text">
          {t("web:auth.resetEmailSent", {
            email,
            defaultValue: `If an account exists for ${email}, a reset link is on its way. Check your inbox.`,
          })}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label={t("common:fields.email", { defaultValue: "Email" })}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={submitting} className="mt-1 w-full">
            {submitting ? t("web:auth.sendingResetLink", { defaultValue: "Sending…" }) : t("web:auth.sendResetLink", { defaultValue: "Send reset link" })}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
