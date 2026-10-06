"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { Skeleton } from "@/components/ui/Skeleton";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";
import * as gamificationService from "@/lib/gamificationService";
import type { DailyChallenge, GamificationStreak, LeaderboardEntry } from "@/lib/gamificationService";

// ---------------------------------------------------------------------------
// Dashboard "insights" — product report: "This web app dashboard homescreen
// still look scanty to me. It need more and more content. Its too empty".
// Everything here is the user's own real data, fetched from endpoints the
// Progress / Job Tracker / News pages already use (no new backend), and each
// card degrades to a useful empty state with a CTA instead of disappearing,
// so the page is full for a brand-new account too.
// ---------------------------------------------------------------------------

interface Session {
  id: number;
  type: string;
  status: string;
  started_at: string;
  overall_score?: number | null;
}
interface RoadmapStep {
  order: number;
  title: string;
  status: string;
}
interface Roadmap {
  target_role: string;
  steps: RoadmapStep[];
  completed_count: number;
  total_count: number;
  is_complete: boolean;
}
interface JobAlert {
  id: string;
  title: string;
  company: string;
  location?: string;
  apply_url?: string;
  read: boolean;
}
interface Analytics {
  total: number;
  response_rate: number | null;
}
interface NewsItem {
  headline: string;
  summary: string;
  source_url?: string;
  source_name?: string;
}

const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weeklyBuckets(completed: Session[]): number[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const counts = new Array(7).fill(0);
  for (const s of completed) {
    const diff = Math.floor((new Date(s.started_at).getTime() - monday.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) counts[diff] += 1;
  }
  return counts;
}

function prettyType(type: string) {
  return type
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function scoreTint(score: number | null | undefined) {
  if (typeof score !== "number") return "bg-surface-3 text-hint";
  if (score >= 75) return "bg-tint-mint text-tint-mint-text";
  if (score >= 50) return "bg-tint-orange text-tint-orange-text";
  return "bg-tint-rose text-tint-rose-text";
}

function Card({ title, icon, tint, action, children, className = "" }: { title: string; icon: EvaIconName; tint: string; action?: { href: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-5 shadow-soft ${className}`}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
            <EvaIcon name={icon} size={17} />
          </span>
          <h2 className="text-base font-bold text-primary">{title}</h2>
        </div>
        {action && (
          <Link href={action.href} className="text-xs font-semibold text-link hover:underline">
            {action.label} →
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function EmptyLine({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-surface-1 p-4">
      <p className="text-sm text-hint">{text}</p>
      {cta && (
        <Link href={cta.href} className="inline-flex items-center gap-1.5 rounded-pill bg-solid px-4 py-2 text-xs font-semibold text-solid-fg transition hover:opacity-90">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function DashboardInsights() {
  const { t, i18n } = useTranslation();
  const { firebaseUser, profile, loading: authLoading, isPremium } = useAuth();

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [streak, setStreak] = useState<GamificationStreak | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null | undefined>(undefined);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null | undefined>(undefined);
  const [jobs, setJobs] = useState<JobAlert[] | null | undefined>(undefined);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [news, setNews] = useState<NewsItem[] | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<DailyChallenge | null | undefined>(undefined);

  useEffect(() => {
    if (authLoading || !firebaseUser) return;
    let cancelled = false;
    const ok = <T,>(fn: (v: T) => void) => (v: T) => {
      if (!cancelled) fn(v);
    };
    apiClient.get<Session[]>("/api/v1/interviews/sessions").then(ok(setSessions)).catch(ok(() => setSessions([])));
    gamificationService.getStreak().then(ok(setStreak)).catch(() => {});
    apiClient
      .get<{ roadmap: Roadmap | null }>("/api/v1/roadmap")
      .then(ok((d) => setRoadmap(d.roadmap)))
      .catch(ok(() => setRoadmap(null)));
    gamificationService
      .getLeaderboard("all", firebaseUser.uid)
      .then(ok(setLeaderboard))
      .catch(ok(() => setLeaderboard(null)));
    apiClient
      .get<{ data: JobAlert[] }>("/api/v1/job-alerts")
      .then(ok((d) => setJobs(d.data ?? [])))
      .catch(ok(() => setJobs(null)));
    apiClient.get<Analytics>("/api/v1/tracker/analytics").then(ok(setAnalytics)).catch(() => {});
    apiClient
      .get<{ items: NewsItem[] }>("/api/v1/news/today", { params: { language: i18n.language || "en" } })
      .then(ok((d) => setNews(d.items ?? [])))
      .catch(ok(() => setNews(null)));
    gamificationService
      .getTodayChallenge(i18n.language)
      .then(ok(setChallenge))
      .catch(ok(() => setChallenge(null)));
    return () => {
      cancelled = true;
    };
  }, [authLoading, firebaseUser, i18n.language]);

  const completed = useMemo(() => (sessions ?? []).filter((s) => (s.status || "").toLowerCase() === "completed"), [sessions]);
  const scored = useMemo(() => completed.filter((s) => typeof s.overall_score === "number"), [completed]);
  const avgScore = scored.length ? Math.round(scored.reduce((a, s) => a + (s.overall_score ?? 0), 0) / scored.length) : null;
  const weekly = useMemo(() => weeklyBuckets(completed), [completed]);
  const weekTotal = weekly.reduce((a, b) => a + b, 0);
  const maxWeekly = Math.max(1, ...weekly);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const recent = useMemo(() => [...completed].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)).slice(0, 4), [completed]);

  const roadmapPct = roadmap && roadmap.total_count > 0 ? Math.round((roadmap.completed_count / roadmap.total_count) * 100) : 0;
  const currentStep = roadmap?.steps.find((s) => s.status === "current") ?? null;
  const weekdayLabels = [
    t("web:dashboard.insights.mon", { defaultValue: "Mon" }),
    t("web:dashboard.insights.tue", { defaultValue: "Tue" }),
    t("web:dashboard.insights.wed", { defaultValue: "Wed" }),
    t("web:dashboard.insights.thu", { defaultValue: "Thu" }),
    t("web:dashboard.insights.fri", { defaultValue: "Fri" }),
    t("web:dashboard.insights.sat", { defaultValue: "Sat" }),
    t("web:dashboard.insights.sun", { defaultValue: "Sun" }),
  ];
  void WEEKDAYS_EN;

  const goalLabel = profile?.goals?.[0];

  const stats: Array<{ icon: EvaIconName; label: string; value: string; caption: string; bg: string; fg: string }> = [
    {
      icon: "flash-outline",
      label: t("web:dashboard.insights.statXp", { defaultValue: "Total XP" }),
      value: streak ? String(streak.xp) : "–",
      caption: t("web:dashboard.insights.statXpCaption", { defaultValue: "Earned from practice & challenges" }),
      bg: "bg-tint-blue",
      fg: "text-tint-blue-text",
    },
    {
      icon: "trending-up-outline",
      label: t("web:dashboard.insights.statStreak", { defaultValue: "Day streak" }),
      value: streak ? String(streak.streakDays) : "–",
      caption: streak?.checkedInToday
        ? t("web:dashboard.insights.statStreakDone", { defaultValue: "Checked in today" })
        : t("web:dashboard.insights.statStreakKeep", { defaultValue: "Practice today to keep it going" }),
      bg: "bg-tint-orange",
      fg: "text-tint-orange-text",
    },
    {
      icon: "mic-outline",
      label: t("web:dashboard.insights.statSessions", { defaultValue: "Sessions this week" }),
      value: sessions ? String(weekTotal) : "–",
      caption: t("web:dashboard.insights.statSessionsCaption", { defaultValue: "{{count}} completed overall", count: completed.length }),
      bg: "bg-tint-purple",
      fg: "text-tint-purple-text",
    },
    {
      icon: "award-outline",
      label: t("web:dashboard.insights.statAvg", { defaultValue: "Average score" }),
      value: avgScore === null ? "–" : `${avgScore}%`,
      caption: avgScore === null ? t("web:dashboard.insights.statAvgEmpty", { defaultValue: "Finish a scored interview" }) : t("web:dashboard.insights.statAvgCaption", { defaultValue: "Across {{count}} scored interviews", count: scored.length }),
      bg: "bg-tint-mint",
      fg: "text-tint-mint-text",
    },
  ];

  const explore: Array<{ href: string; icon: EvaIconName; title: string; desc: string; bg: string; fg: string }> = [
    { href: "/career/salary-benchmark", icon: "pie-chart-outline", title: t("web:dashboard.insights.exploreSalary", { defaultValue: "Salary Benchmark" }), desc: t("web:dashboard.insights.exploreSalaryDesc", { defaultValue: "See market pay for any role" }), bg: "bg-tint-mint", fg: "text-tint-mint-text" },
    { href: "/jd-analyzer", icon: "file-text-outline", title: t("web:dashboard.insights.exploreJd", { defaultValue: "Job Analyzer" }), desc: t("web:dashboard.insights.exploreJdDesc", { defaultValue: "Match your resume to a posting" }), bg: "bg-tint-blue", fg: "text-tint-blue-text" },
    { href: "/career-diary", icon: "edit-2-outline", title: t("web:dashboard.insights.exploreDiary", { defaultValue: "Career Diary" }), desc: t("web:dashboard.insights.exploreDiaryDesc", { defaultValue: "Log wins as promotion evidence" }), bg: "bg-tint-purple", fg: "text-tint-purple-text" },
    { href: "/career/networking", icon: "people-outline", title: t("web:dashboard.insights.exploreNetwork", { defaultValue: "Networking" }), desc: t("web:dashboard.insights.exploreNetworkDesc", { defaultValue: "Events and outreach messages" }), bg: "bg-tint-orange", fg: "text-tint-orange-text" },
    { href: "/career/dream-companies", icon: "briefcase-outline", title: t("web:dashboard.insights.exploreDream", { defaultValue: "Dream Companies" }), desc: t("web:dashboard.insights.exploreDreamDesc", { defaultValue: "Track and prep for your targets" }), bg: "bg-tint-rose", fg: "text-tint-rose-text" },
    { href: "/career/lifetime", icon: "compass-outline", title: t("web:dashboard.insights.exploreHub", { defaultValue: "Career Success Hub" }), desc: t("web:dashboard.insights.exploreHubDesc", { defaultValue: "Weekly check-ins and growth" }), bg: "bg-tint-blue", fg: "text-tint-blue-text" },
    { href: "/emotional-coach", icon: "heart-outline", title: t("web:dashboard.insights.exploreEmotional", { defaultValue: "Emotional Coach" }), desc: t("web:dashboard.insights.exploreEmotionalDesc", { defaultValue: "A supportive mood check-in" }), bg: "bg-tint-rose", fg: "text-tint-rose-text" },
    { href: "/goals", icon: "flag-outline", title: t("web:dashboard.insights.exploreGoals", { defaultValue: "Goals" }), desc: t("web:dashboard.insights.exploreGoalsDesc", { defaultValue: "Weekly targets and tips" }), bg: "bg-tint-mint", fg: "text-tint-mint-text" },
  ];

  const topBoard = (leaderboard ?? []).slice(0, 5);
  const me = (leaderboard ?? []).find((e) => e.isCurrentUser);
  const loadingCards = sessions === null;

  return (
    <>
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`flex flex-col gap-2 rounded-card p-4 ${s.bg}`}>
            <div className={`flex items-center gap-1.5 text-xs font-bold ${s.fg}`}>
              <EvaIcon name={s.icon} size={14} />
              {s.label}
            </div>
            {loadingCards ? <Skeleton className="h-8 w-16" /> : <span className={`text-3xl font-extrabold tracking-tight ${s.fg}`}>{s.value}</span>}
            <span className="text-xs text-hint">{s.caption}</span>
          </div>
        ))}
      </div>

      {/* Main two-column area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card
            title={t("web:dashboard.insights.weekTitle", { defaultValue: "This week's practice" })}
            icon="bar-chart-2-outline"
            tint="bg-tint-purple text-tint-purple-text"
            action={{ href: "/progress", label: t("web:dashboard.insights.viewProgress", { defaultValue: "Full progress" }) }}
          >
            <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
              {weekly.map((n, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[10px] font-semibold text-hint">{n > 0 ? n : ""}</span>
                  <div
                    className={`w-full max-w-[34px] rounded-t-lg transition-all ${i === todayIdx ? "bg-brand" : n > 0 ? "bg-brand/60" : "bg-surface-3"}`}
                    style={{ height: `${Math.max(8, (n / maxWeekly) * 76)}px` }}
                  />
                  <span className={`text-[11px] ${i === todayIdx ? "font-bold text-primary" : "text-hint"}`}>{weekdayLabels[i]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-hint">
              {weekTotal > 0
                ? t("web:dashboard.insights.weekSummary", { defaultValue: "{{count}} sessions completed this week. Keep the momentum going.", count: weekTotal })
                : t("web:dashboard.insights.weekEmpty", { defaultValue: "No sessions yet this week — even one 10-minute mock interview counts." })}
            </p>
          </Card>

          <Card
            title={t("web:dashboard.insights.recentTitle", { defaultValue: "Recent interviews" })}
            icon="clock-outline"
            tint="bg-tint-blue text-tint-blue-text"
            action={{ href: "/applications?tab=history", label: t("web:dashboard.insights.viewAll", { defaultValue: "View all" }) }}
          >
            {loadingCards ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : recent.length === 0 ? (
              <EmptyLine
                text={t("web:dashboard.insights.recentEmpty", { defaultValue: "Your completed mock interviews and scores will appear here." })}
                cta={{ href: "/practice/mock-interviews", label: t("web:dashboard.insights.startInterview", { defaultValue: "Start a mock interview" }) }}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {recent.map((s) => (
                  <li key={s.id}>
                    <Link href="/applications?tab=history" className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-3 transition hover:bg-surface-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-purple text-tint-purple-text">
                        <EvaIcon name="mic-outline" size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary">{prettyType(s.type)}</p>
                        <p className="text-xs text-hint">{new Date(s.started_at).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}</p>
                      </div>
                      <span className={`rounded-pill px-2.5 py-1 text-xs font-bold ${scoreTint(s.overall_score)}`}>{typeof s.overall_score === "number" ? `${Math.round(s.overall_score)}%` : "—"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title={t("web:dashboard.insights.jobsTitle", { defaultValue: "Job matches for you" })}
            icon="briefcase-outline"
            tint="bg-tint-orange text-tint-orange-text"
            action={{ href: "/job-tracker", label: t("web:dashboard.insights.openTracker", { defaultValue: "Open tracker" }) }}
          >
            {jobs === undefined ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : !jobs || jobs.length === 0 ? (
              <EmptyLine
                text={t("web:dashboard.insights.jobsEmpty", { defaultValue: "Set your target roles and we'll surface fresh openings that fit you." })}
                cta={{ href: "/job-alerts", label: t("web:dashboard.insights.jobsCta", { defaultValue: "Find job matches" }) }}
              />
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {jobs.slice(0, 4).map((j) => (
                    <li key={j.id}>
                      <Link href={`/job-alerts/${j.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-3 transition hover:bg-surface-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-orange text-sm font-bold text-tint-orange-text">{(j.company || "?").slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-primary">{j.title}</p>
                          <p className="truncate text-xs text-hint">
                            {j.company}
                            {j.location ? ` · ${j.location}` : ""}
                          </p>
                        </div>
                        {!j.read && <span className="rounded-pill bg-tint-rose px-2 py-0.5 text-[10px] font-bold text-tint-rose-text">{t("web:dashboard.insights.new", { defaultValue: "New" })}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
                {analytics && analytics.total > 0 && (
                  <p className="text-xs text-hint">
                    {t("web:dashboard.insights.trackedApps", { defaultValue: "You're tracking {{count}} applications.", count: analytics.total })}
                  </p>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title={t("web:dashboard.insights.challengeTitle", { defaultValue: "Today's challenge" })} icon="flash-outline" tint="bg-tint-rose text-tint-rose-text" action={{ href: "/progress", label: t("web:dashboard.insights.open", { defaultValue: "Open" }) }}>
            {challenge === undefined ? (
              <Skeleton className="h-20" />
            ) : !challenge ? (
              <EmptyLine text={t("web:dashboard.insights.challengeEmpty", { defaultValue: "A surprise practice challenge appears here every day." })} />
            ) : (
              <>
                <p className="line-clamp-4 text-sm text-primary">{challenge.promptText}</p>
                <Link
                  href="/progress"
                  className={`inline-flex w-fit items-center gap-1.5 rounded-pill px-4 py-2 text-xs font-semibold transition hover:opacity-90 ${challenge.completed || challenge.skipped ? "bg-tint-mint text-tint-mint-text" : "bg-solid text-solid-fg"}`}
                >
                  {challenge.completed
                    ? t("web:dashboard.insights.challengeDone", { defaultValue: "Completed · +{{xp}} XP", xp: challenge.xpAwarded })
                    : challenge.skipped
                      ? t("web:dashboard.insights.challengeSkipped", { defaultValue: "Skipped today" })
                      : t("web:dashboard.insights.challengeCta", { defaultValue: "Take the challenge" })}
                </Link>
              </>
            )}
          </Card>

          <Card title={t("web:dashboard.insights.roadmapTitle", { defaultValue: "Career roadmap" })} icon="compass-outline" tint="bg-tint-mint text-tint-mint-text" action={{ href: "/career/roadmap", label: t("web:dashboard.insights.open", { defaultValue: "Open" }) }}>
            {roadmap === undefined ? (
              <Skeleton className="h-24" />
            ) : !roadmap ? (
              <EmptyLine
                text={
                  goalLabel
                    ? t("web:dashboard.insights.roadmapEmptyGoal", { defaultValue: "Build a step-by-step plan toward your career goal." })
                    : t("web:dashboard.insights.roadmapEmpty", { defaultValue: "Build a step-by-step roadmap to see your progress toward your goal." })
                }
                cta={{ href: "/career/roadmap", label: t("web:dashboard.insights.roadmapCta", { defaultValue: "Build my roadmap" }) }}
              />
            ) : (
              <div className="flex items-center gap-4">
                <CircularProgress progress={roadmapPct} size={84} strokeWidth={9} progressClassName="text-brand">
                  <span className="text-base font-extrabold text-primary">{roadmapPct}%</span>
                </CircularProgress>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-primary">{roadmap.target_role}</p>
                  <p className="text-xs text-hint">{t("web:dashboard.insights.roadmapSteps", { defaultValue: "{{done}} of {{total}} steps", done: roadmap.completed_count, total: roadmap.total_count })}</p>
                  {currentStep && <p className="mt-1 line-clamp-2 text-xs font-semibold text-link">{t("web:dashboard.insights.roadmapNext", { defaultValue: "Next: {{step}}", step: currentStep.title })}</p>}
                </div>
              </div>
            )}
          </Card>

          <Card title={t("web:dashboard.insights.boardTitle", { defaultValue: "Leaderboard" })} icon="award-outline" tint="bg-tint-orange text-tint-orange-text" action={{ href: "/progress/leaderboard", label: t("web:dashboard.insights.viewAll", { defaultValue: "View all" }) }}>
            {leaderboard === undefined ? (
              <Skeleton className="h-28" />
            ) : topBoard.length === 0 ? (
              <EmptyLine text={t("web:dashboard.insights.boardEmpty", { defaultValue: "Earn XP from practice to climb the leaderboard." })} />
            ) : (
              <ol className="flex flex-col gap-1.5">
                {topBoard.map((e) => (
                  <li key={e.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${e.isCurrentUser ? "bg-tint-blue" : "bg-surface-1"}`}>
                    <span className="w-5 text-center text-xs font-extrabold text-hint">{e.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{e.isCurrentUser ? t("web:dashboard.insights.you", { defaultValue: "You" }) : e.name}</span>
                    <span className="text-xs font-bold text-tint-blue-text">{e.xp} XP</span>
                  </li>
                ))}
                {me && !topBoard.some((e) => e.isCurrentUser) && (
                  <li className="flex items-center gap-3 rounded-xl bg-tint-blue px-3 py-2">
                    <span className="w-5 text-center text-xs font-extrabold text-hint">{me.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{t("web:dashboard.insights.you", { defaultValue: "You" })}</span>
                    <span className="text-xs font-bold text-tint-blue-text">{me.xp} XP</span>
                  </li>
                )}
              </ol>
            )}
          </Card>

          <Card title={t("web:dashboard.insights.newsTitle", { defaultValue: "Industry news" })} icon="globe-outline" tint="bg-tint-blue text-tint-blue-text" action={{ href: "/news", label: t("web:dashboard.insights.viewAll", { defaultValue: "View all" }) }}>
            {news === undefined ? (
              <Skeleton className="h-24" />
            ) : !news || news.length === 0 ? (
              <EmptyLine
                text={
                  isPremium
                    ? t("web:dashboard.insights.newsEmpty", { defaultValue: "Today's industry headlines will show up here." })
                    : t("web:dashboard.insights.newsUpsell", { defaultValue: "Get a daily, AI-curated digest of news for your industry and target roles with Premium." })
                }
                cta={isPremium ? undefined : { href: "/subscription", label: t("web:dashboard.insights.seePlans", { defaultValue: "See plans" }) }}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {news.slice(0, 3).map((n, i) => (
                  <li key={i} className="flex flex-col gap-0.5 border-b border-border pb-3 last:border-0 last:pb-0">
                    <p className="line-clamp-2 text-sm font-semibold text-primary">{n.headline}</p>
                    {n.source_name && <p className="text-[11px] text-hint">{n.source_name}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Explore more */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-primary">{t("web:dashboard.insights.exploreTitle", { defaultValue: "Explore more tools" })}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {explore.map((e) => (
            <Link key={e.href} href={e.href} className="group flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md">
              <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${e.bg} ${e.fg} transition group-hover:scale-105`}>
                <EvaIcon name={e.icon} size={20} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-primary">{e.title}</p>
                <p className="line-clamp-2 text-xs text-hint">{e.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
