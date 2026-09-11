"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonText } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";
import { enableWebPush, currentNotificationPermission, isPushConfigured } from "@/lib/messaging";

// Real backend contract — Saveur-Backend/app/api/two_factor.py
//   GET  /api/v1/auth/2fa/status  -> {enabled}
//   POST /api/v1/auth/2fa/send    -> {sent, email_hint}  (body: {purpose: "enable"})
//   POST /api/v1/auth/2fa/verify  -> {verified, two_factor_enabled}  (body: {code, purpose})
//   POST /api/v1/auth/2fa/disable -> {two_factor_enabled: false}
export default function SecuritySettingsPage() {
  const { t } = useTranslation();
  const { profile, updateProfile, loading: authLoading } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushEnabledJustNow, setPushEnabledJustNow] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowserPermission(currentNotificationPermission());
  }, []);

  async function load() {
    try {
      const data = await apiClient.get<{ enabled: boolean }>("/api/v1/auth/2fa/status");
      setEnabled(data.enabled);
    } catch (err) {
      setError((err as ApiError).message || t("web:settings.security.loadFailedDefault", { defaultValue: "Couldn't load your security settings." }));
    }
  }

  useEffect(() => {
    if (authLoading) return;
    // Intentional fetch-on-mount — load() sets state once its async GET
    // resolves, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  async function handleSendCode() {
    setSending(true);
    setError(null);
    try {
      const data = await apiClient.post<{ sent: boolean; email_hint: string }>("/api/v1/auth/2fa/send", {
        purpose: "enable",
      });
      setEmailHint(data.email_hint);
    } catch (err) {
      setError((err as ApiError).message || t("web:settings.security.sendCodeFailedDefault", { defaultValue: "Couldn't send a verification code right now." }));
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
      setError((err as ApiError).message || t("web:settings.security.verifyFailedDefault", { defaultValue: "That code didn't work — try sending a new one." }));
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
      setError((err as ApiError).message || t("web:settings.security.disableFailedDefault", { defaultValue: "Couldn't disable two-factor authentication right now." }));
    } finally {
      setDisabling(false);
    }
  }

  // Plain notification PREFERENCE flag shared with mobile (PATCH /api/users/me
  // -> notifications_enabled) -- not a browser Push API / service-worker
  // subscription. Actual browser push delivery is a separate, larger feature
  // and out of scope here; this just persists the same on/off preference
  // mobile has always stored for this account.
  async function handleToggleNotifications() {
    if (!profile || savingNotifications) return;
    setSavingNotifications(true);
    setError(null);
    try {
      await updateProfile({ notificationsEnabled: !profile.notificationsEnabled });
    } catch (err) {
      setError((err as ApiError).message || t("web:settings.security.toggleNotificationsFailedDefault", { defaultValue: "Couldn't update your notification preference right now." }));
    } finally {
      setSavingNotifications(false);
    }
  }

  // Real browser push permission + FCM token registration — distinct from
  // `profile.notificationsEnabled` above, which is just a server-side
  // preference flag shared with mobile. A user can have the preference on
  // but never have granted the browser permission (nothing to deliver to
  // yet), or vice versa; this card and its own state track the browser side
  // specifically. See lib/messaging.ts for the full flow and why
  // `isPushConfigured` can be false (missing VAPID key).
  async function handleEnablePush() {
    setEnablingPush(true);
    setPushError(null);
    setPushEnabledJustNow(false);
    try {
      const result = await enableWebPush();
      setBrowserPermission(currentNotificationPermission());
      if (result.ok) {
        setPushEnabledJustNow(true);
      } else if (result.reason === "permission-denied") {
        setPushError(t("web:settings.security.pushPermissionDenied", { defaultValue: "Notifications are blocked for this site — enable them in your browser's site settings." }));
      } else if (result.reason === "unsupported") {
        setPushError(t("web:settings.security.pushUnsupported", { defaultValue: "Push notifications aren't supported in this browser." }));
      } else {
        setPushError(t("web:settings.security.pushEnableFailedDefault", { defaultValue: "Couldn't enable push notifications right now." }));
      }
    } finally {
      setEnablingPush(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:settings.security.title", { defaultValue: "Security" })}
            subtitle={t("web:settings.security.subtitle", { defaultValue: "Protect your account with email-code two-factor authentication." })}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                <EvaIcon name="shield-outline" size={20} />
              </span>
              <div>
                <h2 className="font-semibold text-primary">{t("web:settings.security.twoFactorTitle", { defaultValue: "Two-factor authentication" })}</h2>
                {enabled === null ? (
                  <SkeletonText width="w-56" className="mt-1" />
                ) : (
                  <p className="text-sm text-hint">
                    {enabled
                      ? t("web:settings.security.twoFactorEnabledDescription", { defaultValue: "Enabled — a code is sent to your email at login." })
                      : t("web:settings.security.twoFactorDisabledDescription", { defaultValue: "Not enabled." })}
                  </p>
                )}
              </div>
            </div>

            {enabled === true && (
              <Button variant="outline" onClick={handleDisable} disabled={disabling} className="w-fit">
                {disabling ? t("web:settings.security.disabling", { defaultValue: "Disabling…" }) : t("web:settings.security.disable2fa", { defaultValue: "Disable 2FA" })}
              </Button>
            )}

            {enabled === false && !emailHint && (
              <Button onClick={handleSendCode} disabled={sending} className="w-fit">
                {sending ? t("web:settings.security.sending", { defaultValue: "Sending…" }) : t("web:settings.security.enable2fa", { defaultValue: "Enable 2FA" })}
              </Button>
            )}

            {enabled === false && emailHint && (
              <form onSubmit={handleVerify} className="flex flex-col gap-3">
                <p className="text-sm text-hint">{t("web:settings.security.codeSentTo", { defaultValue: "Enter the code sent to {{email}}.", email: emailHint })}</p>
                <TextField
                  label={t("web:settings.security.verificationCodeLabel", { defaultValue: "Verification code" })}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                <Button type="submit" disabled={verifying || !code.trim()} className="w-fit">
                  {verifying
                    ? t("web:settings.security.verifying", { defaultValue: "Verifying…" })
                    : t("web:settings.security.verifyAndEnable", { defaultValue: "Verify & enable" })}
                </Button>
              </form>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-2 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-orange text-tint-orange-text">
                <EvaIcon name="bell-outline" size={20} />
              </span>
              <div>
                <h2 className="font-semibold text-primary">{t("web:settings.security.pushNotificationsTitle", { defaultValue: "Push notifications" })}</h2>
                <p className="text-sm text-hint">
                  {t("web:settings.security.pushNotificationsDescription", {
                    defaultValue: "Notify me about job matches, interview reminders, and coach follow-ups.",
                  })}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!profile?.notificationsEnabled}
              disabled={!profile || savingNotifications}
              onClick={handleToggleNotifications}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer appearance-none items-center rounded-pill border-0 p-0 outline-none transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                profile?.notificationsEnabled ? "bg-brand" : "bg-surface-4"
              }`}
            >
              <span
                className={`pointer-events-none absolute left-0.5 h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ease-in-out ${
                  profile?.notificationsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Real browser push (distinct from the preference toggle above)
              — requests Notification permission, registers this browser
              with FCM, and posts the device token to the backend. See
              lib/messaging.ts's own comment for why this no-ops gracefully
              when NEXT_PUBLIC_FIREBASE_VAPID_KEY isn't set yet. */}
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="flash-outline" size={20} />
              </span>
              <div>
                <h2 className="font-semibold text-primary">{t("web:settings.security.browserPushTitle", { defaultValue: "Browser push notifications" })}</h2>
                <p className="text-sm text-hint">
                  {t("web:settings.security.browserPushDescription", {
                    defaultValue: "Get real-time alerts in this browser, even when Saveur isn't open in a tab.",
                  })}
                </p>
              </div>
            </div>

            {!isPushConfigured && (
              <p className="text-sm text-hint">
                {t("web:settings.security.pushNotConfigured", { defaultValue: "Push notifications aren't configured yet — check back soon." })}
              </p>
            )}

            {isPushConfigured && browserPermission === "granted" && !pushEnabledJustNow && (
              <p className="text-sm text-hint">
                {t("web:settings.security.pushAlreadyGranted", { defaultValue: "Browser notifications are allowed for this site." })}
              </p>
            )}

            {isPushConfigured && pushEnabledJustNow && (
              <p className="text-sm text-brand">{t("web:settings.security.pushEnabled", { defaultValue: "Push notifications enabled for this browser." })}</p>
            )}

            {isPushConfigured && browserPermission === "denied" && (
              <p className="text-sm text-danger">
                {t("web:settings.security.pushPermissionDenied", { defaultValue: "Notifications are blocked for this site — enable them in your browser's site settings." })}
              </p>
            )}

            {pushError && browserPermission !== "denied" && <p className="text-sm text-danger">{pushError}</p>}

            {isPushConfigured && browserPermission !== "denied" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnablePush}
                disabled={enablingPush || browserPermission === "unsupported"}
                className="w-fit"
              >
                {enablingPush
                  ? t("web:settings.security.enablingPush", { defaultValue: "Enabling…" })
                  : t("web:settings.security.enablePush", { defaultValue: "Enable browser push" })}
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
