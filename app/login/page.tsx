"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/app/providers/AuthProvider";
import { needsOnboarding } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { syncProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      setError(t("web:auth.firebaseNotConfigured", { defaultValue: "Firebase isn't configured yet — see README.md for the two values still needed." }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      const profile = await syncProfile();
      router.push(needsOnboarding(profile) ? "/onboarding" : "/dashboard");
    } catch (err: unknown) {
      const message = getErrorMessage(err, t("web:auth.signInFailedDefault", { defaultValue: "Sign in failed. Please check your details and try again." }));
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("common:auth.welcomeBack", { defaultValue: "Welcome back" })}
      subtitle={t("web:auth.loginSubtitle", { defaultValue: "Sign in to continue your career prep." })}
      footer={
        <>
          {t("common:auth.dontHaveAccount", { defaultValue: "Don't have an account? " })}
          <Link href="/register" className="font-medium text-link hover:underline">
            {t("common:actions.register", { defaultValue: "Register" })}
          </Link>
        </>
      }
    >
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
        <TextField
          label={t("common:fields.password", { defaultValue: "Password" })}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? t("common:actions.signingIn", { defaultValue: "Signing in…" }) : t("common:actions.signIn", { defaultValue: "Sign In" })}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-hint">{t("common:auth.orContinueWith", { defaultValue: "Or Continue With" })}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-3">
        <GoogleButton />
        <LinkedInButton />
      </div>
    </AuthLayout>
  );
}
