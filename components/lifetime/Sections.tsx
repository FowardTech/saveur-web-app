"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Pill } from "@/components/ui/Pill";
import { LocationSelect } from "@/components/ui/LocationFields";
import type { ApiError } from "@/lib/apiClient";
import * as svc from "@/lib/lifetimeService";

const card = "flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-4";
const textarea =
  "w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10";
const h = "text-sm font-semibold text-primary";

const fmt = (n: number, cur: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ${cur}`;
  }
};

/** Runs an async action, surfacing server errors (402 = paid plan). */
function useAction() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (e) {
        const err = e as ApiError;
        setError(
          err.status === 402 || err.status === 403
            ? t("web:lifetime.upgrade", { defaultValue: "This feature is part of a paid plan. Upgrade from the Subscription page." })
            : err.message || t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." })
        );
      } finally {
        setBusy(false);
      }
    },
    [t]
  );
  return { busy, error, run };
}

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <p className="rounded-card border border-border bg-surface-2 p-3 text-sm text-hint">{msg}</p> : null;
const Loading = () => <p className="py-8 text-center text-sm text-hint">…</p>;
const Bullets = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-5 text-sm text-primary">
    {items.map((x, i) => (
      <li key={i}>{x}</li>
    ))}
  </ul>
);

/* ---------------------------------------------------------------- hub */
export function Hub({ onOpen }: { onOpen: (tab: string) => void }) {
  const { t } = useTranslation();
  const [o, setO] = useState<svc.Overview | null>(null);
  useEffect(() => {
    svc.getOverview().then(setO).catch(() => {});
  }, []);
  const cards: { tab: string; title: string; body: string; color: string; badge?: string }[] = [
    { tab: "weekly", color: "#7C5CFF", title: t("web:lifetime.weeklyTitle", { defaultValue: "Weekly Check-in" }), body: o?.weekly_next_step ?? t("web:lifetime.weeklyCard", { defaultValue: "Review your week and get one concrete next step." }), badge: o && !o.weekly_checkin_done ? t("web:lifetime.due", { defaultValue: "Due" }) : undefined },
    { tab: "brag", color: "#19B87A", title: t("web:lifetime.bragTitle", { defaultValue: "Brag Document" }), body: t("web:lifetime.bragCard", { defaultValue: "Turn diary entries into promotion-ready achievements." }), badge: o?.brag_count ? String(o.brag_count) : undefined },
    { tab: "review", color: "#FF8A3D", title: t("web:lifetime.reviewTitle", { defaultValue: "Review & Promotion Prep" }), body: t("web:lifetime.reviewCard", { defaultValue: "Self-review draft, evidence and a manager rehearsal." }) },
    { tab: "pay", color: "#2F6BFF", title: t("web:lifetime.payTitle", { defaultValue: "Pay & Market Alerts" }), body: t("web:lifetime.payCard", { defaultValue: "A yearly benchmark and a nudge when pay falls behind." }), badge: o?.pay_behind ? t("web:lifetime.behind", { defaultValue: "Behind" }) : undefined },
    { tab: "market", color: "#00A6D6", title: t("web:lifetime.marketTitle", { defaultValue: "Job-market Watch" }), body: t("web:lifetime.marketCard", { defaultValue: "A quiet monthly list of roles that could be a step up." }) },
    { tab: "leadership", color: "#FF5FA2", title: t("web:lifetime.leadershipTitle", { defaultValue: "Leadership Track" }), body: t("web:lifetime.leadershipCard", { defaultValue: "1:1 prep, feedback scripts and difficult conversations." }) },
    { tab: "skills", color: "#F5B000", title: t("web:lifetime.skillsTitle", { defaultValue: "Skills & Certifications" }), body: t("web:lifetime.skillsCard", { defaultValue: "A roadmap to your next role, with reminders." }), badge: o?.skill_milestones_open ? String(o.skill_milestones_open) : undefined },
    { tab: "timeline", color: "#EF5350", title: t("web:lifetime.timelineTitle", { defaultValue: "Career Timeline" }), body: t("web:lifetime.timelineCard", { defaultValue: "Your wins, raises, roles and certificates in one place." }), badge: o?.timeline_count ? String(o.timeline_count) : undefined },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((c) => (
        <button
          key={c.tab}
          type="button"
          onClick={() => onOpen(c.tab)}
          style={{ backgroundColor: c.color }}
          className="flex flex-col gap-1 rounded-card p-5 text-left text-white transition hover:opacity-90"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-base font-bold">{c.title}</span>
            {c.badge && <span className="rounded-pill bg-white/25 px-2.5 py-0.5 text-xs font-bold">{c.badge}</span>}
          </span>
          <span className="line-clamp-2 text-sm text-white/90">{c.body}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- weekly */
export function Weekly() {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [data, setData] = useState<{ current_week_start: string; checkins: svc.WeeklyCheckin[] } | null>(null);
  const [reflection, setReflection] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await svc.getWeekly());
    } catch {
      setData({ current_week_start: "", checkins: [] });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (!data) return <Loading />;
  const current = data.checkins.find((c) => c.week_start === data.current_week_start);
  const past = data.checkins.filter((c) => c !== current);
  const generate = () =>
    run(async () => {
      await svc.generateWeekly(reflection.trim() || undefined);
      setReflection("");
      await load();
    });
  return (
    <div className="flex flex-col gap-4">
      <Err msg={error} />
      {current ? (
        <>
          <div className={card}>
            <p className="text-xs text-hint">{t("web:lifetime.weekOf", { defaultValue: "Week of {{date}}", date: current.week_start })}</p>
            <p className="text-base text-primary">{current.summary}</p>
            {current.wins.length > 0 && (<><h3 className={h}>{t("web:lifetime.wins", { defaultValue: "Wins" })}</h3><Bullets items={current.wins} /></>)}
            {current.learnings.length > 0 && (<><h3 className={h}>{t("web:lifetime.learnings", { defaultValue: "What you learned" })}</h3><Bullets items={current.learnings} /></>)}
            {current.focus_next_week && (<><h3 className={h}>{t("web:lifetime.focus", { defaultValue: "Focus for next week" })}</h3><p className="text-sm text-primary">{current.focus_next_week}</p></>)}
          </div>
          <div className="flex flex-col gap-2 rounded-card bg-[#7C5CFF] p-5 text-white">
            <span className="text-xs font-bold uppercase tracking-wide opacity-90">{t("web:lifetime.nextStep", { defaultValue: "Your one next step" })}</span>
            <h3 className="text-lg font-bold">{current.next_step.title}</h3>
            <p className="text-sm opacity-90">{current.next_step.why}</p>
            <p className="text-sm">{current.next_step.action}</p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={current.next_step_done}
                onChange={() => run(async () => { await svc.setStepDone(current.id, !current.next_step_done); await load(); })}
              />
              {current.next_step_done ? t("web:lifetime.stepDone", { defaultValue: "Done - nice work" }) : t("web:lifetime.markDone", { defaultValue: "Mark as done" })}
            </label>
          </div>
          {current.encouragement && <p className="text-center text-sm text-hint">{current.encouragement}</p>}
          <Button variant="outline" disabled={busy} onClick={generate}>
            {busy ? "…" : t("web:lifetime.redoCheckin", { defaultValue: "Redo this week's check-in" })}
          </Button>
        </>
      ) : (
        <div className={card}>
          <h3 className="font-semibold text-primary">{t("web:lifetime.checkinIntroTitle", { defaultValue: "Two minutes to review your week" })}</h3>
          <p className="text-sm text-hint">{t("web:lifetime.checkinIntroBody", { defaultValue: "We'll use your Career Diary, goals and wins, then give you one concrete next step. Anything else on your mind? (optional)" })}</p>
          <textarea className={textarea} rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder={t("web:lifetime.reflectionPlaceholder", { defaultValue: "What went well? What was hard?" })} />
          <Button disabled={busy} onClick={generate}>{busy ? "…" : t("web:lifetime.startCheckin", { defaultValue: "Start my check-in" })}</Button>
        </div>
      )}
      {past.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={h}>{t("web:lifetime.previous", { defaultValue: "Previous weeks" })}</h3>
          {past.map((c) => (
            <div key={c.id} className={card}>
              <p className="text-xs text-hint">{t("web:lifetime.weekOf", { defaultValue: "Week of {{date}}", date: c.week_start })}</p>
              <p className="text-sm text-primary">{c.summary}</p>
              <p className="text-xs text-hint">{c.next_step_done ? "✓ " : "○ "}{c.next_step.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- brag */
export function Brag() {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [items, setItems] = useState<svc.BragItem[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setItems(await svc.getBrag());
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (!items) return <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-hint">{t("web:lifetime.bragIntro", { defaultValue: "Your Career Diary turned into promotion-ready achievements. Add them to your resume in one click." })}</p>
      <Err msg={error} />
      {note && <p className="rounded-card border border-border bg-surface-2 p-3 text-sm text-primary">{note}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run(async () => { await svc.generateBrag(); await load(); })}>
          {busy ? "…" : t("web:lifetime.bragGenerate", { defaultValue: "Build from my diary" })}
        </Button>
        {items.length > 0 && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const n = await svc.applyBragToResume();
                await load();
                setNote(
                  n > 0
                    ? t("web:lifetime.bragApplied", { defaultValue: "{{count}} achievements were added to your resume.", count: n })
                    : t("web:lifetime.bragNothingNew", { defaultValue: "Everything is already on your resume." })
                );
              })
            }
          >
            {t("web:lifetime.bragApply", { defaultValue: "Update my resume" })}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-hint">{t("web:lifetime.bragEmpty", { defaultValue: "No achievements yet. Add entries to your Career Diary, then build your brag document." })}</p>
      ) : (
        items.map((b) => (
          <div key={b.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-primary">{b.title}</h3>
              {b.applied_to_resume && <span className="shrink-0 text-xs font-semibold text-[#19B87A]">✓ {t("web:lifetime.onResume", { defaultValue: "On resume" })}</span>}
            </div>
            <p className="text-sm text-primary">{b.bullet}</p>
            {b.impact && <p className="text-xs text-hint">{b.impact}</p>}
            {b.skills.length > 0 && <p className="text-xs text-hint">{b.skills.join(" · ")}</p>}
            <button type="button" className="self-start text-xs font-semibold text-hint underline" onClick={() => run(async () => { await svc.deleteBrag(b.id); await load(); })}>
              {t("common:delete", { defaultValue: "Delete" })}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

/* ----------------------------------------------------------- roleplay */
export function RolePlay({ scenario, context, onExit }: { scenario: string; context: string; onExit: () => void }) {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [msgs, setMsgs] = useState<svc.Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<svc.RoleplayFeedback | null>(null);
  const started = useRef(false);
  const start = useCallback(
    () => run(async () => { setMsgs([{ role: "ai", text: await svc.roleplayReply(scenario, context, []) }]); }),
    [run, scenario, context]
  );
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);
  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    const next: svc.Msg[] = [...msgs, { role: "user", text }];
    setMsgs(next);
    setDraft("");
    run(async () => {
      const reply = await svc.roleplayReply(scenario, context, next);
      setMsgs((p) => [...p, { role: "ai", text: reply }]);
    });
  };
  if (feedback)
    return (
      <div className="flex flex-col gap-3">
        <div className={card}>
          <p className="text-3xl font-bold text-primary">{feedback.score}/100</p>
          <p className="text-sm text-primary">{feedback.summary}</p>
          <h3 className={h}>{t("web:lifetime.strengths", { defaultValue: "What worked" })}</h3>
          <Bullets items={feedback.strengths} />
          <h3 className={h}>{t("web:lifetime.improve", { defaultValue: "To improve" })}</h3>
          <Bullets items={feedback.improvements} />
        </div>
        {feedback.better_phrasing.map((b, i) => (
          <div key={i} className={card}>
            <p className="text-xs text-hint">{t("web:lifetime.youSaid", { defaultValue: "You said" })}</p>
            <p className="text-sm text-primary">“{b.you_said}”</p>
            <p className="text-xs text-hint">{t("web:lifetime.tryInstead", { defaultValue: "Try instead" })}</p>
            <p className="text-sm font-semibold text-primary">“{b.try}”</p>
          </div>
        ))}
        <div className="flex gap-2">
          <Button onClick={() => { setFeedback(null); setMsgs([]); start(); }}>{t("web:lifetime.practiceAgain", { defaultValue: "Practice again" })}</Button>
          <Button variant="outline" onClick={onExit}>{t("common:back", { defaultValue: "Back" })}</Button>
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-hint">{t("web:lifetime.roleplayHint", { defaultValue: "Answer as you would in real life. Click “Finish” for feedback." })}</p>
      <Err msg={error} />
      {msgs.map((m, i) => (
        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-[#7C5CFF] text-white" : "border border-border text-primary"}`}>{m.text}</div>
        </div>
      ))}
      {busy && <p className="text-xs text-hint">{t("web:lifetime.thinking", { defaultValue: "Thinking…" })}</p>}
      <textarea className={textarea} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("web:lifetime.yourReply", { defaultValue: "Your reply…" })} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!draft.trim() || busy} onClick={send}>{t("web:lifetime.send", { defaultValue: "Send" })}</Button>
        <Button variant="outline" disabled={busy || !msgs.some((m) => m.role === "user")} onClick={() => run(async () => { setFeedback(await svc.roleplayFeedback(scenario, context, msgs)); })}>
          {t("web:lifetime.finish", { defaultValue: "Finish and get feedback" })}
        </Button>
        <Button variant="ghost" onClick={onExit}>{t("common:back", { defaultValue: "Back" })}</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- review */
export function Review({ onPractice }: { onPractice: (scenario: string, context: string) => void }) {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [kind, setKind] = useState<"performance_review" | "promotion">("performance_review");
  const [role, setRole] = useState("");
  const [target, setTarget] = useState("");
  const [prep, setPrep] = useState<svc.ReviewPrep | null | undefined>(undefined);
  useEffect(() => {
    svc.getReviewPrep().then(setPrep).catch(() => setPrep(null));
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-hint">{t("web:lifetime.reviewIntro", { defaultValue: "We gather evidence from your diary and wins, draft your self-review, and let you rehearse with an AI manager." })}</p>
      <div className="flex gap-2">
        <Pill selected={kind === "performance_review"} onClick={() => setKind("performance_review")}>{t("web:lifetime.kindReview", { defaultValue: "Performance review" })}</Pill>
        <Pill selected={kind === "promotion"} onClick={() => setKind("promotion")}>{t("web:lifetime.kindPromotion", { defaultValue: "Promotion" })}</Pill>
      </div>
      <TextField label={t("web:lifetime.currentRole", { defaultValue: "Your current role" })} value={role} onChange={(e) => setRole(e.target.value)} />
      {kind === "promotion" && <TextField label={t("web:lifetime.targetRole", { defaultValue: "Role you want next" })} value={target} onChange={(e) => setTarget(e.target.value)} />}
      <Err msg={error} />
      <Button disabled={busy} onClick={() => run(async () => { setPrep(await svc.buildReviewPrep(kind, role.trim(), target.trim())); })}>
        {busy ? "…" : t("web:lifetime.buildPrep", { defaultValue: "Prepare me" })}
      </Button>
      {prep === undefined && <Loading />}
      {prep && (
        <>
          <div className={card}>
            <h3 className={h}>{t("web:lifetime.selfReview", { defaultValue: "Self-review draft" })}</h3>
            <p className="whitespace-pre-wrap text-sm text-primary">{prep.self_review}</p>
            <button type="button" className="self-start text-xs font-semibold underline text-hint" onClick={() => navigator.clipboard?.writeText(prep.self_review)}>
              {t("web:lifetime.copy", { defaultValue: "Copy" })}
            </button>
          </div>
          {prep.evidence.length > 0 && (
            <div className={card}>
              <h3 className={h}>{t("web:lifetime.evidence", { defaultValue: "Your evidence" })}</h3>
              {prep.evidence.map((e, i) => (
                <div key={i}><p className="text-sm font-semibold text-primary">{e.claim}</p><p className="text-sm text-hint">{e.proof}</p></div>
              ))}
            </div>
          )}
          {prep.talking_points.length > 0 && (<div className={card}><h3 className={h}>{t("web:lifetime.talkingPoints", { defaultValue: "Talking points" })}</h3><Bullets items={prep.talking_points} /></div>)}
          {prep.likely_questions.length > 0 && (
            <div className={card}>
              <h3 className={h}>{t("web:lifetime.likelyQuestions", { defaultValue: "Questions to expect" })}</h3>
              {prep.likely_questions.map((q, i) => (
                <div key={i}><p className="text-sm font-semibold text-primary">{q.question}</p><p className="text-sm text-hint">{q.tip}</p></div>
              ))}
            </div>
          )}
          {prep.gaps.length > 0 && (<div className={card}><h3 className={h}>{t("web:lifetime.gaps", { defaultValue: "Gaps to close" })}</h3><Bullets items={prep.gaps} /></div>)}
          {prep.ask && (<div className={card}><h3 className={h}>{t("web:lifetime.theAsk", { defaultValue: "Your ask" })}</h3><p className="text-sm text-primary">{prep.ask}</p></div>)}
          <Button onClick={() => onPractice(kind === "promotion" ? "promotion_ask" : "performance_review", `${role ? "Role: " + role + ". " : ""}${target ? "Target: " + target + ". " : ""}`.slice(0, 1000))}>
            {t("web:lifetime.rehearse", { defaultValue: "Rehearse with my manager" })}
          </Button>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------- leadership */
export function Leadership({ onPractice }: { onPractice: (scenario: string, context: string) => void }) {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const kinds = [
    { k: "one_on_one", rp: "one_on_one", label: t("web:lifetime.kind1on1", { defaultValue: "1:1 prep" }) },
    { k: "feedback_script", rp: "feedback_delivery", label: t("web:lifetime.kindFeedback", { defaultValue: "Feedback script" }) },
    { k: "difficult_conversation", rp: "difficult_conversation", label: t("web:lifetime.kindDifficult", { defaultValue: "Difficult conversation" }) },
  ];
  const [kind, setKind] = useState(kinds[0]);
  const [person, setPerson] = useState("");
  const [situation, setSituation] = useState("");
  const [prep, setPrep] = useState<svc.LeadershipPrep | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-hint">{t("web:lifetime.leadershipIntro", { defaultValue: "1:1 prep, feedback scripts and difficult-conversation practice for new and aspiring managers." })}</p>
      <div className="flex flex-wrap gap-2">
        {kinds.map((x) => (
          <Pill key={x.k} selected={kind.k === x.k} onClick={() => { setKind(x); setPrep(null); }}>{x.label}</Pill>
        ))}
      </div>
      <TextField label={t("web:lifetime.person", { defaultValue: "Who is it with? (e.g. junior designer)" })} value={person} onChange={(e) => setPerson(e.target.value)} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-primary">{t("web:lifetime.situation", { defaultValue: "Describe the situation or what you want to cover" })}</span>
        <textarea className={textarea} rows={4} value={situation} onChange={(e) => setSituation(e.target.value)} />
      </label>
      <Err msg={error} />
      <Button disabled={busy || !situation.trim()} onClick={() => run(async () => { setPrep(await svc.buildLeadershipPrep(kind.k, situation.trim(), person.trim())); })}>
        {busy ? "…" : t("web:lifetime.buildPlan", { defaultValue: "Build my plan" })}
      </Button>
      {prep && (
        <>
          <div className={card}><h3 className="font-semibold text-primary">{prep.title || kind.label}</h3><p className="text-sm text-primary">{prep.goal}</p></div>
          {prep.sections.map((s, i) => (<div key={i} className={card}><h3 className={h}>{s.heading}</h3><Bullets items={s.points} /></div>))}
          {prep.script && (<div className={card}><h3 className={h}>{t("web:lifetime.openWith", { defaultValue: "How to open" })}</h3><p className="text-sm italic text-primary">“{prep.script}”</p></div>)}
          {prep.avoid.length > 0 && (<div className={card}><h3 className={h}>{t("web:lifetime.avoid", { defaultValue: "Avoid" })}</h3><Bullets items={prep.avoid} /></div>)}
          <Button onClick={() => onPractice(kind.rp, `${person ? "Person: " + person + ". " : ""}${situation}`.slice(0, 1000))}>
            {t("web:lifetime.practiceThis", { defaultValue: "Practice this conversation" })}
          </Button>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- pay */
export function Pay({ onPractice }: { onPractice: (scenario: string, context: string) => void }) {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [state, setState] = useState<{ latest: svc.PayCheck | null; due: boolean } | null>(null);
  const [location, setLocation] = useState("");
  useEffect(() => {
    svc.getPay().then(setState).catch(() => setState({ latest: null, due: true }));
  }, []);
  if (!state) return <Loading />;
  const p = state.latest;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-hint">{t("web:lifetime.payIntro", { defaultValue: "A yearly benchmark of your pay against the market. We will nudge you when you fall behind." })}</p>
      {state.due && <p className="rounded-card bg-[#FF8A3D]/15 p-3 text-sm font-semibold text-primary">{t("web:lifetime.payDue", { defaultValue: "Time for your yearly pay check" })}</p>}
      <Err msg={error} />
      <LocationSelect label={t("web:lifetime.payLocation", { defaultValue: "Where do you work? (optional)" })} value={location} onChange={setLocation} />
      <Button disabled={busy} onClick={() => run(async () => { setState({ latest: await svc.runPayCheck(location || undefined), due: false }); })}>
        {busy ? "…" : t("web:lifetime.payRun", { defaultValue: "Check my pay now" })}
      </Button>
      {p ? (
        <>
          <div className={card}>
            <span className={`self-start rounded-pill px-2.5 py-0.5 text-xs font-bold ${p.behind ? "bg-[#FF8A3D]/20 text-[#FF8A3D]" : "bg-[#19B87A]/20 text-[#19B87A]"}`}>
              {p.behind ? t("web:lifetime.payBehind", { defaultValue: "Behind the market" }) : t("web:lifetime.payOk", { defaultValue: "In line with the market" })}
            </span>
            <p className="text-3xl font-bold text-primary">{fmt(p.current_base, p.currency)}</p>
            <p className="text-sm text-hint">{t("web:lifetime.payYourBase", { defaultValue: "Your current base" })}{p.role ? ` · ${p.role}` : ""}{p.location ? ` · ${p.location}` : ""}</p>
            {p.gap_pct ? (
              <p className="text-sm text-primary">
                {p.gap_pct > 0
                  ? t("web:lifetime.payGapBelow", { defaultValue: "About {{pct}}% below the market median.", pct: Math.abs(Math.round(p.gap_pct)) })
                  : t("web:lifetime.payGapAbove", { defaultValue: "About {{pct}}% above the market median.", pct: Math.abs(Math.round(p.gap_pct)) })}
              </p>
            ) : null}
          </div>
          <div className={card}>
            <h3 className={h}>{t("web:lifetime.payMarket", { defaultValue: "Market range" })}</h3>
            {([["p25", t("web:lifetime.p25", { defaultValue: "Lower quartile" })], ["p50", t("web:lifetime.p50", { defaultValue: "Median" })], ["p75", t("web:lifetime.p75", { defaultValue: "Upper quartile" })]] as const).map(([k, label]) => (
              <div key={k} className="flex justify-between text-sm"><span className="text-hint">{label}</span><span className="font-semibold text-primary">{fmt(p.market[k], p.currency)}</span></div>
            ))}
            {p.suggested_ask ? <p className="text-sm font-semibold text-primary">{t("web:lifetime.payAsk", { defaultValue: "Suggested ask" })}: {fmt(p.suggested_ask, p.currency)}</p> : null}
            {p.tip && <p className="text-sm text-primary">{p.tip}</p>}
            {p.caveat && <p className="text-xs text-hint">{p.caveat}</p>}
          </div>
          {p.behind && <Button onClick={() => onPractice("promotion_ask", "")}>{t("web:lifetime.payNegotiate", { defaultValue: "Practice asking for a raise" })}</Button>}
        </>
      ) : (
        <p className="py-4 text-center text-sm text-hint">{t("web:lifetime.payNone", { defaultValue: "Add your current pay in Career Growth, then run your first check." })}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- market */
export function Market() {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [digest, setDigest] = useState<svc.MarketDigest | null | undefined>(undefined);
  useEffect(() => {
    svc.getMarket().then(setDigest).catch(() => setDigest(null));
  }, []);
  const stepLabel = (s: string) =>
    s === "level" ? t("web:lifetime.stepupLevel", { defaultValue: "Next level" })
    : s === "scope" ? t("web:lifetime.stepupScope", { defaultValue: "Bigger scope" })
    : s === "domain" ? t("web:lifetime.stepupDomain", { defaultValue: "New domain" })
    : t("web:lifetime.stepupMatch", { defaultValue: "Strong match" });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-hint">{t("web:lifetime.marketIntro", { defaultValue: "A quiet monthly list of roles that could be a step up - no searching required." })}</p>
      <Err msg={error} />
      <Button disabled={busy} onClick={() => run(async () => { setDigest(await svc.refreshMarket()); })}>
        {busy ? "…" : t("web:lifetime.marketRefresh", { defaultValue: "Check the market now" })}
      </Button>
      {digest === undefined ? <Loading /> : !digest || digest.empty || digest.roles.length === 0 ? (
        <p className="py-4 text-center text-sm text-hint">
          {digest?.empty
            ? t("web:lifetime.marketEmpty", { defaultValue: "No new openings matched your profile this month. Make sure your target roles are set in Job Preferences." })
            : t("web:lifetime.marketNone", { defaultValue: "Nothing here yet. Run a check to see roles that could be a step up." })}
        </p>
      ) : (
        <>
          {digest.summary && <p className="text-sm text-primary">{digest.summary}</p>}
          {digest.roles.map((r) => (
            <div key={r.id} className={card}>
              <span className="self-start rounded-pill bg-[#7C5CFF]/15 px-2.5 py-0.5 text-xs font-bold text-[#7C5CFF]">{stepLabel(r.step_up)}</span>
              <h3 className="font-semibold text-primary">{r.title}</h3>
              <p className="text-sm text-hint">{r.company}{r.location ? ` · ${r.location}` : ""}</p>
              <p className="text-sm text-primary">{r.why}</p>
              {r.apply_url && <a href={r.apply_url} target="_blank" rel="noopener noreferrer" className="self-start text-sm font-semibold underline text-primary">{t("web:lifetime.viewRole", { defaultValue: "View role" })}</a>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- skills */
export function Skills() {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [plan, setPlan] = useState<svc.SkillPlan | null | undefined>(undefined);
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    svc.getSkillPlan().then(setPlan).catch(() => setPlan(null));
  }, []);
  if (plan === undefined) return <Loading />;
  if (!plan || editing)
    return (
      <div className={card}>
        <h3 className="font-semibold text-primary">{t("web:lifetime.skillsFormTitle", { defaultValue: "Which role do you want next?" })}</h3>
        <TextField label={t("web:lifetime.currentRole", { defaultValue: "Your current role" })} value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField label={t("web:lifetime.targetRoleEg", { defaultValue: "Target role (e.g. Engineering Manager)" })} value={target} onChange={(e) => setTarget(e.target.value)} />
        <Err msg={error} />
        <Button disabled={busy || !target.trim()} onClick={() => run(async () => { setPlan(await svc.buildSkillPlan(target.trim(), current.trim(), 24)); setEditing(false); })}>
          {busy ? "…" : t("web:lifetime.skillsBuild", { defaultValue: "Build my roadmap" })}
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <Err msg={error} />
      <div className={card}>
        <span className="self-start rounded-pill bg-[#7C5CFF]/15 px-2.5 py-0.5 text-xs font-bold text-[#7C5CFF]">{(plan.current_role || t("web:lifetime.today", { defaultValue: "Today" }))} → {plan.target_role}</span>
        <p className="text-sm text-primary">{plan.gap_summary}</p>
        <button type="button" className="self-start text-sm font-semibold underline text-primary" onClick={() => setEditing(true)}>{t("web:lifetime.newPlan", { defaultValue: "Plan for a different role" })}</button>
      </div>
      <h3 className={h}>{t("web:lifetime.milestones", { defaultValue: "Milestones & reminders" })}</h3>
      {plan.milestones.map((m) => (
        <label key={m.id} className={`${card} cursor-pointer flex-row items-center gap-3`}>
          <input type="checkbox" checked={m.done} onChange={() => run(async () => { setPlan(await svc.setMilestone(m.id, !m.done)); })} />
          <span className="flex flex-col">
            <span className={`text-sm font-semibold text-primary ${m.done ? "line-through" : ""}`}>{m.title}</span>
            <span className="text-xs text-hint">{t("web:lifetime.dueDate", { defaultValue: "Due {{date}}", date: m.due })} · {m.type === "cert" ? t("web:lifetime.msCert", { defaultValue: "Certification" }) : m.type === "project" ? t("web:lifetime.msProject", { defaultValue: "Project" }) : m.type === "network" ? t("web:lifetime.msNetwork", { defaultValue: "Networking" }) : t("web:lifetime.msSkill", { defaultValue: "Skill" })}</span>
          </span>
        </label>
      ))}
      <h3 className={h}>{t("web:lifetime.skillsToBuild", { defaultValue: "Skills to build" })}</h3>
      {plan.skills.map((s, i) => (<div key={i} className={card}><p className="text-sm font-semibold text-primary">{s.name}</p><p className="text-sm text-hint">{s.why}</p></div>))}
      {plan.certifications.length > 0 && (
        <>
          <h3 className={h}>{t("web:lifetime.certs", { defaultValue: "Certifications worth considering" })}</h3>
          {plan.certifications.map((c, i) => (
            <div key={i} className={card}>
              <p className="text-sm font-semibold text-primary">{c.name}</p>
              <p className="text-xs text-hint">{c.provider}{c.est_weeks ? ` · ~${c.est_weeks} ${t("web:lifetime.weeks", { defaultValue: "weeks" })}` : ""}</p>
              <p className="text-sm text-primary">{c.why}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- timeline */
const KIND_COLORS: Record<string, string> = { win: "#19B87A", role: "#7C5CFF", raise: "#FF8A3D", certificate: "#2F6BFF", milestone: "#FF5FA2", review: "#F5B000" };
export function Timeline() {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [events, setEvents] = useState<svc.TimelineEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState("win");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const load = useCallback(async () => {
    try {
      setEvents(await svc.getTimeline());
    } catch {
      setEvents([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const label = (k: string) =>
    k === "win" ? t("web:lifetime.tlWin", { defaultValue: "Win" })
    : k === "role" ? t("web:lifetime.tlRole", { defaultValue: "New role" })
    : k === "raise" ? t("web:lifetime.tlRaise", { defaultValue: "Raise" })
    : k === "certificate" ? t("web:lifetime.tlCertificate", { defaultValue: "Certificate" })
    : k === "review" ? t("web:lifetime.tlReview", { defaultValue: "Review" })
    : t("web:lifetime.tlMilestone", { defaultValue: "Milestone" });
  if (!events) return <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-hint">{t("web:lifetime.timelineIntro", { defaultValue: "Your wins, raises, roles and certificates over the years. Pay updates and certificates appear automatically." })}</p>
      <Err msg={error} />
      {open ? (
        <div className={card}>
          <div className="flex flex-wrap gap-2">
            {Object.keys(KIND_COLORS).map((k) => (<Pill key={k} selected={kind === k} onClick={() => setKind(k)}>{label(k)}</Pill>))}
          </div>
          <TextField label={t("web:lifetime.tlTitlePlaceholder", { defaultValue: "What happened?" })} value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label={t("web:lifetime.tlDate", { defaultValue: "Date" })} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">{t("web:lifetime.tlDetail", { defaultValue: "Details (optional)" })}</span>
            <textarea className={textarea} rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button disabled={busy || !title.trim() || !date} onClick={() => run(async () => { await svc.addTimeline({ title: title.trim(), kind, date, detail: detail.trim() || undefined }); setOpen(false); setTitle(""); setDetail(""); await load(); })}>
              {t("common:save", { defaultValue: "Save" })}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("common:cancel", { defaultValue: "Cancel" })}</Button>
          </div>
        </div>
      ) : (
        <Button className="self-start" onClick={() => setOpen(true)}>{t("web:lifetime.tlAdd", { defaultValue: "Add to my timeline" })}</Button>
      )}
      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-hint">{t("web:lifetime.timelineEmpty", { defaultValue: "Nothing here yet. Add your first win or role." })}</p>
      ) : (
        <div className="flex flex-col">
          {events.map((e, i) => {
            const y = e.date.slice(0, 4);
            const newYear = i === 0 || events[i - 1].date.slice(0, 4) !== y;
            const color = KIND_COLORS[e.kind] ?? KIND_COLORS.milestone;
            return (
              <div key={e.id}>
                {newYear && <h3 className={`text-lg font-bold text-primary ${i === 0 ? "" : "mt-4"} mb-2`}>{y}</h3>}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="w-0.5 flex-1 bg-border" />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 pb-5">
                    <p className="text-xs text-hint">{e.date} · {label(e.kind)}</p>
                    <p className="text-sm font-semibold text-primary">{e.title}</p>
                    {e.detail && <p className="text-sm text-hint">{e.detail}</p>}
                    {e.deletable && (
                      <button type="button" className="self-start text-xs font-semibold underline text-hint" onClick={() => run(async () => { await svc.deleteTimeline(e.id); await load(); })}>
                        {t("common:delete", { defaultValue: "Delete" })}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
