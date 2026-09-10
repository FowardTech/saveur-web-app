"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { BrandLockup } from "@/components/shell/BrandLockup";
import { CAREER_GOALS } from "@/lib/careerGoalLabels";
import { COUNTRIES } from "@/lib/countries";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { jobRoleCountryCaps } from "@/lib/jobPreferenceCaps";
import { ChooseUsernameStep } from "@/components/auth/ChooseUsernameStep";

// Step 0 is the "choose your username" step (see ChooseUsernameStep) — ports
// mobile's src/auth/Signup/ChooseUsername.tsx, which SignupThirdStep.tsx's
// goToUsernameStep shows as a distinct screen immediately after account
// creation, before the rest of the signup/onboarding wizard. Web's account
// creation happens earlier (in /register, or the Google/LinkedIn button
// handlers) and every one of those paths already routes a brand-new user
// straight to /onboarding — rather than duplicating a username step at each
// of those three separate call sites, it lives here as this wizard's first
// step, which is the single point they all funnel through and matches the
// "right after account creation, before the rest of onboarding" timing.
// Steps 1-3 (previously 0-2) are the pre-existing name/goals/roles/countries
// wizard, unchanged apart from shifting their step indices by one.
const TOTAL_STEPS = 5;

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill border px-4 py-2 text-sm font-medium transition ${
        selected
          ? "border-brand bg-brand/10 text-brand"
          : "border-border bg-surface-1 text-hint hover:border-brand/50 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, loading, updateProfile, isPro, isPremium } = useAuth();

  // Real per-tier caps (Saveur-Backend's entitlements_service.
  // job_role_country_caps, mirrored via lib/jobPreferenceCaps.ts) — a
  // brand-new signup has no subscription yet (isPro/isPremium both false
  // this early), so this lands on the same free-tier 5 roles/3 countries
  // mobile's SignupSecondStep.tsx hardcodes for the identical reason (see
  // that file's own comment: "there's no signed-in subscription to read
  // yet"). Replaces the previous flat `MAX_ROLES = 5` constant, which had
  // no tier awareness at all, and the previously fully-uncapped countries
  // step.
  const { maxDesiredRoles: MAX_ROLES, maxPreferredCountries: MAX_COUNTRIES } = jobRoleCountryCaps(isPro, isPremium);

  // Real 10-option career-goal list — mirrors mobile's single source of
  // truth (utils/careerGoalLabels.ts's CAREER_GOALS, used by both
  // src/auth/Signup/SignupFirstStep.tsx and src/more/ChangeCareType/
  // index.tsx), via lib/careerGoalLabels.ts's shared web port.
  //
  // BUG FIX (same class of bug mobile's own careerGoalLabels.ts header
  // comment documents fixing there): each chip's VALUE (what gets toggled
  // into `goals` state and persisted via updateProfile) must be the stable
  // English `defaultValue`, never the already-translated `label` — a value
  // baked into whatever language was active at save time could never be
  // re-translated on a later language switch, and app/progress/page.tsx's
  // goal chips (getCareerGoalLabel) depend on profile.goals containing this
  // exact stable id to look the translated label back up.
  const GOALS = CAREER_GOALS.map((g) => ({
    value: g.defaultValue,
    label: t(`web:onboarding.goals.${g.key}`, { defaultValue: g.defaultValue }),
  }));
  // COUNTRIES (lib/countries.ts) stays a fixed list of stable English
  // canonical values — what's actually persisted via updateProfile — this
  // just looks up a display label for the active language, same pattern
  // mobile's countryLabel() helper uses (SignupSecondStep.tsx /
  // JobPreferences.tsx), falling back to the English name itself.
  const countryLabel = (country: string) => t(`common:countries.${country}`, { defaultValue: country });

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [countryQuery, setCountryQuery] = useState("");
  const [capMessage, setCapMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q) || countryLabel(c).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryQuery]);

  useEffect(() => {
    // Syncs the name field from the async-loaded profile once it arrives —
    // legitimately can't be a lazy useState initializer since `profile` is
    // still null on first render while the backend call is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  useEffect(() => {
    if (!loading && !profile) {
      router.replace("/login");
    }
  }, [loading, profile, router]);

  function toggleGoal(goal: string) {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
  }

  // Same tier-aware cap enforcement mobile's toggleCountry (JobPreferences.
  // tsx / SignupSecondStep.tsx) applies — shows an inline "that's the max
  // for now" message (mobile uses Alert.alert; web surfaces the same copy
  // inline under the list) with an upsell note once the user hits the cap,
  // rather than silently no-op'ing past it.
  function toggleCountry(country: string) {
    setCountries((prev) => {
      if (prev.includes(country)) return prev.filter((c) => c !== country);
      if (prev.length >= MAX_COUNTRIES) {
        setCapMessage(
          t("web:onboarding.step3.maxReached", {
            defaultValue: isPremium
              ? "You can pick up to {{max}} countries at once. Remove one to add another."
              : "You can pick up to {{max}} countries at once on your current plan. Upgrade to Premium to target up to 10.",
            max: MAX_COUNTRIES,
          }),
        );
        return prev;
      }
      setCapMessage(null);
      return [...prev, country];
    });
  }

  function addRole() {
    const value = roleInput.trim();
    if (!value) return;
    if (roles.length >= MAX_ROLES && !roles.includes(value)) {
      setCapMessage(
        t("web:onboarding.step2.maxReached", {
          defaultValue: isPremium
            ? "You can target up to {{max}} roles at once. Remove one to add another."
            : "You can target up to {{max}} roles at once on your current plan. Upgrade to Premium to target up to 10.",
          max: MAX_ROLES,
        }),
      );
      return;
    }
    if (roles.includes(value)) return;
    setCapMessage(null);
    setRoles((prev) => [...prev, value]);
    setRoleInput("");
  }

  function removeRole(role: string) {
    setRoles((prev) => prev.filter((r) => r !== role));
  }

  const canContinue =
    step === 1 ? name.trim().length > 0 : step === 2 ? goals.length > 0 : step === 3 ? roles.length > 0 : true;

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    try {
      await updateProfile({
        name: name.trim(),
        goals,
        desiredRoles: roles,
        preferredCountries: countries,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = getErrorMessage(err, t("web:onboarding.saveFailedDefault", { defaultValue: "Something went wrong saving your profile. Please try again." }));
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="px-6 py-5">
        <BrandLockup size={28} textClassName="text-lg" />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl rounded-card border border-border bg-surface-2 p-6 shadow-sm sm:p-8">
          {/* progress */}
          <div className="mb-6 flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-pill ${i <= step ? "bg-brand" : "bg-surface-3"}`} />
            ))}
          </div>

          {step === 0 && (
            <ChooseUsernameStep onDone={() => setStep(1)} />
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold text-primary">{t("web:onboarding.step0.title", { defaultValue: "What should we call you?" })}</h1>
                <p className="mt-1 text-sm text-hint">{t("web:onboarding.step0.subtitle", { defaultValue: "Your name helps us personalize your coaching sessions." })}</p>
              </div>
              <TextField
                label={t("common:fields.fullName", { defaultValue: "Full name" })}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold text-primary">{t("web:onboarding.step1.title", { defaultValue: "What's your primary goal?" })}</h1>
                <p className="mt-1 text-sm text-hint">{t("web:onboarding.step1.subtitle", { defaultValue: "Pick everything that applies — this shapes your roadmap." })}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((goal) => (
                  <Chip key={goal.value} selected={goals.includes(goal.value)} onClick={() => toggleGoal(goal.value)}>
                    {goal.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold text-primary">{t("web:onboarding.step2.title", { defaultValue: "What roles are you targeting?" })}</h1>
                <p className="mt-1 text-sm text-hint">
                  {t("web:onboarding.step2.subtitle", { defaultValue: 'Add up to {{max}} roles, e.g. "Product Manager".', max: MAX_ROLES })}
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRole();
                    }
                  }}
                  placeholder={t("web:onboarding.step2.placeholder", { defaultValue: "Type a role and press Enter" })}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                />
                <Button type="button" variant="secondary" onClick={addRole}>
                  {t("common:actions.add", { defaultValue: "Add" })}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="flex items-center gap-1.5 rounded-pill bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand"
                  >
                    {role}
                    <button
                      type="button"
                      onClick={() => removeRole(role)}
                      aria-label={t("web:onboarding.step2.removeAria", { defaultValue: "Remove {{role}}", role })}
                    >
                      <EvaIcon name="close-circle-outline" size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-xs text-hint">
                {t("web:onboarding.step2.added", { defaultValue: "{{count}}/{{max}} added", count: roles.length, max: MAX_ROLES })}
              </p>
              {capMessage && <p className="text-xs font-medium text-warning-text">{capMessage}</p>}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold text-primary">{t("web:onboarding.step3.title", { defaultValue: "Where are you looking to work?" })}</h1>
                <p className="mt-1 text-sm text-hint">
                  {t("web:onboarding.step3.subtitle", {
                    defaultValue: "Select up to {{max}} countries you'd consider — optional.",
                    max: MAX_COUNTRIES,
                  })}
                </p>
              </div>

              {/* Searchable list (mirrors mobile's SignupSecondStep.tsx /
                  JobPreferences.tsx — a flat chip cloud doesn't scale to
                  the full ~70-country list) with round flag badges beside
                  each name (product request: "when users are selecting
                  countries during signup they should also see the flags of
                  those countries beside them"). */}
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
              {capMessage && <p className="text-xs font-medium text-warning-text">{capMessage}</p>}

              <div className="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-border">
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
          )}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          {/* Step 0 (username) has its own Skip/Continue actions built into
              ChooseUsernameStep — it does its own async work (regenerate,
              or validate+save a custom handle) before calling onDone(),
              which this shared bottom nav can't drive, so it's hidden
              rather than duplicated for that step. */}
          {step > 0 && (
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCapMessage(null);
                  setStep((s) => Math.max(0, s - 1));
                }}
                className={step === 1 ? "invisible" : ""}
              >
                {t("common:actions.back", { defaultValue: "Back" })}
              </Button>
              {step < TOTAL_STEPS - 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    setCapMessage(null);
                    setStep((s) => s + 1);
                  }}
                  disabled={!canContinue}
                >
                  {t("common:actions.continue", { defaultValue: "Continue" })}
                </Button>
              ) : (
                <Button type="button" onClick={handleFinish} disabled={submitting}>
                  {submitting ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("common:actions.finish", { defaultValue: "Finish" })}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
