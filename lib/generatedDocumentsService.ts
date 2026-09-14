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
  // Cover letters only (product report: "when a CV or Cover letter is
  // generated and it's saved, the user should be able to come and edit
  // and update that same generated CV or cover later") — the plain-text
  // source, null for resume/resume_variant rows (their real editable
  // source is the structured Resume Builder instead). See
  // Saveur-Backend/app/models/generated_document.py's own comment.
  content: string | null;
  createdAt: string | null;
}

interface WireDocument {
  id?: number;
  kind?: string;
  label?: string;
  format?: string | null;
  url?: string | null;
  content?: string | null;
  created_at?: string | null;
}

function mapDocument(w: WireDocument): GeneratedDocument {
  return {
    id: w.id ?? 0,
    kind: (w.kind as GeneratedDocumentKind) ?? "resume",
    label: w.label ?? "",
    format: w.format ?? null,
    url: w.url ?? null,
    content: w.content ?? null,
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

/** PATCH /api/v1/resume/documents/{id} — renames the document. Throws on
 * failure so the caller can tell the user the rename didn't save. */
export async function renameGeneratedDocument(id: number, label: string): Promise<GeneratedDocument> {
  const data = await apiClient.patch<WireDocument>(`/api/v1/resume/documents/${id}`, { label });
  return mapDocument(data);
}

/**
 * PATCH /api/v1/resume/documents/{id} with new letter text — cover
 * letters only (400s server-side for any other kind). Re-renders the
 * saved PDF/DOCX with the revised text and updates this SAME document's
 * url in place, so redownloading it afterward returns the edited version.
 * Optionally renames at the same time (one round trip for "Save" in an
 * edit dialog that shows both fields). Throws on failure.
 */
export async function updateGeneratedDocumentContent(
  id: number,
  content: string,
  label?: string
): Promise<GeneratedDocument> {
  const body: Record<string, string> = { content };
  if (label !== undefined) body.label = label;
  const data = await apiClient.patch<WireDocument>(`/api/v1/resume/documents/${id}`, body);
  return mapDocument(data);
}
