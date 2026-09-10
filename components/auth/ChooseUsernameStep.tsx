"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { checkUsernameAvailability, regenerateUsername, type UsernameAvailability } from "@/lib/usernameService";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";

type CheckState = "idle" | "checking" | "available" | "invalid_format" | "looks_like_name" | "taken";

/**
 * "Choose your username" signup step — ports mobile's src/auth/Signup/
 * ChooseUsername.tsx to web. Reached right after account creation: by the
 * time this renders, the backend has already auto-assigned a random
 * `@username` via username_service.ensure_username (fired from
 * AuthProvider's syncProfile → POST /api/users/me, which every sign-up path
 * — email/password, Google, LinkedIn — calls before landing on /onboarding).
 * That auto-assigned handle is a completely valid final answer on its own;
 * this step is purely optional customization, so Skip is always available
 * and does no extra work.
 *
 * Two modes:
 * - "suggested": shows the already-assigned handle, with a "Generate
 *   another" button (POST /api/users/me/regenerate-username) that swaps in
 *   a fresh random one. Continuing needs no extra API call — it's already
 *   saved.
 * - "custom": free-text input with a ~450ms debounced live availability
 *   check (GET /api/users/username-availability) against the same
 *   format/uniqueness/"looks like your real name" rules the backend's
 *   PATCH /api/users/me enforces for real when this actually saves (see
 *   Saveur-Backend app/services/username_service.py). Continuing only
 *   enables once the live check says "available", and then calls
 *   useAuth().updateProfile({ username }).
 */
export function ChooseUsernameStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { profile, updateProfile, refreshProfile } = useAuth();
  const [mode, setMode] = useState<"suggested" | "custom">("suggested");
  const [customUsername, setCustomUsername] = useState("");
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow earlier availability response landing after a
  // faster later one and clobbering the check state for what's currently
  // typed (classic stale-async-response race on debounced as-you-type
  // checks).
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (mode !== "custom") return;
    const candidate = customUsername.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!candidate) {
      setCheckState("idle");
      return;
    }
    setCheckState("checking");
    const myRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res: UsernameAvailability = await checkUsernameAvailability(candidate);
        if (requestIdRef.current !== myRequestId) return;
        setCheckState(res.available ? "available" : (res.reason ?? "taken"));
      } catch {
        if (requestIdRef.current !== myRequestId) return;
        // Network hiccup — fall back to idle rather than a false "taken"/
        // "available", same posture as mobile's authService.
        setCheckState("idle");
      }
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [customUsername, mode]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      await regenerateUsername();
      await refreshProfile();
    } catch {
      setError(t("web:auth.usernameRegenerateFailedDefault", { defaultValue: "Couldn't generate a new username right now. Please try again." }));
    } finally {
      setRegenerating(false);
    }
  }

  async function handleContinue() {
    if (mode === "suggested") {
      onDone();
      return;
    }
    if (checkState !== "available") return;
    setSubmitting(true);
    setError(null);
    try {
      await updateProfile({ username: customUsername.trim() });
      onDone();
    } catch {
      setError(t("web:auth.usernameSaveFailedDefault", { defaultValue: "Couldn't save that username right now. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  }

  const canContinue = mode === "suggested" || checkState === "available";

  const statusCopy: Partial<Record<CheckState, { text: string; className: string }>> = {
    checking: { text: t("web:auth.usernameChecking", { defaultValue: "Checking availability…" }), className: "text-hint" },
    available: { text: t("web:auth.usernameAvailable", { defaultValue: "Username available" }), className: "text-success" },
    taken: { text: t("web:auth.usernameTaken", { defaultValue: "That username has already been taken" }), className: "text-danger" },
    looks_like_name: { text: t("web:auth.usernameLooksLikeName", { defaultValue: "That looks too close to your real name — pick something more anonymous." }), className: "text-danger" },
    invalid_format: { text: t("web:auth.usernameInvalidFormat", { defaultValue: "3-20 characters, starting with a letter — letters, numbers, and underscores only." }), className: "text-danger" },
  };
  const status = statusCopy[checkState];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">{t("web:auth.chooseUsernameTitle", { defaultValue: "Pick your username" })}</h1>
          <p className="mt-1 text-sm text-hint">
            {t("web:auth.chooseUsernameDescription", { defaultValue: "This is the only name other Saveur users ever see — on the Leaderboard and when sharing content with each other. It never shows your real name." })}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="shrink-0 text-sm font-medium text-hint hover:text-primary"
        >
          {t("common:actions.skip", { defaultValue: "Skip" })}
        </button>
      </div>

      <div className="flex gap-2 rounded-pill bg-surface-1 p-1">
        <button
          type="button"
          onClick={() => setMode("suggested")}
          className={`flex-1 rounded-pill px-4 py-2 text-sm font-medium transition ${
            mode === "suggested" ? "bg-brand text-white" : "text-hint hover:text-primary"
          }`}
        >
          {t("web:auth.usernameModeSuggested", { defaultValue: "Use suggested" })}
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`flex-1 rounded-pill px-4 py-2 text-sm font-medium transition ${
            mode === "custom" ? "bg-brand text-white" : "text-hint hover:text-primary"
          }`}
        >
          {t("web:auth.usernameModeCustom", { defaultValue: "Type my own" })}
        </button>
      </div>

      {mode === "suggested" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3">
          <div>
            <p className="text-xs text-hint">{t("web:auth.usernameYourHandle", { defaultValue: "Your handle" })}</p>
            <p className="text-base font-semibold text-primary">@{profile?.username ?? "…"}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? t("common:actions.loading", { defaultValue: "Loading…" }) : t("web:auth.usernameGenerateAnother", { defaultValue: "Generate another" })}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <input
              value={customUsername}
              onChange={(e) => setCustomUsername(e.target.value)}
              placeholder={t("web:auth.usernamePlaceholder", { defaultValue: "yourusername" })}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 pr-9 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {checkState === "checking" && (
              <EvaIcon name="loader-outline" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-hint" />
            )}
            {checkState === "available" && (
              <EvaIcon name="checkmark-circle-2-outline" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-success" />
            )}
            {(checkState === "taken" || checkState === "looks_like_name" || checkState === "invalid_format") && (
              <EvaIcon name="close-circle-outline" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-danger" />
            )}
          </div>
          {status && <p className={`text-xs font-medium ${status.className}`}>{status.text}</p>}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="mt-1 flex justify-end">
        <Button type="button" onClick={handleContinue} disabled={!canContinue || submitting}>
          {submitting ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("common:actions.continue", { defaultValue: "Continue" })}
        </Button>
      </div>
    </div>
  );
}
