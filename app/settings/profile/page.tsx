"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { SkeletonInput } from "@/components/ui/Skeleton";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { useAuth } from "@/app/providers/AuthProvider";
import type { ApiError } from "@/lib/apiClient";
import { COUNTRIES } from "@/lib/countries";
import { jobRoleCountryCaps } from "@/lib/jobPreferenceCaps";

// Same real target-role/country list job onboarding (app/onboarding/
// page.tsx) & mobile's src/more/JobPreferences.tsx use — see lib/
// countries.ts's own header comment. This used to be a separate 6-item
// `COUNTRY_OPTIONS` stub that didn't match onboarding's own (different)
// 6-item stub either — two independently-drifting fakes for the same
// "change it later" screen mobile's JobPreferences.tsx describes.

// Edits name/phone/address via PATCH /api/v1/users/me (see
// Saveur-Backend/app/api/users.py's update_me()) — mirrors mobile's
// EditProfile.tsx field set. Email is read-only (tied to the Firebase
// account, not editable from a profile form on either client).
export default function ProfileSettingsPage() {
  const { t } = useTranslation();
  const { profile, updateProfile, isPro, isPremium } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Real per-tier caps (Saveur-Backend's entitlements_service.
  // job_role_country_caps, mirrored via lib/jobPreferenceCaps.ts) — replaces
  // this screen's previous total lack of any cap (rolesText was a raw
  // unbounded comma-separated free-text field, countries had no limit at
  // all). Mirrors mobile's src/more/JobPreferences.tsx exactly, including
  // its tier-aware messaging.
  const { maxDesiredRoles: MAX_ROLES, maxPreferredCountries: MAX_COUNTRIES } = jobRoleCountryCaps(isPro, isPremium);

  const [roleDraft, setRoleDraft] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [countryQuery, setCountryQuery] = useState("");
  const [capMessage, setCapMessage] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const countryLabel = (country: string) => t(`common:countries.${country}`, { defaultValue: country });

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q) || countryLabel(c).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryQuery]);

  useEffect(() => {
    // Syncs the form fields from the async-loaded profile once it arrives —
    // can't be a lazy useState initializer since `profile` is still null on
    // first render while the backend call is in flight.
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(profile.name || "");
      setPhone(profile.phoneNumber || "");
      setAddress(profile.homeAddress || "");
      // BUG FIX (same class of bug mobile's JobPreferences.tsx already
      // fixed, see that file's own comment: "the target roles and
      // countries... overrides... the cap in the job alert") — a profile
      // can have more roles/countries already saved than the CURRENT tier
      // allows (e.g. saved while on a higher tier, then downgraded).
      // Sliced to this account's real current-tier cap so this screen can
      // never display/re-save more than what's actually allowed right now.
      setRoles((profile.desiredRoles || []).slice(0, MAX_ROLES));
      setCountries((profile.preferredCountries || []).slice(0, MAX_COUNTRIES));
    }
  }, [profile, MAX_ROLES, MAX_COUNTRIES]);

  function upsellSuffix(kind: "roles" | "countries") {
    if (isPremium) return "";
    return kind === "roles"
      ? t("web:settings.profile.rolesUpsell", { defaultValue: " Upgrade to Premium to target up to 10." })
      : t("web:settings.profile.countriesUpsell", { defaultValue: " Upgrade to Premium to target up to 10." });
  }

  function addRole() {
    const value = roleDraft.trim();
    if (!value) return;
    if (roles.length >= MAX_ROLES && !roles.some((r) => r.toLowerCase() === value.toLowerCase())) {
      setCapMessage(
        t("web:settings.profile.maxRolesReached", {
          defaultValue: `You can target up to {{max}} roles at once.${upsellSuffix("roles")}`,
          max: MAX_ROLES,
        }),
      );
      return;
    }
    if (roles.some((r) => r.toLowerCase() === value.toLowerCase())) return;
    setCapMessage(null);
    setRoles((prev) => [...prev, value]);
    setRoleDraft("");
  }

  function removeRole(role: string) {
    setRoles((prev) => prev.filter((r) => r !== role));
  }

  function toggleCountry(country: string) {
    setCountries((prev) => {
      if (prev.includes(country)) return prev.filter((c) => c !== country);
      if (prev.length >= MAX_COUNTRIES) {
        setCapMessage(
          t("web:settings.profile.maxCountriesReached", {
            defaultValue: `You can pick up to {{max}} countries at once.${upsellSuffix("countries")}`,
            max: MAX_COUNTRIES,
          }),
        );
        return prev;
      }
      setCapMessage(null);
      return [...prev, country];
    });
  }

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    setError(null);
    setPrefsSaved(false);
    try {
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
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
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
              is a quick inline shortcut to the same data). Tier-gated the
              same way mobile's JobPreferences.tsx is — see
              lib/jobPreferenceCaps.ts. */}
          <form onSubmit={handleSavePreferences} className="flex flex-col gap-5 rounded-card border border-border bg-surface-2 p-6">
            <div>
              <h2 className="font-semibold text-primary">{t("web:settings.profile.jobPreferencesTitle", { defaultValue: "Target roles & countries" })}</h2>
              <p className="text-sm text-hint">{t("web:settings.profile.jobPreferencesSubtitle", { defaultValue: "Used for Job Alerts, Career Events, and your AI Career Roadmap." })}</p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-primary">{t("auth:desired_roles_title", { defaultValue: "Roles you're targeting" })}</span>
              <div className="flex gap-2">
                <input
                  value={roleDraft}
                  onChange={(e) => setRoleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRole();
                    }
                  }}
                  placeholder={t("auth:desired_roles_placeholder", { defaultValue: "Type a job title and add it" })}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <Button type="button" variant="secondary" onClick={addRole}>
                  {t("common:actions.add", { defaultValue: "Add" })}
                </Button>
              </div>
              {roles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <span key={role} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-3 px-3 py-1.5 text-sm font-medium text-primary">
                      {role}
                      <button type="button" onClick={() => removeRole(role)} aria-label={t("web:onboarding.step2.removeAria", { defaultValue: "Remove {{role}}", role })}>
                        <EvaIcon name="close-outline" size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-hint">{t("more:job_preferences_no_roles", { defaultValue: "No target roles added yet." })}</p>
              )}
              <p className="text-xs text-hint">
                {t("web:onboarding.step2.added", { defaultValue: "{{count}}/{{max}} added", count: roles.length, max: MAX_ROLES })}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-primary">{t("auth:preferred_countries_title", { defaultValue: "Countries you'd work in" })}</span>
              <input
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder={t("web:onboarding.step3.searchPlaceholder", { defaultValue: "Search countries" })}
                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {countries.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {countries.map((country) => (
                    <button
                      key={country}
                      type="button"
                      onClick={() => toggleCountry(country)}
                      className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-3 px-3 py-1.5 text-sm font-medium text-primary"
                    >
                      <CountryFlag country={country} size="sm" />
                      {countryLabel(country)}
                      <EvaIcon name="close-outline" size={14} />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-hint">
                {t("web:onboarding.step3.added", { defaultValue: "{{count}}/{{max}} added", count: countries.length, max: MAX_COUNTRIES })}
              </p>
              <div className="flex max-h-56 flex-col overflow-y-auto rounded-lg border border-border">
                {filteredCountries.map((country) => {
                  const selected = countries.includes(country);
                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() => toggleCountry(country)}
                      className={`flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5 text-left text-sm last:border-b-0 ${
                        selected ? "bg-brand/5 text-brand font-medium" : "text-primary hover:bg-surface-3"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CountryFlag country={country} size="sm" />
                        {countryLabel(country)}
                      </span>
                      {selected ? (
                        <EvaIcon name="checkmark-circle-2-outline" size={18} className="text-brand" />
                      ) : (
                        <span className="h-[18px] w-[18px] rounded-full border border-border" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {capMessage && <p className="text-sm font-medium text-warning-text">{capMessage}</p>}
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
