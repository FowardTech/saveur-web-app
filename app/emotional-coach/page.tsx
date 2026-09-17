"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

// Web port of mobile's src/more/EmotionalCoach.tsx (product report: "Looks
// like the emotional coach is not implemented in the Web app. The AI coach
// tried to navigate me there but it did not go" -- lib/suggestedActions.ts
// used to list "emotional_coach" among ids with no web page at all).
//
// Real backend contract — Saveur-Backend/app/api/emotional_coach.py:
//   POST /api/v1/emotional-coach/check-in  body {mood, note?, language?}
//     -> {id, mood, note, ai_response, suggested_actions: [str], created_at}
//   GET  /api/v1/emotional-coach/history -> {items: [same shape]}
// A one-shot mood check-in (not a multi-turn chat, not a journal) — pick
// how you're feeling about your job search + an optional note, get a
// single supportive AI response and 0-3 suggested actions, saved to a
// running history list. Premium-only (@require_premium on check-in;
// mobile also gates the whole screen client-side on isPremium, same
// pattern this page follows).
type Mood = "great" | "okay" | "stressed" | "overwhelmed" | "discouraged";

const MOODS: { id: Mood; emoji: string; labelKey: string; defaultLabel: string }[] = [
  { id: "great", emoji: "😄", labelKey: "web:emotionalCoach.moods.great", defaultLabel: "Great" },
  { id: "okay", emoji: "🙂", labelKey: "web:emotionalCoach.moods.okay", defaultLabel: "Okay" },
  { id: "stressed", emoji: "😥", labelKey: "web:emotionalCoach.moods.stressed", defaultLabel: "Stressed" },
  { id: "overwhelmed", emoji: "😩", labelKey: "web:emotionalCoach.moods.overwhelmed", defaultLabel: "Overwhelmed" },
  { id: "discouraged", emoji: "😞", labelKey: "web:emotionalCoach.moods.discouraged", defaultLabel: "Discouraged" },
];

interface MoodCheckIn {
  id: string;
  mood: Mood;
  note?: string | null;
  ai_response: string;
  suggested_actions: string[];
  created_at: string;
}

export default function EmotionalCoachPage() {
  const { t, i18n } = useTranslation();
  const { isPremium, loading: authLoading } = useAuth();

  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<MoodCheckIn | null>(null);

  const [history, setHistory] = useState<MoodCheckIn[] | null>(null);

  function loadHistory() {
    apiClient
      .get<{ items: MoodCheckIn[] }>("/api/v1/emotional-coach/history")
      .then((data) => setHistory(data.items || []))
      .catch(() => setHistory([]));
  }

  useEffect(() => {
    if (authLoading || !isPremium) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isPremium]);

  async function handleCheckIn() {
    if (!mood || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.post<MoodCheckIn>("/api/v1/emotional-coach/check-in", {
        mood,
        note: note.trim() || undefined,
        language: i18n.language || "en",
      });
      setLatest(result);
      setMood(null);
      setNote("");
      loadHistory();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || t("web:emotionalCoach.checkInFailedDefault", { defaultValue: "Couldn't check in right now. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  }

  function moodMeta(m: Mood) {
    return MOODS.find((x) => x.id === m);
  }

  if (authLoading) return null;

  if (!isPremium) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <PageHeader
              title={t("web:emotionalCoach.title", { defaultValue: "Emotional Coach" })}
              subtitle={t("web:emotionalCoach.subtitle", { defaultValue: "A supportive check-in for how your job search is really going." })}
            />
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-rose text-tint-rose-text">
                <EvaIcon name="heart-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:emotionalCoach.premiumRequiredTitle", { defaultValue: "Emotional Coach is a Premium feature" })}</h2>
              <p className="text-sm text-hint">
                {t("web:emotionalCoach.premiumRequiredSubtitle", {
                  defaultValue: "Upgrade to Saveur Premium for a private, supportive mood check-in whenever the job search feels like a lot.",
                })}
              </p>
            </div>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  const historyExcludingLatest = (history ?? []).filter((h) => h.id !== latest?.id);

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:emotionalCoach.title", { defaultValue: "Emotional Coach" })}
            subtitle={t("web:emotionalCoach.subtitle", { defaultValue: "A supportive check-in for how your job search is really going." })}
          />

          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <h2 className="font-semibold text-primary">
              {t("web:emotionalCoach.prompt", { defaultValue: "How are you feeling about your job search today?" })}
            </h2>

            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(m.id)}
                  className={`flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-sm font-medium transition ${
                    mood === m.id ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface-1 text-primary hover:bg-surface-3"
                  }`}
                >
                  <span className="text-base">{m.emoji}</span>
                  {t(m.labelKey, { defaultValue: m.defaultLabel })}
                </button>
              ))}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={t("web:emotionalCoach.notePlaceholder", { defaultValue: "What's on your mind? (optional)" })}
              className="w-full resize-none rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="button" onClick={handleCheckIn} disabled={!mood || submitting} className="w-fit">
              {submitting ? t("web:emotionalCoach.checkingIn", { defaultValue: "Checking in…" }) : t("web:emotionalCoach.checkIn", { defaultValue: "Check In" })}
            </Button>
          </div>

          {latest && (
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-tint-rose text-tint-rose-text">
                  <EvaIcon name="heart-outline" size={16} />
                </span>
                <h2 className="font-semibold text-primary">{t("web:emotionalCoach.coachSays", { defaultValue: "Your coach says" })}</h2>
              </div>
              <p className="whitespace-pre-wrap text-sm text-primary">{latest.ai_response}</p>
              {latest.suggested_actions && latest.suggested_actions.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {latest.suggested_actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-primary">
                      <EvaIcon name="checkmark-circle-2-outline" size={16} className="mt-0.5 shrink-0 text-tint-mint-text" />
                      {action}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-primary">{t("web:emotionalCoach.pastCheckIns", { defaultValue: "Past Check-ins" })}</h2>
            {history === null && <SkeletonRows count={3} />}
            {history !== null && historyExcludingLatest.length === 0 && (
              <p className="rounded-card border border-border bg-surface-2 p-6 text-center text-sm text-hint">
                {t("web:emotionalCoach.noHistory", { defaultValue: "Your past check-ins will show up here." })}
              </p>
            )}
            {historyExcludingLatest.length > 0 && (
              <div className="flex flex-col gap-2">
                {historyExcludingLatest.map((h) => {
                  const meta = moodMeta(h.mood);
                  return (
                    <div key={h.id} className="flex items-start gap-3 rounded-card border border-border bg-surface-2 p-4">
                      <span className="text-lg">{meta?.emoji ?? "🙂"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary">
                          {meta ? t(meta.labelKey, { defaultValue: meta.defaultLabel }) : h.mood}
                        </p>
                        {h.note && <p className="mt-0.5 text-sm text-hint">{h.note}</p>}
                        <p className="mt-1 text-xs text-hint">{new Date(h.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
