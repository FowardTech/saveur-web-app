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
import * as studentVerificationService from "@/lib/studentVerificationService";

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
  const { profile, updateProfile, isPro, isPremium, deleteAccount } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");
  const [hobbies, setHobbies] = useState("");
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

  // Verified-student badge (mirrors mobile's src/more/ProfileSrc.tsx —
  // product report: "I noticed that you did not implement the student
  // package in the onboarding and in the dashboard. Why?"). Shown until
  // graduation; see app/settings/student/page.tsx for the actual
  // verification flow this links to.
  const [studentDiscountActive, setStudentDiscountActive] = useState(false);
  useEffect(() => {
    studentVerificationService.getStatus().then((status) => {
      setStudentDiscountActive(!!status?.studentDiscountActive);
    });
  }, []);

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
      setBio(profile.bio || "");
      setHobbies(profile.hobbies || "");
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
      await updateProfile({ name: name.trim(), phoneNumber: phone.trim(), homeAddress: address.trim(), bio: bio.trim(), hobbies: hobbies.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as ApiError).message || t("web:settings.profile.saveFailedDefault", { defaultValue: "Couldn't save your profile right now." }));
    } finally {
      setSaving(false);
    }
  }

  // BUG FIX (product report: "You did not add delete account to the
  // profile screen in the web app") — DELETE /api/users/me already existed
  // server-side and mobile's src/more/ProfileSrc.tsx has always exposed it;
  // web's AuthProvider just never wired up an equivalent, so there was
  // nowhere in the web UI to reach it at all. Same confirm-then-delete flow
  // as mobile, using window.confirm() -- the same lightweight destructive-
  // action pattern this app already uses elsewhere (e.g. app/practice/
  // coding/projects/page.tsx's onDelete) rather than a one-off modal built
  // just for this. No explicit redirect after success: deleteAccount()
  // signs out locally, and RequireAuth's own effect already redirects to
  // /login the moment firebaseUser goes null, same as UserMenu.tsx's plain
  // sign-out button relies on.
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  async function onDeleteAccount() {
    const confirmed = window.confirm(
      isPro
        ? t("web:settings.profile.deleteAccountConfirmPro", {
            defaultValue:
              "Permanently delete your account? This can't be undone. It will also cancel your subscription immediately — you'll lose access right away, not at the end of your billing period.",
          }).toString()
        : t("web:settings.profile.deleteAccountConfirm", {
            defaultValue: "Permanently delete your account? This can't be undone. All of your data will be permanently deleted.",
          }).toString(),
    );
    if (!confirmed || isDeletingAccount) return;
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setDeleteError((err as ApiError).message || t("web:settings.profile.deleteAccountFailedDefault", { defaultValue: "Couldn't delete your account. Please try again in a moment." }));
      setIsDeletingAccount(false);
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

          {studentDiscountActive && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-pill border border-brand/30 bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand">
              <EvaIcon name="award-outline" size={14} />
              {t("web:settings.profile.studentBadge", { defaultValue: "Verified Student" })}
            </span>
          )}

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
            {/* "Getting Started" checklist fields (product report: "the app
                should suggest important steps to the user... Tell us about
                yourself... Whats are your hobbies") — filling these in is
                what marks those two checklist items done, see
                components/dashboard/GettingStartedChecklist.tsx. */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-primary">{t("web:settings.profile.bioLabel", { defaultValue: "Tell us about yourself" })}</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t("web:settings.profile.bioPlaceholder", { defaultValue: "A short intro — your background, what you're working toward, anything you'd want a coach to know." })}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-primary">{t("web:settings.profile.hobbiesLabel", { defaultValue: "What do you like to do in your free time?" })}</span>
              <textarea
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
                placeholder={t("web:settings.profile.hobbiesPlaceholder", { defaultValue: "Hobbies, interests, anything outside of work." })}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
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

          {/* Danger zone -- mirrors mobile's src/more/ProfileSrc.tsx, which
              deliberately moved this off the top-level Settings list onto
              the Profile screen so it's not a single careless tap away. */}
          <div className="flex flex-col gap-3 rounded-card border border-danger/30 bg-surface-2 p-6">
            <div>
              <h2 className="font-semibold text-danger">{t("web:settings.profile.dangerZoneTitle", { defaultValue: "Danger zone" })}</h2>
              <p className="text-sm text-hint">
                {t("web:settings.profile.dangerZoneSubtitle", { defaultValue: "Permanently delete your account and all associated data. This cannot be undone." })}
              </p>
            </div>
            {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
            <Button
              type="button"
              variant="outline"
              onClick={onDeleteAccount}
              disabled={isDeletingAccount}
              className="w-fit border-danger text-danger hover:bg-danger/10"
            >
              <EvaIcon name="trash-2-outline" size={16} />
              {isDeletingAccount
                ? t("web:settings.profile.deletingAccount", { defaultValue: "Deleting account…" })
                : t("web:settings.profile.deleteAccount", { defaultValue: "Delete Account" })}
            </Button>
          </div>
          </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
