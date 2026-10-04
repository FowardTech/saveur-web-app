import i18n from "i18next";
import apiClient from "./apiClient";

// Practical Scenario projects (Saveur-Backend app/api/practical.py,
// "Practical Scenario PROJECTS" section) — industry-specific written
// deliverables stored as CodingProject rows with project_type="practical".
export interface StageFeedback {
  score: number;
  passed: boolean;
  summary: string;
  strengths: string[];
  improvements: string[];
  follow_up: string;
}
export interface ProjectStage {
  n: number;
  title: string;
  task: string;
  template: string;
  twist: string;
  deliverable_type?: "text" | "document" | "presentation" | "spreadsheet" | "audio" | "video";
  status: "locked" | "active" | "done";
  attempts: number;
  feedback: StageFeedback | null;
}
export interface ProjectState {
  persona: {name: string; title: string};
  stages: ProjectStage[];
  final: null | {overall_score: number; verdict: string; top_strengths: string[]; growth_areas: string[]};
}
export interface PracticalProjectSummary {
  id: number;
  name: string;
  industry: string;
  updatedAt?: string;
  status?: "completed" | "in_progress";
  stagesDone?: number;
  stagesTotal?: number;
}
export interface PracticalProjectDetail extends PracticalProjectSummary {
  state?: ProjectState | null;
  files: { path: string; content: string; content_original?: string }[];
}

interface Wire {
  progress?: { status: "completed" | "in_progress"; stages_done: number; stages_total: number };
  id: number;
  name: string;
  language_hint?: string | null;
  updated_at?: string;
  files?: { path: string; content: string; content_original?: string }[];
  state?: ProjectState | null;
}
const sum = (w: Wire): PracticalProjectSummary => ({ id: w.id, name: w.name, industry: w.language_hint ?? "", updatedAt: w.updated_at, status: w.progress?.status, stagesDone: w.progress?.stages_done, stagesTotal: w.progress?.stages_total });
const detail = (w: Wire): PracticalProjectDetail => ({ ...sum(w), files: w.files ?? [], state: w.state ?? null });

export async function listPracticalProjects(): Promise<PracticalProjectSummary[]> {
  return (await apiClient.get<Wire[]>("/api/v1/practical/projects")).map(sum);
}
export async function createPracticalProject(type: string, role?: string): Promise<PracticalProjectDetail> {
  return detail(await apiClient.post<Wire>("/api/v1/practical/projects", { type, role, language: i18n.language || "en" }));
}
export async function getPracticalProject(id: number | string): Promise<PracticalProjectDetail> {
  return detail(await apiClient.get<Wire>(`/api/v1/practical/projects/${id}`));
}
export async function savePracticalProject(id: number | string, files: { path: string; content: string }[]): Promise<PracticalProjectDetail> {
  return detail(await apiClient.put<Wire>(`/api/v1/practical/projects/${id}/files`, { files }));
}
export async function deletePracticalProject(id: number | string): Promise<void> {
  await apiClient.delete(`/api/v1/practical/projects/${id}`);
}

export interface StageAttachment {
  name: string;
  kind: "document" | "media";
  text: string;
  truncated?: boolean;
}

export async function submitProjectStage(
  id: number | string,
  n: number,
  content: string,
  attachments: StageAttachment[] = [],
): Promise<PracticalProjectDetail> {
  return detail(await apiClient.post<Wire>(`/api/v1/practical/projects/${id}/stages/${n}/submit`, { content, attachments }));
}

/** Upload a document (pdf/docx/pptx/xlsx/csv/txt/md); the backend returns its extracted text. */
export async function uploadStageDocument(
  id: number | string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<StageAttachment> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return apiClient.uploadWithProgress<StageAttachment>(
    `/api/v1/practical/projects/${id}/attachments/file`,
    formData,
    onProgress ?? (() => {}),
  );
}

/** Attach a public audio/video link; the backend transcribes it. */
export async function attachStageMediaUrl(id: number | string, url: string): Promise<StageAttachment> {
  return apiClient.post<StageAttachment>(`/api/v1/practical/projects/${id}/attachments/url`, { url });
}
export async function finishPracticalProject(id: number | string): Promise<PracticalProjectDetail> {
  return detail(await apiClient.post<Wire>(`/api/v1/practical/projects/${id}/finish`, {}));
}
