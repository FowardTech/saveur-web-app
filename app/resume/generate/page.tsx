"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import * as resumeService from "@/lib/resumeService";
import type { ResumeSections, ResumeExperienceEntry, ResumeEducationEntry, ResumeProjectEntry, ResumeVolunteerEntry, ResumeReferenceEntry } from "@/lib/resumeService";
import { downloadUrlAsFile } from "@/lib/downloadFile";
import type { ApiError } from "@/lib/apiClient";

// Shared "Build a resume/CV" screen — web port of Saveur (mobile)'s
// src/more/GenerateResume.tsx. Reached from two entry points, same as
// mobile: Resume Builder's "Create My CV" (app/resume/builder/page.tsx) and
// JD Analyzer's "Build Resume" (app/jd-analyzer/page.tsx) — both just
// differ in query params / the sessionStorage handoff below.
//
// Real backend — Saveur-Backend/app/api/resume_gen.py + resume.py:
//   POST  /api/v1/resume/generate -> ResumeSections (Basic feature, @require_pro)
//   PATCH /api/v1/resume          -> saves {sections}
//   POST  /api/v1/resume/export   -> {url} (renders real .docx/.pdf server-side)
//
// jdText/useStoredResume/existingResumeDocumentId can be long/sensitive
// enough that they don't belong in a URL query string, so JD Analyzer
// stashes them in sessionStorage under RESUME_GEN_INPUT_KEY right before
// navigating here (one-shot hand-off, cleared on read — mirrors mobile's
// one-time navigation params). role/docType are short and safe as query
// params.
const RESUME_GEN_INPUT_KEY = "saveur:resumeGenerate:input";

interface HandoffInput {
  jdText?: string;
  useStoredResume?: boolean;
  existingResumeDocumentId?: string;
}

function readHandoff(): HandoffInput {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(RESUME_GEN_INPUT_KEY);
    sessionStorage.removeItem(RESUME_GEN_INPUT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

type ResumeStyle = "modern" | "classic" | "minimal";
const STYLE_OPTIONS: { key: ResumeStyle; labelKey: string; labelDefault: string; descKey: string; descDefault: string }[] = [
  { key: "modern", labelKey: "web:resume.generate.style.modern", labelDefault: "Modern", descKey: "web:resume.generate.style.modernDesc", descDefault: "Bold headings, accent color, single column." },
  { key: "classic", labelKey: "web:resume.generate.style.classic", labelDefault: "Classic", descKey: "web:resume.generate.style.classicDesc", descDefault: "Traditional serif layout, most ATS-safe." },
  { key: "minimal", labelKey: "web:resume.generate.style.minimal", labelDefault: "Minimal", descKey: "web:resume.generate.style.minimalDesc", descDefault: "Clean and compact, no color, dense." },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-2 text-sm font-semibold text-primary">{children}</h2>;
}

function ChipList({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-pill bg-surface-3 px-3 py-1.5 text-sm font-medium text-primary">
          {item}
          <button type="button" onClick={() => onRemove(i)} aria-label="Remove">
            <EvaIcon name="close-outline" size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}

function AddInline({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  function commit() {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue("");
  }
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      <Button type="button" size="sm" variant="secondary" onClick={commit}>
        <EvaIcon name="plus-outline" size={14} />
      </Button>
    </div>
  );
}

function StringListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => {
              const copy = items.slice();
              copy[i] = e.target.value;
              onChange(copy);
            }}
            className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2 text-sm text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button type="button" onClick={() => onChange(items.filter((_, ri) => ri !== i))} className="p-1.5 text-hint hover:text-danger" aria-label="Remove">
            <EvaIcon name="trash-2-outline" size={14} />
          </button>
        </div>
      ))}
      <AddInline placeholder={placeholder} onAdd={(v) => onChange([...items, v])} />
    </div>
  );
}

function ReorderControls({ index, count, onMove }: { index: number; count: number; onMove: (from: number, to: number) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} className="p-0.5 text-hint hover:text-primary disabled:opacity-30" aria-label="Move up">
        <EvaIcon name="chevron-up-outline" size={14} />
      </button>
      <button type="button" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className="p-0.5 text-hint hover:text-primary disabled:opacity-30" aria-label="Move down">
        <EvaIcon name="chevron-down-outline" size={14} />
      </button>
    </div>
  );
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function fieldInput(value: string | undefined, onChange: (v: string) => void, placeholder: string) {
  return (
    <input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
    />
  );
}

function GenerateResumeInner() {
  const { t } = useTranslation();
  const { isPro, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const docType = (searchParams.get("docType") === "cv" ? "cv" : "resume") as "resume" | "cv";

  const [role, setRole] = useState(searchParams.get("role") ?? "");
  const [style, setStyle] = useState<ResumeStyle>("modern");
  const [content, setContent] = useState<ResumeSections | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<"pdf" | "docx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const build = useCallback(
    async (targetRole: string, handoff: HandoffInput) => {
      setIsGenerating(true);
      setGenError(null);
      setProRequired(false);
      try {
        let existingResume: ResumeSections | null | undefined;
        if (handoff.useStoredResume) {
          existingResume = await resumeService.getStoredResumeSections();
        }
        const generated = await resumeService.generateResume({
          targetRole,
          jdText: handoff.jdText,
          existingResume,
          existingResumeDocumentId: existingResume ? undefined : handoff.existingResumeDocumentId,
        });
        setContent(generated);
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.status === 402 || apiErr.status === 403) {
          setProRequired(true);
        } else {
          setGenError(apiErr.message || t("web:resume.generate.genFailedDefault", { defaultValue: "Could not generate resume content." }));
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (authLoading) return;
    const handoff = readHandoff();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    build(role, handoff);
    // Only on mount — Regenerate below re-runs explicitly with current role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  function update<K extends keyof ResumeSections>(key: K, value: ResumeSections[K]) {
    setContent((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function addSuggestedSkill(skill: string) {
    setContent((prev) => {
      if (!prev) return prev;
      const already = prev.coreSkills.some((s) => s.toLowerCase() === skill.toLowerCase());
      return { ...prev, coreSkills: already ? prev.coreSkills : [...prev.coreSkills, skill], suggestedKeywords: prev.suggestedKeywords.filter((k) => k !== skill) };
    });
  }

  async function onSave() {
    if (!content || saving) return;
    setSaving(true);
    try {
      await resumeService.updateResumeSections(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setGenError(t("web:resume.generate.saveFailedDefault", { defaultValue: "Couldn't save your changes." }));
    } finally {
      setSaving(false);
    }
  }

  async function onDownload(format: "pdf" | "docx") {
    if (!content || downloadingFormat) return;
    setDownloadingFormat(format);
    setDownloadError(null);
    const label = docType === "cv" ? t("web:resume.generate.cvLabel", { defaultValue: "CV" }) : t("web:resume.generate.resumeLabel", { defaultValue: "Resume" });
    try {
      await resumeService.updateResumeSections(content);
      const { url } = await resumeService.exportResume(format, style, docType);
      if (!url) {
        setDownloadError(t("web:resume.generate.noFileDefault", { defaultValue: "Couldn't produce a downloadable file right now." }));
        return;
      }
      await downloadUrlAsFile(url, `${label}.${format}`);
    } catch {
      setDownloadError(t("web:resume.generate.downloadFailedDefault", { defaultValue: "Couldn't download the file. Please try again." }));
    } finally {
      setDownloadingFormat(null);
    }
  }

  const title = docType === "cv" ? t("web:resume.generate.titleCv", { defaultValue: "Build My CV" }) : t("web:resume.generate.titleResume", { defaultValue: "Build Matching Resume" });

  if (!isPro) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
          <EvaIcon name="lock-outline" size={20} />
        </span>
        <h2 className="font-semibold text-primary">{t("web:resume.generate.proRequiredTitle", { defaultValue: "Building a resume/CV is a Basic feature" })}</h2>
        <p className="text-sm text-hint">{t("web:resume.generate.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above to unlock AI resume generation." })}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
      <PageHeader title={title} subtitle={t("web:resume.generate.subtitle", { defaultValue: "Edit any section, then download as Word or PDF." })} />

      <div className="flex items-end gap-2 rounded-card border border-border bg-surface-2 p-4">
        <div className="flex-1">
          <TextField label={t("web:resume.generate.targetRoleLabel", { defaultValue: "Target role" })} value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isGenerating} onClick={() => build(role, {})}>
          {isGenerating ? "…" : t("web:resume.generate.regenerate", { defaultValue: "Regenerate" })}
        </Button>
      </div>

      {proRequired && (
        <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
            <EvaIcon name="lock-outline" size={20} />
          </span>
          <h2 className="font-semibold text-primary">{t("web:resume.generate.proRequiredTitle", { defaultValue: "Building a resume/CV is a Basic feature" })}</h2>
          <p className="text-sm text-hint">{t("web:resume.generate.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above to unlock AI resume generation." })}</p>
        </div>
      )}

      {isGenerating && (
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isGenerating && genError && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-danger">{genError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => build(role, {})}>
            {t("common:try_again", { defaultValue: "Try again" })}
          </Button>
        </div>
      )}

      {!isGenerating && content && !proRequired && (
        <div className="flex flex-col gap-5 rounded-card border border-border bg-surface-2 p-6">
          <SectionHeading>{t("web:resume.generate.contact", { defaultValue: "Contact Info" })}</SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fieldInput(content.contact.name, (v) => update("contact", { ...content.contact, name: v }), t("web:resume.generate.fullName", { defaultValue: "Full name" }).toString())}
            {fieldInput(content.contact.email, (v) => update("contact", { ...content.contact, email: v }), t("common:fields.email", { defaultValue: "Email" }).toString())}
            {fieldInput(content.contact.phone, (v) => update("contact", { ...content.contact, phone: v }), t("web:resume.generate.phone", { defaultValue: "Phone" }).toString())}
            {fieldInput(content.contact.location, (v) => update("contact", { ...content.contact, location: v }), t("web:resume.generate.location", { defaultValue: "Location" }).toString())}
          </div>

          <SectionHeading>{t("web:resume.generate.summary", { defaultValue: "Professional Summary" })}</SectionHeading>
          <textarea
            rows={4}
            value={content.summary}
            onChange={(e) => update("summary", e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />

          <SectionHeading>{t("web:resume.generate.coreSkills", { defaultValue: "Core Skills" })}</SectionHeading>
          <ChipList items={content.coreSkills} onRemove={(i) => update("coreSkills", content.coreSkills.filter((_, si) => si !== i))} />
          <AddInline placeholder={t("web:resume.generate.addSkill", { defaultValue: "Add a skill…" }).toString()} onAdd={(v) => update("coreSkills", [...content.coreSkills, v])} />

          <SectionHeading>{t("web:resume.generate.certifications", { defaultValue: "Certifications" })}</SectionHeading>
          <StringListEditor items={content.certifications} onChange={(next) => update("certifications", next)} placeholder={t("web:resume.generate.addCertification", { defaultValue: "Add a certification…" }).toString()} />

          <SectionHeading>{t("web:resume.generate.experience", { defaultValue: "Professional Experience" })}</SectionHeading>
          <div className="flex flex-col gap-3">
            {content.experience.map((entry, i) => (
              <div key={i} className="flex gap-2 rounded-lg border border-border bg-surface-1 p-3">
                <ReorderControls index={i} count={content.experience.length} onMove={(from, to) => update("experience", moveItem(content.experience, from, to))} />
                <div className="flex-1 flex flex-col gap-2">
                  {fieldInput(entry.title, (v) => update("experience", content.experience.map((e, ei) => (ei === i ? { ...e, title: v } : e))), t("web:resume.generate.jobTitle", { defaultValue: "Job title" }).toString())}
                  {fieldInput(entry.company, (v) => update("experience", content.experience.map((e, ei) => (ei === i ? { ...e, company: v } : e))), t("web:resume.generate.company", { defaultValue: "Company" }).toString())}
                  <div className="grid grid-cols-2 gap-2">
                    {fieldInput(entry.start, (v) => update("experience", content.experience.map((e, ei) => (ei === i ? { ...e, start: v } : e))), t("web:resume.generate.start", { defaultValue: "Start" }).toString())}
                    {fieldInput(entry.end, (v) => update("experience", content.experience.map((e, ei) => (ei === i ? { ...e, end: v } : e))), t("web:resume.generate.end", { defaultValue: "End (or Present)" }).toString())}
                  </div>
                  <StringListEditor
                    items={entry.bullets}
                    onChange={(next) => update("experience", content.experience.map((e, ei) => (ei === i ? { ...e, bullets: next } : e)))}
                    placeholder={t("web:resume.generate.addHighlight", { defaultValue: "Add highlight…" }).toString()}
                  />
                </div>
                <button type="button" onClick={() => update("experience", content.experience.filter((_, ei) => ei !== i))} className="h-fit p-1.5 text-hint hover:text-danger" aria-label="Remove">
                  <EvaIcon name="trash-2-outline" size={14} />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => update("experience", [...content.experience, { title: "", company: "", location: "", start: "", end: "", bullets: [] } as ResumeExperienceEntry])}>
              <EvaIcon name="plus-outline" size={14} />
              {t("web:resume.generate.addExperience", { defaultValue: "Add work experience" })}
            </Button>
          </div>

          <SectionHeading>{t("web:resume.generate.education", { defaultValue: "Education" })}</SectionHeading>
          <div className="flex flex-col gap-3">
            {content.education.map((entry, i) => (
              <div key={i} className="flex gap-2 rounded-lg border border-border bg-surface-1 p-3">
                <ReorderControls index={i} count={content.education.length} onMove={(from, to) => update("education", moveItem(content.education, from, to))} />
                <div className="flex-1 flex flex-col gap-2">
                  {fieldInput(entry.school, (v) => update("education", content.education.map((e, ei) => (ei === i ? { ...e, school: v } : e))), t("web:resume.generate.school", { defaultValue: "School" }).toString())}
                  {fieldInput(entry.degree, (v) => update("education", content.education.map((e, ei) => (ei === i ? { ...e, degree: v } : e))), t("web:resume.generate.degree", { defaultValue: "Degree" }).toString())}
                  <div className="grid grid-cols-2 gap-2">
                    {fieldInput(entry.start, (v) => update("education", content.education.map((e, ei) => (ei === i ? { ...e, start: v } : e))), t("web:resume.generate.start", { defaultValue: "Start" }).toString())}
                    {fieldInput(entry.end, (v) => update("education", content.education.map((e, ei) => (ei === i ? { ...e, end: v } : e))), t("web:resume.generate.end", { defaultValue: "End (or Present)" }).toString())}
                  </div>
                </div>
                <button type="button" onClick={() => update("education", content.education.filter((_, ei) => ei !== i))} className="h-fit p-1.5 text-hint hover:text-danger" aria-label="Remove">
                  <EvaIcon name="trash-2-outline" size={14} />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => update("education", [...content.education, { school: "", degree: "", field: "", start: "", end: "" } as ResumeEducationEntry])}>
              <EvaIcon name="plus-outline" size={14} />
              {t("web:resume.generate.addEducation", { defaultValue: "Add education" })}
            </Button>
          </div>

          <SectionHeading>{t("web:resume.generate.projects", { defaultValue: "Projects & Publications" })}</SectionHeading>
          <div className="flex flex-col gap-3">
            {content.projects.map((entry, i) => (
              <div key={i} className="flex gap-2 rounded-lg border border-border bg-surface-1 p-3">
                <ReorderControls index={i} count={content.projects.length} onMove={(from, to) => update("projects", moveItem(content.projects, from, to))} />
                <div className="flex-1 flex flex-col gap-2">
                  {fieldInput(entry.name, (v) => update("projects", content.projects.map((e, ei) => (ei === i ? { ...e, name: v } : e))), t("web:resume.generate.projectName", { defaultValue: "Project name" }).toString())}
                  {fieldInput(entry.description, (v) => update("projects", content.projects.map((e, ei) => (ei === i ? { ...e, description: v } : e))), t("web:resume.generate.description", { defaultValue: "Description" }).toString())}
                </div>
                <button type="button" onClick={() => update("projects", content.projects.filter((_, ei) => ei !== i))} className="h-fit p-1.5 text-hint hover:text-danger" aria-label="Remove">
                  <EvaIcon name="trash-2-outline" size={14} />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => update("projects", [...content.projects, { name: "", description: "", link: "" } as ResumeProjectEntry])}>
              <EvaIcon name="plus-outline" size={14} />
              {t("web:resume.generate.addProject", { defaultValue: "Add a project" })}
            </Button>
          </div>

          <SectionHeading>{t("web:resume.generate.volunteer", { defaultValue: "Volunteer Experience" })}</SectionHeading>
          <div className="flex flex-col gap-3">
            {content.volunteer.map((entry, i) => (
              <div key={i} className="flex gap-2 rounded-lg border border-border bg-surface-1 p-3">
                <ReorderControls index={i} count={content.volunteer.length} onMove={(from, to) => update("volunteer", moveItem(content.volunteer, from, to))} />
                <div className="flex-1 flex flex-col gap-2">
                  {fieldInput(entry.role, (v) => update("volunteer", content.volunteer.map((e, ei) => (ei === i ? { ...e, role: v } : e))), t("web:resume.generate.role", { defaultValue: "Role" }).toString())}
                  {fieldInput(entry.org, (v) => update("volunteer", content.volunteer.map((e, ei) => (ei === i ? { ...e, org: v } : e))), t("web:resume.generate.organization", { defaultValue: "Organization" }).toString())}
                </div>
                <button type="button" onClick={() => update("volunteer", content.volunteer.filter((_, ei) => ei !== i))} className="h-fit p-1.5 text-hint hover:text-danger" aria-label="Remove">
                  <EvaIcon name="trash-2-outline" size={14} />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => update("volunteer", [...content.volunteer, { org: "", role: "", description: "" } as ResumeVolunteerEntry])}>
              <EvaIcon name="plus-outline" size={14} />
              {t("web:resume.generate.addVolunteer", { defaultValue: "Add volunteer experience" })}
            </Button>
          </div>

          <SectionHeading>{t("web:resume.generate.awards", { defaultValue: "Awards & Achievements" })}</SectionHeading>
          <StringListEditor items={content.awards} onChange={(next) => update("awards", next)} placeholder={t("web:resume.generate.addAward", { defaultValue: "Add an award…" }).toString()} />

          <SectionHeading>{t("web:resume.generate.languages", { defaultValue: "Languages" })}</SectionHeading>
          <StringListEditor items={content.languages} onChange={(next) => update("languages", next)} placeholder={t("web:resume.generate.addLanguage", { defaultValue: "Add a language…" }).toString()} />

          <SectionHeading>{t("web:resume.generate.references", { defaultValue: "References" })}</SectionHeading>
          <div className="flex flex-col gap-3">
            {content.references.map((entry, i) => (
              <div key={i} className="flex gap-2 rounded-lg border border-border bg-surface-1 p-3">
                <ReorderControls index={i} count={content.references.length} onMove={(from, to) => update("references", moveItem(content.references, from, to))} />
                <div className="flex-1 flex flex-col gap-2">
                  {fieldInput(entry.name, (v) => update("references", content.references.map((e, ei) => (ei === i ? { ...e, name: v } : e))), t("web:resume.generate.name", { defaultValue: "Name" }).toString())}
                  {fieldInput(entry.relationship, (v) => update("references", content.references.map((e, ei) => (ei === i ? { ...e, relationship: v } : e))), t("web:resume.generate.relationship", { defaultValue: "Relationship" }).toString())}
                  {fieldInput(entry.contact, (v) => update("references", content.references.map((e, ei) => (ei === i ? { ...e, contact: v } : e))), t("web:resume.generate.contactInfo", { defaultValue: "Contact info" }).toString())}
                </div>
                <button type="button" onClick={() => update("references", content.references.filter((_, ei) => ei !== i))} className="h-fit p-1.5 text-hint hover:text-danger" aria-label="Remove">
                  <EvaIcon name="trash-2-outline" size={14} />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => update("references", [...content.references, { name: "", relationship: "", contact: "" } as ResumeReferenceEntry])}>
              <EvaIcon name="plus-outline" size={14} />
              {t("web:resume.generate.addReference", { defaultValue: "Add a reference" })}
            </Button>
          </div>

          {content.suggestedKeywords.length > 0 && (
            <>
              <SectionHeading>{t("web:resume.generate.considerAdding", { defaultValue: "Consider Adding" })}</SectionHeading>
              <p className="text-xs text-hint">{t("web:resume.generate.considerAddingHint", { defaultValue: "Click a skill to add it to Core Skills" })}</p>
              <div className="flex flex-wrap gap-2">
                {content.suggestedKeywords.map((skill, i) => (
                  <button key={i} type="button" onClick={() => addSuggestedSkill(skill)} className="inline-flex items-center gap-1 rounded-pill border border-dashed border-border bg-surface-1 px-3 py-1.5 text-sm font-medium text-primary hover:border-brand">
                    <EvaIcon name="plus-outline" size={12} />
                    {skill}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={saving}>
              {saving ? t("web:resume.generate.saving", { defaultValue: "Saving…" }) : saved ? t("web:resume.generate.saved", { defaultValue: "Saved ✓" }) : t("web:resume.generate.saveChanges", { defaultValue: "Save changes" })}
            </Button>
          </div>

          <SectionHeading>{t("web:resume.generate.styleTitle", { defaultValue: "Style" })}</SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStyle(opt.key)}
                className={`rounded-card border-2 p-3 text-left transition ${style === opt.key ? "border-brand bg-brand/5" : "border-border bg-surface-1 hover:border-brand/40"}`}
              >
                <p className={`text-sm font-semibold ${style === opt.key ? "text-brand" : "text-primary"}`}>{t(opt.labelKey, { defaultValue: opt.labelDefault })}</p>
                <p className="mt-1 text-xs text-hint">{t(opt.descKey, { defaultValue: opt.descDefault })}</p>
              </button>
            ))}
          </div>

          {downloadError && <p className="text-sm text-danger">{downloadError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" disabled={!!downloadingFormat} onClick={() => onDownload("docx")} className="flex-1">
              <EvaIcon name="download-outline" size={16} />
              {downloadingFormat === "docx" ? t("web:resume.generate.preparing", { defaultValue: "Preparing…" }) : t("web:resume.generate.downloadWord", { defaultValue: "Download as Word (.docx)" })}
            </Button>
            <Button type="button" variant="outline" disabled={!!downloadingFormat} onClick={() => onDownload("pdf")} className="flex-1">
              {downloadingFormat === "pdf" ? t("web:resume.generate.preparing", { defaultValue: "Preparing…" }) : t("web:resume.generate.downloadPdf", { defaultValue: "Download as PDF" })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GenerateResumePage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<div className="mx-auto max-w-2xl py-10 text-sm text-hint">Loading…</div>}>
          <GenerateResumeInner />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
