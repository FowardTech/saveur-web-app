import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// Web port of Saveur (mobile)'s services/generatedDocumentsService.ts —
// "Generated Documents": every resume/CV, cover letter, and tailored resume
// variant this user has ever exported to PDF/DOCX, so a previous export can
// be redownloaded without regenerating it from scratch. See
// Saveur-Backend/app/models/generated_document.py — purely an index over
// files already uploaded by resume_gen.py's/resume_variants.py's own export
// endpoints; nothing here creates a new file.
//
// Distinct from lib/documentsService.ts ("My Documents"), which manages the
// user's own uploaded SOURCE files (resumes, certificates, transcripts) —
// this is the opposite direction: things the app generated FOR the user.
// ---------------------------------------------------------------------------

export type GeneratedDocumentKind = "resume" | "cover_letter" | "resume_variant";

export interface GeneratedDocument {
  id: number;
  kind: GeneratedDocumentKind;
  label: string;
  format: string | null;
  url: string | null;
  createdAt: string | null;
}

interface WireDocument {
  id?: number;
  kind?: string;
  label?: string;
  format?: string | null;
  url?: string | null;
  created_at?: string | null;
}

function mapDocument(w: WireDocument): GeneratedDocument {
  return {
    id: w.id ?? 0,
    kind: (w.kind as GeneratedDocumentKind) ?? "resume",
    label: w.label ?? "",
    format: w.format ?? null,
    url: w.url ?? null,
    createdAt: w.created_at ?? null,
  };
}

/** GET /api/v1/resume/documents — newest first. */
export async function listGeneratedDocuments(): Promise<GeneratedDocument[]> {
  try {
    const data = await apiClient.get<WireDocument[]>("/api/v1/resume/documents");
    return (Array.isArray(data) ? data : []).map(mapDocument);
  } catch {
    return [];
  }
}

/** DELETE /api/v1/resume/documents/{id} — removes the index row only, not
 * the underlying storage object (same conservative choice the backend
 * makes everywhere else). */
export async function deleteGeneratedDocument(id: number): Promise<void> {
  try {
    await apiClient.delete(`/api/v1/resume/documents/${id}`);
  } catch {
    // best-effort — same pattern mobile's own deleteGeneratedDocument uses
  }
}

/** PATCH /api/v1/resume/documents/{id} — only `label` is editable. Throws
 * on failure so the caller can tell the user the rename didn't save. */
export async function renameGeneratedDocument(id: number, label: string): Promise<GeneratedDocument> {
  const data = await apiClient.patch<WireDocument>(`/api/v1/resume/documents/${id}`, { label });
  return mapDocument(data);
}
