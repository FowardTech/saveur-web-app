"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SimpleMarkdown } from "@/components/ui/SimpleMarkdown";

interface ViewerFile {
  path: string;
  content: string;
}

/** Read-only project viewer (file list + contents) used for projects shared
 * with a Saveur user and for the public external link page. */
interface PracticalStage {
  n: number;
  title: string;
  task?: string;
  status?: string;
  attempts?: number;
  feedback?: { score?: number; passed?: boolean; summary?: string; strengths?: string[]; improvements?: string[]; follow_up?: string };
}
interface PracticalState {
  persona?: { name?: string; title?: string };
  industry?: string;
  role?: string;
  stages?: PracticalStage[];
}

function parseState(files: ViewerFile[]): PracticalState | null {
  const f = files.find((x) => x.path === "_project.json");
  if (!f) return null;
  try {
    const v = JSON.parse(f.content);
    return v && typeof v === "object" ? (v as PracticalState) : null;
  } catch {
    return null;
  }
}

function ScoreBadge({ score, passed }: { score: number; passed?: boolean }) {
  const good = passed ?? score >= 60;
  return (
    <span className={`inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full text-sm font-extrabold ${good ? "bg-tint-mint text-tint-mint-text" : "bg-tint-orange text-tint-orange-text"}`}>
      {score}
    </span>
  );
}

/** Practical-scenario projects: a readable report (persona, brief, stages with
 * the learner's work and AI feedback, portfolio write-up) instead of raw files. */
function PracticalProjectView({ name, files, state }: { name: string; files: ViewerFile[]; state: PracticalState }) {
  const { t } = useTranslation();
  const get = (path: string) => files.find((f) => f.path === path)?.content ?? "";
  const brief = get("BRIEF.md");
  const portfolio = get("PORTFOLIO.md");
  const stages = state.stages ?? [];
  const done = stages.filter((s) => s.status === "done").length;
  const section = "flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5 shadow-soft";
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[28px] border border-border bg-hero-gradient p-6">
        <h1 className="text-xl font-extrabold tracking-tight text-primary sm:text-2xl">{name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          {state.industry && <span className="rounded-full bg-tint-blue px-3 py-1 text-tint-blue-text">{state.industry}</span>}
          {state.role && <span className="rounded-full bg-tint-purple px-3 py-1 text-tint-purple-text">{state.role}</span>}
          {stages.length > 0 && (
            <span className="rounded-full bg-tint-mint px-3 py-1 text-tint-mint-text">
              {t("web:share.stagesDone", { defaultValue: "{{done}} of {{total}} stages complete", done, total: stages.length })}
            </span>
          )}
        </div>
        {state.persona?.name && (
          <p className="mt-3 text-sm text-hint">
            {t("web:share.reviewedBy", { defaultValue: "Reviewed by" })}{" "}
            <span className="font-semibold text-primary">{state.persona.name}</span>
            {state.persona.title ? `, ${state.persona.title}` : ""}
          </p>
        )}
      </div>

      {brief && (
        <div className={section}>
          <h2 className="text-base font-bold text-primary">{t("web:share.projectBrief", { defaultValue: "Project brief" })}</h2>
          <SimpleMarkdown text={brief} />
        </div>
      )}

      {stages.map((st) => {
        const fb = st.feedback;
        const work = get(`STAGE_${st.n}.md`);
        return (
          <div key={st.n} className={section}>
            <div className="flex items-start gap-3">
              {typeof fb?.score === "number" ? (
                <ScoreBadge score={fb.score} passed={fb.passed} />
              ) : (
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-bold text-hint">{st.n}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-hint">{t("web:share.stage", { defaultValue: "Stage {{n}}", n: st.n })}</p>
                <h3 className="text-base font-bold text-primary">{st.title}</h3>
              </div>
              {st.status && (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${st.status === "done" ? "bg-tint-mint text-tint-mint-text" : "bg-tint-orange text-tint-orange-text"}`}>
                  {st.status === "done" ? t("web:share.statusDone", { defaultValue: "Completed" }) : t("web:share.statusInProgress", { defaultValue: "In progress" })}
                </span>
              )}
            </div>
            {st.task && <p className="text-sm text-hint">{st.task}</p>}
            {work && (
              <div className="rounded-xl bg-surface-1 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-hint">{t("web:share.submittedWork", { defaultValue: "Submitted work" })}</p>
                <SimpleMarkdown text={work} />
              </div>
            )}
            {fb && (
              <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-hint">{t("web:share.aiFeedback", { defaultValue: "AI feedback" })}</p>
                {fb.summary && <p className="text-sm text-primary">{fb.summary}</p>}
                {fb.strengths && fb.strengths.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-semibold text-success-text">{t("web:share.strengths", { defaultValue: "Strengths" })}</p>
                    <ul className="flex flex-col gap-1 text-sm text-primary">
                      {fb.strengths.map((x, i) => (
                        <li key={i} className="flex gap-2"><span className="font-bold text-success-text">+</span><span>{x}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {fb.improvements && fb.improvements.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-semibold text-link">{t("web:share.improvements", { defaultValue: "Ways to improve" })}</p>
                    <ul className="flex flex-col gap-1 text-sm text-primary">
                      {fb.improvements.map((x, i) => (
                        <li key={i} className="flex gap-2"><span className="font-bold text-link">→</span><span>{x}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {fb.follow_up && (
                  <p className="rounded-lg bg-brand-soft p-3 text-sm font-semibold text-primary">&ldquo;{fb.follow_up}&rdquo;</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {portfolio && (
        <div className={section}>
          <h2 className="text-base font-bold text-primary">{t("web:share.portfolio", { defaultValue: "Portfolio write-up" })}</h2>
          <SimpleMarkdown text={portfolio} />
        </div>
      )}
      <p className="text-xs text-hint">{t("web:share.readOnly", { defaultValue: "Read-only view." })}</p>
    </div>
  );
}

export function ProjectViewer({ name, files }: { name: string; files: ViewerFile[] }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(files[0]?.path ?? "");
  const current = files.find((f) => f.path === active) ?? files[0];
  const practical = parseState(files);
  if (practical) return <PracticalProjectView name={name} files={files} state={practical} />;
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4">
      <h1 className="text-lg font-bold text-primary">{name}</h1>
      {files.length === 0 ? (
        <p className="text-sm text-hint">{t("web:share.projectEmpty", { defaultValue: "This project has no files yet." })}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface-1 p-2">
            {files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setActive(f.path)}
                className={`truncate rounded px-2 py-1 text-left text-sm ${f.path === current?.path ? "bg-surface-3 font-semibold text-primary" : "text-primary hover:bg-surface-3"}`}
              >
                {f.path}
              </button>
            ))}
          </div>
          {current?.path.endsWith(".md") ? (
            <div className="max-h-96 overflow-auto rounded-lg border border-border bg-surface-1 p-4">
              <SimpleMarkdown text={current.content} />
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-1 p-3 text-xs text-primary">
              {current?.content}
            </pre>
          )}
        </div>
      )}
      <p className="text-xs text-hint">{t("web:share.readOnly", { defaultValue: "Read-only view." })}</p>
    </div>
  );
}
