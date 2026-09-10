"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { SkeletonInput } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import type { ApiError } from "@/lib/apiClient";

// Same target-role/country list job onboarding & Job Alerts already use
// (see mobile's JobPreferences.tsx and Saveur-Backend's app/api/users.py's
// job_role_country_caps) — "change it later" for what SignupSecondStep
// collects once at signup, which had no edit path on web at all before this.
const COUNTRY_OPTIONS = ["United States", "United Kingdom", "Canada", "Germany", "France", "Remote"];

// Edits name/phone/address via PATCH /api/v1/users/me (see
// Saveur-Backend/app/api/users.py's update_me()) — mirrors mobile's
// EditProfile.tsx field set. Email is read-only (tied to the Firebase
// account, not editable from a profile form on either client).
export default function ProfileSettingsPage() {
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [rolesText, setRolesText] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    // Syncs the form fields from the async-loaded profile once it arrives —
    // can't be a lazy useState initializer since `profile` is still null on
    // first render while the backend call is in flight.
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(profile.name || "");
      setPhone(profile.phoneNumber || "");
      setAddress(profile.homeAddress || "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRolesText((profile.desiredRoles || []).join(", "));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountries(profile.preferredCountries || []);
    }
  }, [profile]);

  function toggleCountry(country: string) {
    setCountries((prev) => (prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]));
  }

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    setError(null);
    setPrefsSaved(false);
    try {
      const roles = rolesText.split(",").map((r) => r.trim()).filter(Boolean);
      await updateProfile({ desiredRoles: roles, preferredCountries: countries });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } catch (err) {
      setError((err as ApiError).message || t("web:settings.profile.savePrefsFailedDefault", { defaultValue: "Couldn't save your target roles/countries right now." }));
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ name: name.trim(), phoneNumber: phone.trim(), homeAddress: address.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as ApiError).message || t("web:settings.profile.saveFailedDefault", { defaultValue: "Couldn't save your profile right now." }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:settings.profile.title", { defaultValue: "Profile" })}
            subtitle={t("web:settings.profile.subtitle", { defaultValue: "Update your account details." })}
          />

          {!profile && (
            <>
              <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
                <SkeletonInput />
                <SkeletonInput />
                <SkeletonInput />
                <SkeletonInput />
              </div>
              <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
                <SkeletonInput />
                <SkeletonInput />
              </div>
            </>
          )}

          {profile && (
          <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <TextField label={t("common:fields.fullName", { defaultValue: "Full name" })} value={name} onChange={(e) => setName(e.target.value)} required />
            <TextField label={t("common:fields.email", { defaultValue: "Email" })} value={profile?.email || ""} disabled className="opacity-60" />
            <TextField
              label={t("web:settings.profile.phoneLabel", { defaultValue: "Phone number" })}
              placeholder={t("web:settings.profile.optional", { defaultValue: "Optional" })}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <TextField
              label={t("web:settings.profile.addressLabel", { defaultValue: "Home address" })}
              placeholder={t("web:settings.profile.optional", { defaultValue: "Optional" })}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            {saved && <p className="text-sm text-success-text">{t("web:settings.profile.saved", { defaultValue: "Saved." })}</p>}
            <Button type="submit" disabled={saving} className="mt-1 w-full">
              {saving ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("web:settings.profile.saveChanges", { defaultValue: "Save changes" })}
            </Button>
          </form>

          {/* Mobile: src/more/JobPreferences.tsx — "change it later" for
              the target roles/countries collected once at signup. Reuses
              the same PATCH /api/v1/users/me desired_roles/
              preferred_countries fields Job Alerts' own preferences form
              already writes to (this is the fuller editor; Job Alerts'
              is a quick inline shortcut to the same data). */}
          <form onSubmit={handleSavePreferences} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <div>
              <h2 className="font-semibold text-primary">{t("web:settings.profile.jobPreferencesTitle", { defaultValue: "Target roles & countries" })}</h2>
              <p className="text-sm text-hint">{t("web:settings.profile.jobPreferencesSubtitle", { defaultValue: "Used for Job Alerts, Career Events, and your AI Career Roadmap." })}</p>
            </div>
            <TextField
              label={t("web:jobAlerts.targetRolesLabel", { defaultValue: "Target roles (comma-separated)" })}
              placeholder={t("web:jobAlerts.targetRolesPlaceholder", { defaultValue: "e.g. Backend Engineer, Product Manager" })}
              value={rolesText}
              onChange={(e) => setRolesText(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-primary">{t("web:settings.profile.preferredCountriesLabel", { defaultValue: "Preferred countries" })}</span>
              <div className="flex flex-wrap gap-2">
                {COUNTRY_OPTIONS.map((country) => (
                  <button
                    key={country}
                    type="button"
                    onClick={() => toggleCountry(country)}
                    className={`rounded-pill border px-3 py-1.5 text-sm transition ${
                      countries.includes(country)
                        ? "border-brand bg-brand/10 text-brand font-medium"
                        : "border-border text-hint hover:bg-surface-3"
                    }`}
                  >
                    {t(`common:countries.${country}`, { defaultValue: country })}
                  </button>
                ))}
              </div>
            </div>
            {prefsSaved && <p className="text-sm text-success-text">{t("web:settings.profile.saved", { defaultValue: "Saved." })}</p>}
            <Button type="submit" disabled={savingPrefs} className="mt-1 w-fit">
              {savingPrefs ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("web:settings.profile.saveChanges", { defaultValue: "Save changes" })}
            </Button>
          </form>
          </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
