"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { SimpleMarkdown } from "@/components/ui/SimpleMarkdown";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { ShareToUserModal } from "@/components/jobAlerts/ShareToUserModal";
import { useAuth } from "@/app/providers/AuthProvider";
import type { ApiError } from "@/lib/apiClient";
import * as service from "@/lib/practicalProjectsService";
import type { PracticalProjectDetail, PracticalProjectSummary } from "@/lib/practicalProjectsService";
import * as projectActions from "@/lib/projectActionsService";

const INDUSTRIES = ["healthcare", "sales", "marketing", "finance", "consulting", "science"];

// Industry-based projects for Practical Scenarios: pick an industry, the AI
// writes a realistic project brief, the learner writes their solution, then
// can send it to the AI coach for analysis, share it, or export it as a zip.
export default function PracticalProjectsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [role, setRole] = useState("");
  const [projects, setProjects] = useState<PracticalProjectSummary[] | null>(null);
  const [active, setActive] = useState<PracticalProjectDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [openStage, setOpenStage] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<service.StageAttachment[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [finishing, setFinishing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setProjects(await service.listPracticalProjects());
    } catch (e) {
      if ((e as ApiError).status === 402) setAddonRequired(true);
      else setError((e as ApiError).message);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function open(id: number) {
    setError(null);
    try {
      const p = await service.getPracticalProject(id);
      setActive(p);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function create() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const p = await service.createPracticalProject(industry, role.trim() || undefined);
      setActive(p);
      load();
    } catch (e) {
      if ((e as ApiError).status === 402) setAddonRequired(true);
      else setError((e as ApiError).message || t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." }));
    } finally {
      setCreating(false);
    }
  }

  function beginStage(n: number) {
    if (!active) return;
    setDrafts((d) => ({ ...d, [n]: d[n] ?? (() => { const f0 = active.files.find((f) => f.path === `STAGE_${n}.md`); return f0?.content_original ?? f0?.content ?? ""; })() }));
    setAttachments([]);
    setMediaUrl("");
    setOpenStage(n);
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active || attaching) return;
    setAttaching(true);
    setError(null);
    try {
      const att = await service.uploadStageDocument(active.id, file);
      setAttachments((prev) => [...prev, att].slice(0, 5));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setAttaching(false);
    }
  }

  async function onAttachUrl() {
    if (!active || attaching || !mediaUrl.trim()) return;
    setAttaching(true);
    setError(null);
    try {
      const att = await service.attachStageMediaUrl(active.id, mediaUrl.trim());
      setAttachments((prev) => [...prev, att].slice(0, 5));
      setMediaUrl("");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setAttaching(false);
    }
  }

  async function submitStage(n: number) {
    if (!active || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const template = active.state?.stages.find((x) => x.n === n)?.template ?? "";
      const draft = drafts[n] ?? "";
      // An untouched generated template is not the learner's work - don't send it when they attached their own.
      const content = attachments.length > 0 && draft.trim() === template.trim() ? "" : draft;
      setActive(await service.submitProjectStage(active.id, n, content, attachments));
      setOpenStage(null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function finish() {
    if (!active || finishing) return;
    setFinishing(true);
    try {
      setActive(await service.finishPracticalProject(active.id));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setFinishing(false);
    }
  }

  const brief = active?.files.find((f) => f.path === "BRIEF.md")?.content ?? "";

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:practice.scenarios.projects.title", { defaultValue: "Industry Projects" })}
            subtitle={t("web:practice.scenarios.projects.subtitle", { defaultValue: "Build a realistic project for your field, then get your AI coach to review it." })}
          />
          {addonRequired && (
            <p className="rounded-card border border-border bg-surface-2 p-4 text-sm text-hint">
              {t("web:practice.scenarios.addonRequiredSubtitle", { defaultValue: "Purchase the Practical Scenarios add-on from your account to unlock this practice mode." })}
            </p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}

          {!active && !addonRequired && (
            <>
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                <span className="text-sm font-medium text-primary">{t("web:practice.scenarios.scenarioTypeLabel", { defaultValue: "Choose a field" })}</span>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((i) => (
                    <Pill key={i} selected={i === industry} onClick={() => setIndustry(i)}>
                      {t(`web:practice.scenarios.types.${i}`, { defaultValue: i[0].toUpperCase() + i.slice(1) })}
                    </Pill>
                  ))}
                </div>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t("web:practice.scenarios.rolePlaceholder", { defaultValue: "e.g. Registered Nurse, Account Executive" })}
                  className="rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-primary focus:outline-none"
                />
                <Button onClick={create} disabled={creating}>
                  {creating ? t("web:practice.scenarios.projects.generating", { defaultValue: "Generating project…" }) : t("web:practice.scenarios.projects.generate", { defaultValue: "Generate a project" })}
                </Button>
              </div>

              {projects && projects.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold text-primary">{t("web:practice.scenarios.projects.yours", { defaultValue: "Your projects" })}</h2>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => open(p.id)}
                      className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-4 text-left hover:shadow-sm"
                    >
                      <span className="text-sm font-medium text-primary">{p.name}</span>
                      <span className="text-xs capitalize text-hint">{p.industry}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {active && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setActive(null)} className="text-sm font-medium text-hint hover:text-primary">
                  ← {t("common:actions.back", { defaultValue: "Back" })}
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
                    <EvaIcon name="share-outline" size={14} /> {t("web:practice.codingProjects.share", { defaultValue: "Share" })}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => projectActions.exportProjectZip("practical", active.id).catch((e) => setError((e as ApiError).message))}>
                    <EvaIcon name="download-outline" size={14} /> {t("web:practice.codingProjects.export", { defaultValue: "Export" })}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => router.push(`/ai-coach?codingProjectId=${active.id}&codingProjectName=${encodeURIComponent(active.name)}`)}
                  >
                    <EvaIcon name="message-circle-outline" size={14} /> {t("web:practice.codingProjects.analyzeWithCoach", { defaultValue: "Analyze with your coach" })}
                  </Button>
                </div>
              </div>
              <h2 className="text-lg font-bold text-primary">{active.name}</h2>
              {active.state && (
                <p className="text-xs text-hint">
                  {t("web:practice.scenarios.projects.reportingTo", { defaultValue: "You report to {{name}}, {{title}}", name: active.state.persona.name, title: active.state.persona.title })}
                </p>
              )}
              <div className="rounded-card border border-border bg-surface-2 p-4"><SimpleMarkdown text={brief} /></div>
              {active.state?.stages.map((st) => {
                const locked = st.status === "locked";
                const done = st.status === "done";
                const fb = st.feedback;
                return (
                  <div key={st.n} className={`flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 ${locked ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-solid text-solid-fg" : "bg-surface-3 text-primary"}`}>{done ? "✓" : st.n}</span>
                      <h3 className="flex-1 text-sm font-bold text-primary">{st.title}</h3>
                      {fb && <span className="text-sm font-bold text-primary">{fb.score}/100</span>}
                    </div>
                    {locked ? (
                      <p className="text-xs text-hint">{t("web:practice.scenarios.projects.locked", { defaultValue: "Complete the previous stage to unlock" })}</p>
                    ) : (
                      <>
                        <p className="text-sm text-primary">{st.task}</p>
                        {st.twist && (
                          <div className="rounded-lg bg-surface-3 p-3 text-sm text-primary">
                            <strong>{t("web:practice.scenarios.projects.twist", { defaultValue: "Update from your manager" })}:</strong> {st.twist}
                          </div>
                        )}
                        {fb && (
                          <div className="flex flex-col gap-1 rounded-lg bg-surface-3 p-3 text-sm text-primary">
                            <strong>{fb.passed ? t("web:practice.scenarios.projects.approved", { defaultValue: "Approved" }) : t("web:practice.scenarios.projects.needsRevision", { defaultValue: "Needs revision" })}</strong>
                            <p>{fb.summary}</p>
                            {fb.strengths.map((x, i) => <p key={`s${i}`}>+ {x}</p>)}
                            {fb.improvements.map((x, i) => <p key={`i${i}`}>→ {x}</p>)}
                            {fb.follow_up && <p className="font-semibold">“{fb.follow_up}”</p>}
                          </div>
                        )}
                        {openStage === st.n ? (
                          <>
                            <textarea
                              value={drafts[st.n] ?? ""}
                              onChange={(e) => setDrafts((d) => ({ ...d, [st.n]: e.target.value }))}
                              rows={14}
                              className="w-full rounded-card border border-border bg-surface-2 p-4 font-mono text-sm text-primary focus:border-primary focus:outline-none"
                            />
                            {(() => {
                              const dtype = st.deliverable_type ?? "text";
                              const isMedia = dtype === "audio" || dtype === "video";
                              return (
                                <div className="rounded-card border border-border bg-surface-2 p-4">
                                  <p className="text-sm font-semibold text-primary">
                                    {t("web:practice.scenarios.projects.attachTitle", { defaultValue: "Or attach your own work" })}
                                  </p>
                                  <p className="mt-1 text-xs text-hint">
                                    {isMedia
                                      ? t("web:practice.scenarios.projects.attachMediaHint", { defaultValue: "Upload your {{type}} to Google Drive, Dropbox or similar, set it to “anyone with the link”, and paste the link. The AI will transcribe and review it.", type: dtype })
                                      : t("web:practice.scenarios.projects.attachDocHint", { defaultValue: "Upload a PDF, Word, PowerPoint, Excel, CSV or text file instead of editing the draft. The AI will read it." })}
                                  </p>
                                  {isMedia ? (
                                    <div className="mt-3 flex gap-2">
                                      <input
                                        type="url"
                                        value={mediaUrl}
                                        onChange={(e) => setMediaUrl(e.target.value)}
                                        placeholder={t("web:practice.scenarios.projects.attachUrlPlaceholder", { defaultValue: "https://… public link" })}
                                        className="min-w-0 flex-1 rounded-card border border-primary bg-surface-1 px-3 py-2 text-sm text-primary focus:outline-none"
                                      />
                                      <Button size="sm" onClick={onAttachUrl} disabled={attaching || !mediaUrl.trim()}>
                                        {attaching ? t("common:actions.loading", { defaultValue: "Loading…" }) : t("web:practice.scenarios.projects.attachAdd", { defaultValue: "Add" })}
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="mt-3">
                                      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md" onChange={onFileChosen} />
                                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={attaching || attachments.length >= 5}>
                                        {attaching ? t("common:actions.loading", { defaultValue: "Loading…" }) : t("web:practice.scenarios.projects.attachFile", { defaultValue: "Choose a file" })}
                                      </Button>
                                    </div>
                                  )}
                                  {attachments.length > 0 && (
                                    <ul className="mt-3 space-y-2">
                                      {attachments.map((a, i) => (
                                        <li key={`${a.name}-${i}`} className="flex items-center justify-between gap-2 text-sm text-primary">
                                          <span className="flex min-w-0 items-center gap-2">
                                            <EvaIcon name={a.kind === "media" ? "headphones-outline" : "file-text-outline"} size={16} />
                                            <span className="truncate">{a.name}</span>
                                          </span>
                                          <button type="button" aria-label="Remove" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-hint transition hover:text-primary">
                                            <EvaIcon name="close-outline" size={16} />
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })()}
                            <div className="flex gap-2">
                              <Button onClick={() => submitStage(st.n)} disabled={submitting || ((drafts[st.n] ?? "").trim().length < 40 && attachments.length === 0)}>
                                {submitting ? t("web:practice.scenarios.projects.reviewing", { defaultValue: "Your manager is reviewing…" }) : t("web:practice.scenarios.projects.submitTo", { defaultValue: "Submit to {{name}}", name: active.state?.persona.name ?? "manager" })}
                              </Button>
                              <Button variant="outline" onClick={() => setOpenStage(null)}>{t("common:actions.cancel", { defaultValue: "Cancel" })}</Button>
                            </div>
                          </>
                        ) : (
                          <div><Button size="sm" onClick={() => beginStage(st.n)}>
                            {done ? t("web:practice.scenarios.projects.revise", { defaultValue: "Revise my work" }) : fb ? t("web:practice.scenarios.projects.resubmit", { defaultValue: "Revise and resubmit" }) : t("web:practice.scenarios.projects.startStage", { defaultValue: "Start this stage" })}
                          </Button></div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {active.state && active.state.stages.every((x) => x.status === "done") && (
                active.state.final ? (
                  <div className="flex flex-col gap-1 rounded-card border border-border bg-surface-2 p-4 text-sm text-primary">
                    <h3 className="font-bold">{t("web:practice.scenarios.projects.finalReview", { defaultValue: "Final review" })} · {active.state.final.overall_score}/100</h3>
                    <p>{active.state.final.verdict}</p>
                    {active.state.final.top_strengths.map((x, i) => <p key={`fs${i}`}>+ {x}</p>)}
                    {active.state.final.growth_areas.map((x, i) => <p key={`fg${i}`}>→ {x}</p>)}
                    <p className="mt-2 text-xs text-hint">{t("web:practice.scenarios.projects.portfolioReady", { defaultValue: "Your portfolio write-up is saved. Use Export or Share above." })}</p>
                  </div>
                ) : (
                  <div><Button onClick={finish} disabled={finishing}>{finishing ? t("web:practice.scenarios.projects.finishing", { defaultValue: "Preparing your review…" }) : t("web:practice.scenarios.projects.finish", { defaultValue: "Finish and get final review" })}</Button></div>
                )
              )}
              <ShareToUserModal
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                contentType="project"
                contentId={active.id}
                getPublicLink={() => projectActions.getProjectPublicUrl("practical", active.id)}
              />
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
