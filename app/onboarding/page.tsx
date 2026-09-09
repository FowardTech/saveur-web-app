"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

const GOALS = ["Land a new job", "Switch careers", "Get promoted", "Prep for interviews"];
const COUNTRIES = ["United States", "United Kingdom", "Canada", "Germany", "France", "Remote"];
const MAX_ROLES = 5;
const TOTAL_STEPS = 4;

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
  const router = useRouter();
  const { profile, loading, updateProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function toggleCountry(country: string) {
    setCountries((prev) => (prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]));
  }

  function addRole() {
    const value = roleInput.trim();
    if (!value || roles.length >= MAX_ROLES || roles.includes(value)) return;
    setRoles((prev) => [...prev, value]);
    setRoleInput("");
  }

  function removeRole(role: string) {
    setRoles((prev) => prev.filter((r) => r !== role));
  }

  const canContinue =
    step === 0 ? name.trim().length > 0 : step === 1 ? goals.length > 0 : step === 2 ? roles.length > 0 : true;

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
      const message = err instanceof Error ? err.message : "Something went wrong saving your profile. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="px-6 py-5">
        <span className="text-lg font-bold tracking-tight text-primary">
          Saveur<span className="text-brand">.</span>
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-lg rounded-card border border-border bg-surface-2 p-6 shadow-sm sm:p-8">
          {/* progress */}
          <div className="mb-6 flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-pill ${i <= step ? "bg-brand" : "bg-surface-3"}`} />
            ))}
          </div>

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold text-primary">What should we call you?</h1>
                <p className="mt-1 text-sm text-hint">Your name helps us personalize your coaching sessions.</p>
              </div>
              <TextField label="Full name" name="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold text-primary">What&apos;s your primary goal?</h1>
                <p className="mt-1 text-sm text-hint">Pick everything that applies — this shapes your roadmap.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((goal) => (
                  <Chip key={goal} selected={goals.includes(goal)} onClick={() => toggleGoal(goal)}>
                    {goal}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold text-primary">What roles are you targeting?</h1>
                <p className="mt-1 text-sm text-hint">Add up to {MAX_ROLES} roles, e.g. &quot;Product Manager&quot;.</p>
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
                  placeholder="Type a role and press Enter"
                  disabled={roles.length >= MAX_ROLES}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                />
                <Button type="button" variant="secondary" onClick={addRole} disabled={roles.length >= MAX_ROLES}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="flex items-center gap-1.5 rounded-pill bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand"
                  >
                    {role}
                    <button type="button" onClick={() => removeRole(role)} aria-label={`Remove ${role}`}>
                      <EvaIcon name="close-circle-outline" size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-xs text-hint">{roles.length}/{MAX_ROLES} added</p>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold text-primary">Where are you looking to work?</h1>
                <p className="mt-1 text-sm text-hint">Select every country you&apos;d consider — optional.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((country) => (
                  <Chip key={country} selected={countries.includes(country)} onClick={() => toggleCountry(country)}>
                    {country}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className={step === 0 ? "invisible" : ""}
            >
              Back
            </Button>
            {step < TOTAL_STEPS - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish} disabled={submitting}>
                {submitting ? "Saving…" : "Finish"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
