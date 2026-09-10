import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// documentsService — web port of Saveur (mobile)'s services/documentsService.ts.
//
// Generic S3-backed document storage — POST/GET/DELETE /api/v1/documents
// (Saveur-Backend/app/api/documents.py) — separate from the resume-specific
// upload wired to POST /api/v1/resume/upload (see lib/resumeService.ts's
// importSource()). Backs the standalone "My Documents" hub
// (app/documents/page.tsx) and the "choose from My Documents" picker
// (components/documents/DocumentPickerModal.tsx) used by Resume Builder's
// import cards and JD Analyzer's "tailor an existing resume" flow.
// ---------------------------------------------------------------------------

export interface DocumentRecord {
  id: string;
  url: string;
  name?: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
  kind?: string | null;
  createdAt?: number;
}

interface DocumentWire {
  id: string;
  url: string;
  name?: string;
  file_name?: string;
  size_bytes?: number;
  mime_type?: string;
  kind?: string | null;
  created_at?: number | string;
}

function fromWire(wire: DocumentWire): DocumentRecord {
  return {
    id: wire.id,
    url: wire.url,
    name: wire.name ?? wire.file_name,
    sizeBytes: wire.size_bytes ?? null,
    mimeType: wire.mime_type ?? null,
    kind: wire.kind ?? null,
    createdAt: wire.created_at != null ? (typeof wire.created_at === "string" ? new Date(wire.created_at).getTime() : wire.created_at) : undefined,
  };
}

/** GET /api/v1/documents — list the current user's uploaded documents. */
export async function listDocuments(): Promise<DocumentRecord[]> {
  const data = await apiClient.get<DocumentWire[]>("/api/v1/documents");
  return (data ?? []).map(fromWire);
}

/**
 * POST /api/v1/documents/upload — multipart upload of an arbitrary file
 * (from a browser <input type="file">). `docType` is a free-text category
 * (e.g. "resume", "cover_letter", "certificate", "transcript", "portfolio")
 * — round-tripped back as `kind` on GET so the My Documents list can label
 * each file.
 */
export async function uploadDocument(file: File, docType?: string): Promise<DocumentRecord> {
  const formData = new FormData();
  if (docType) formData.append("doc_type", docType);
  formData.append("file", file, file.name);
  const data = await apiClient.upload<DocumentWire>("/api/v1/documents/upload", formData);
  return fromWire(data);
}

/** DELETE /api/v1/documents/{id} — remove a stored document. */
export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/documents/${id}`);
}
