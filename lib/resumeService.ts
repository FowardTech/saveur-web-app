import i18n from "i18next";
import apiClient from "./apiClient";

function currentLanguage(): string {
  return i18n.language || "en";
}

// ---------------------------------------------------------------------------
// Web port of Saveur (mobile)'s services/resumeService.ts — the pieces
// app/resume/builder/page.tsx, app/resume/generate/page.tsx, and
// app/jd-analyzer/page.tsx all share: import sources, the structured
// resume/CV section shape, and export. Real backend —
// Saveur-Backend/app/api/resume.py + resume_gen.py.
// ---------------------------------------------------------------------------

export type ResumeImportSourceKey = "resume" | "linkedin" | "portfolio" | "certificates" | "transcript";

export interface ImportedFileInfo {
  name: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
}

export interface ResumeContact {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
}
export interface ResumeExperienceEntry {
  title?: string;
  company?: string;
  location?: string;
  start?: string;
  end?: string;
  bullets: string[];
}
export interface ResumeEducationEntry {
  school?: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
}
export interface ResumeProjectEntry {
  name?: string;
  description?: string;
  link?: string;
}
export interface ResumeVolunteerEntry {
  org?: string;
  role?: string;
  description?: string;
}
export interface ResumeReferenceEntry {
  name?: string;
  relationship?: string;
  contact?: string;
}
export interface ResumeSections {
  contact: ResumeContact;
  summary: string;
  coreSkills: string[];
  certifications: string[];
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
  projects: ResumeProjectEntry[];
  volunteer: ResumeVolunteerEntry[];
  awards: string[];
  languages: string[];
  references: ResumeReferenceEntry[];
  suggestedKeywords: string[];
}

interface ResumeSectionsWire {
  contact?: { name?: string; email?: string; phone?: string; location?: string; links?: string[] };
  summary?: string;
  core_skills?: string[];
  certifications?: string[];
  experience?: { title?: string; company?: string; location?: string; start?: string; end?: string; bullets?: string[] }[];
  education?: { school?: string; degree?: string; field?: string; start?: string; end?: string }[];
  projects?: { name?: string; description?: string; link?: string }[];
  volunteer?: { org?: string; role?: string; description?: string }[];
  awards?: string[];
  languages?: string[];
  references?: { name?: string; relationship?: string; contact?: string }[];
  suggested_keywords?: string[];
}

function fromSectionsWire(wire: ResumeSectionsWire): ResumeSections {
  return {
    contact: {
      name: wire.contact?.name,
      email: wire.contact?.email,
      phone: wire.contact?.phone,
      location: wire.contact?.location,
      links: wire.contact?.links ?? [],
    },
    summary: wire.summary ?? "",
    coreSkills: wire.core_skills ?? [],
    certifications: wire.certifications ?? [],
    experience: (wire.experience ?? []).map((e) => ({ title: e.title, company: e.company, location: e.location, start: e.start, end: e.end, bullets: e.bullets ?? [] })),
    education: wire.education ?? [],
    projects: wire.projects ?? [],
    volunteer: wire.volunteer ?? [],
    awards: wire.awards ?? [],
    languages: wire.languages ?? [],
    references: wire.references ?? [],
    suggestedKeywords: wire.suggested_keywords ?? [],
  };
}

function toSectionsWire(sections: ResumeSections): Record<string, unknown> {
  return {
    contact: sections.contact,
    summary: sections.summary,
    core_skills: sections.coreSkills,
    certifications: sections.certifications,
    experience: sections.experience.map((e) => ({ title: e.title, company: e.company, location: e.location, start: e.start, end: e.end, bullets: e.bullets })),
    education: sections.education,
    projects: sections.projects,
    volunteer: sections.volunteer,
    awards: sections.awards,
    languages: sections.languages,
    references: sections.references,
    suggested_keywords: sections.suggestedKeywords,
  };
}

export function emptyResumeSections(): ResumeSections {
  return {
    contact: {},
    summary: "",
    coreSkills: [],
    certifications: [],
    experience: [],
    education: [],
    projects: [],
    volunteer: [],
    awards: [],
    languages: [],
    references: [],
    suggestedKeywords: [],
  };
}

interface ResumeSourceWire {
  source_key: string;
  file_name: string;
  size_bytes?: number;
  mime_type?: string;
}
interface ResumeWire {
  sources?: ResumeSourceWire[];
  sections?: Record<string, unknown>;
  ats_score?: number | null;
}

/** GET /api/v1/resume — which import sources are already uploaded. */
export async function getImportedSources(): Promise<Record<string, ImportedFileInfo>> {
  const data = await apiClient.get<ResumeWire>("/api/v1/resume");
  const result: Record<string, ImportedFileInfo> = {};
  for (const source of data?.sources ?? []) {
    if (!source?.source_key) continue;
    result[source.source_key] = { name: source.file_name ?? "Uploaded file", sizeBytes: source.size_bytes ?? null, mimeType: source.mime_type ?? null };
  }
  return result;
}

/**
 * POST /api/v1/resume/upload — multipart upload of a picked file against one
 * of the fixed import-source slots (resume/linkedin/portfolio/certificates/
 * transcript). Mirrors mobile's ResumeBuilder.tsx "Import from" grid.
 */
export async function importSource(sourceKey: ResumeImportSourceKey, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("source_key", sourceKey);
  formData.append("file", file, file.name);
  await apiClient.upload("/api/v1/resume/upload", formData);
}

/**
 * POST /api/v1/resume/upload against an already-hosted "My Documents" file
 * instead of a fresh local file — mirrors mobile's onPickFromMyDocuments,
 * which re-posts the document's remote URL through the same import flow.
 */
export async function importSourceFromUrl(sourceKey: ResumeImportSourceKey, url: string, name: string, mimeType?: string | null): Promise<void> {
  const res = await fetch(url);
  const blob = await res.blob();
  const file = new File([blob], name, { type: mimeType || blob.type || "application/octet-stream" });
  await importSource(sourceKey, file);
}

/** GET /api/v1/resume's `sections`, converted to ResumeSections — null when
 * there's no real structured content yet (bar mirrors the backend's
 * has_structured_content check). */
export async function getStoredResumeSections(): Promise<ResumeSections | null> {
  const data = await apiClient.get<ResumeWire>("/api/v1/resume");
  const wire = (data?.sections ?? {}) as ResumeSectionsWire;
  const hasContent = !!wire.contact?.name || !!wire.summary || (wire.experience?.length ?? 0) > 0 || (wire.education?.length ?? 0) > 0 || (wire.core_skills?.length ?? 0) > 0;
  return hasContent ? fromSectionsWire(wire) : null;
}

/** PATCH /api/v1/resume — persist edited/generated sections. */
export async function updateResumeSections(sections: ResumeSections): Promise<void> {
  await apiClient.patch("/api/v1/resume", { sections: toSectionsWire(sections) });
}

/** POST /api/v1/resume/generate (Basic feature, @require_pro). */
export async function generateResume(input: {
  targetRole?: string;
  jdText?: string;
  existingResume?: ResumeSections | null;
  existingResumeDocumentId?: string | null;
}): Promise<ResumeSections> {
  const data = await apiClient.post<ResumeSectionsWire>("/api/v1/resume/generate", {
    target_role: input.targetRole,
    jd_text: input.jdText,
    existing_resume: input.existingResume ? toSectionsWire(input.existingResume) : undefined,
    existing_resume_document_id: input.existingResume ? undefined : input.existingResumeDocumentId ?? undefined,
    language: currentLanguage(),
  });
  return fromSectionsWire(data);
}

/** POST /api/v1/resume/ats-score. */
export async function analyzeResume(): Promise<{ atsScore: number; tips: string[] }> {
  const data = await apiClient.post<{ score?: number; suggestions?: string[] }>("/api/v1/resume/ats-score", { language: currentLanguage() });
  return { atsScore: data.score ?? 0, tips: data.suggestions ?? [] };
}

/** POST /api/v1/resume/rewrite-bullet. */
export async function rewriteBullet(text: string, opts?: { role?: string; tone?: string }): Promise<{ rewritten: string; explanation: string }> {
  const trimmed = text.trim().replace(/^[-•*]\s*/, "");
  const data = await apiClient.post<{ rewritten: string; explanation: string }>("/api/v1/resume/rewrite-bullet", {
    bullet: trimmed,
    role: opts?.role,
    tone: opts?.tone ?? "professional",
    language: currentLanguage(),
  });
  return { rewritten: data.rewritten, explanation: data.explanation };
}

/** POST /api/v1/resume/export — renders the stored sections server-side and
 * returns an https download link. `docType` picks "resume" vs "cv" (same
 * section schema, different document title). */
export async function exportResume(format: "pdf" | "docx", style: string, docType: "resume" | "cv" = "resume"): Promise<{ url?: string }> {
  const data = await apiClient.post<{ url?: string }>("/api/v1/resume/export", { format, style, doc_type: docType, language: currentLanguage() });
  return { url: data.url };
}
