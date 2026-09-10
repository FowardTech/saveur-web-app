import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// codingProjectsService — web client for the "Coding Projects" feature
// (Saveur-Backend/app/api/coding.py, "Coding Projects (multi-file 'mini VS
// Code')" section, commit 7fa99e9). A persisted, multi-file/folder code
// workspace — separate from the single-file LeetCode-style problem practice
// (lib usage inline in app/practice/coding/page.tsx and
// app/practice/coding/[slug]/page.tsx) — part of the same paid
// "coding_practice" add-on, so every call below can 402 the same way those
// pages already handle.
// ---------------------------------------------------------------------------

export type ProjectType = "web" | "script";

export interface CodingProjectSummary {
  id: number;
  name: string;
  projectType: ProjectType;
  languageHint?: string | null;
  createdAt?: string;
  updatedAt?: string;
  fileCount: number;
  totalSizeBytes: number;
}

export interface CodingProjectFile {
  path: string;
  content: string;
  sizeBytes?: number;
  updatedAt?: string;
}

export interface CodingProjectDetail extends CodingProjectSummary {
  files: CodingProjectFile[];
}

export interface RunResult {
  status?: string;
  passed?: boolean;
  stdout?: string | null;
  actual_output?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | number | null;
  memory?: string | number | null;
  entry_path?: string;
  multi_file_forwarded?: boolean;
}

interface ProjectWire {
  id: number;
  name: string;
  project_type: ProjectType;
  language_hint?: string | null;
  created_at?: string;
  updated_at?: string;
  file_count: number;
  total_size_bytes: number;
}

interface ProjectDetailWire extends ProjectWire {
  files: Array<{ path: string; content: string; size_bytes?: number; updated_at?: string }>;
}

function fromWire(w: ProjectWire): CodingProjectSummary {
  return {
    id: w.id,
    name: w.name,
    projectType: w.project_type,
    languageHint: w.language_hint,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    fileCount: w.file_count,
    totalSizeBytes: w.total_size_bytes,
  };
}

function detailFromWire(w: ProjectDetailWire): CodingProjectDetail {
  return {
    ...fromWire(w),
    files: (w.files || []).map((f) => ({
      path: f.path,
      content: f.content,
      sizeBytes: f.size_bytes,
      updatedAt: f.updated_at,
    })),
  };
}

/** GET /api/v1/coding/projects */
export async function listProjects(): Promise<CodingProjectSummary[]> {
  const data = await apiClient.get<ProjectWire[]>("/api/v1/coding/projects");
  return (data ?? []).map(fromWire);
}

/** POST /api/v1/coding/projects — body {name, project_type?, language_hint?} */
export async function createProject(name: string, projectType: ProjectType, languageHint?: string): Promise<CodingProjectSummary> {
  const data = await apiClient.post<ProjectWire>("/api/v1/coding/projects", {
    name,
    project_type: projectType,
    language_hint: languageHint,
  });
  return fromWire(data);
}

/** GET /api/v1/coding/projects/<id> — full project including file contents. */
export async function getProject(id: number | string): Promise<CodingProjectDetail> {
  const data = await apiClient.get<ProjectDetailWire>(`/api/v1/coding/projects/${id}`);
  return detailFromWire(data);
}

/**
 * PUT /api/v1/coding/projects/<id>/files — full authoritative replace. Always
 * send the COMPLETE current file tree, not a diff — any path not included
 * here is deleted server-side. Can 413 with {error: "project_too_large",
 * max_bytes, actual_bytes} — callers should catch that specifically (see
 * apiClient's ApiError.status) rather than showing a generic failure toast.
 */
export async function saveProjectFiles(id: number | string, files: Array<{ path: string; content: string }>): Promise<CodingProjectDetail> {
  const data = await apiClient.put<ProjectDetailWire>(`/api/v1/coding/projects/${id}/files`, { files });
  return detailFromWire(data);
}

/** POST /api/v1/coding/projects/<id>/rename — body {name} */
export async function renameProject(id: number | string, name: string): Promise<CodingProjectSummary> {
  const data = await apiClient.post<ProjectWire>(`/api/v1/coding/projects/${id}/rename`, { name });
  return fromWire(data);
}

/** DELETE /api/v1/coding/projects/<id> */
export async function deleteProject(id: number | string): Promise<void> {
  await apiClient.delete(`/api/v1/coding/projects/${id}`);
}

/**
 * POST /api/v1/coding/projects/<id>/run — "script" type projects only. Multi-
 * file execution is only reliably confirmed for interpreted languages
 * (Python/Node/Ruby/PHP) that resolve sibling files via their own
 * import/require — for compiled languages (C/C++/Go/Rust/etc.) this is
 * best-effort (see `multi_file_forwarded` on the result and the backend's
 * own docstring); the UI should not claim it definitely works.
 */
export async function runProject(id: number | string, entryPath: string, language: string, stdin?: string): Promise<RunResult> {
  return apiClient.post<RunResult>(`/api/v1/coding/projects/${id}/run`, {
    entry_path: entryPath,
    language,
    stdin,
  });
}

/** GET /api/v1/coding/languages — static list of Judge0-backed language keys
 * (e.g. "python", "javascript", "java", "cpp", "c", ...), not gated behind
 * the add-on. Shared by the single-file problem editor and the project
 * editor's language picker for "script" projects. */
export async function getLanguages(): Promise<string[]> {
  return apiClient.get<string[]>("/api/v1/coding/languages", { auth: false });
}

export const MAX_PROJECT_BYTES = 50 * 1024 * 1024;
