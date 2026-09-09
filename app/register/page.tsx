"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createUserWithEmailAndPassword, updateProfile as updateFirebaseProfile } from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/app/providers/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { syncProfile, updateProfile } = useAuth();
  const [name, setName] = useState("");
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
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (name.trim()) {
        await updateFirebaseProfile(credential.user, { displayName: name.trim() });
      }
      await syncProfile();
      if (name.trim()) {
        await updateProfile({ name: name.trim() });
      }
      // Brand-new account — always straight to onboarding.
      router.push("/onboarding");
    } catch (err: unknown) {
      const message = getErrorMessage(err, t("web:auth.registrationFailedDefault", { defaultValue: "Registration failed. Please try again." }));
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("common:auth.createAccount", { defaultValue: "Create your account" })}
      subtitle={t("web:auth.registerSubtitle", { defaultValue: "Start practicing with your AI career coach in minutes." })}
      footer={
        <>
          {t("common:auth.alreadyHaveAccount", { defaultValue: "Already have an account? " })}
          <Link href="/login" className="font-medium text-link hover:underline">
            {t("common:actions.signIn", { defaultValue: "Sign In" })}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label={t("common:fields.fullName", { defaultValue: "Full name" })}
          type="text"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? t("common:actions.creatingAccount", { defaultValue: "Creating account…" }) : t("common:actions.register", { defaultValue: "Register" })}
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
