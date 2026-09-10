"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import * as documentsService from "@/lib/documentsService";
import type { DocumentRecord } from "@/lib/documentsService";
import type { ApiError } from "@/lib/apiClient";

// Web port of Saveur (mobile)'s src/more/MyDocuments.tsx — a central hub for
// uploaded source documents (resume, cover letter, LinkedIn export,
// certificates, transcripts, portfolio files). Real backend contract —
// Saveur-Backend/app/api/documents.py:
//   GET    /api/v1/documents         -> DocumentRecord[]
//   POST   /api/v1/documents/upload  -> DocumentRecord (multipart: file, doc_type)
//   DELETE /api/v1/documents/{id}
// `doc_type`/`kind` is free text server-side — the options below are the
// categories the product explicitly named (resume, generated resume/cover
// letter live in Generated Documents instead — see app/documents/generated/
// page.tsx — LinkedIn export, certificate, transcript, portfolio).
const DOC_TYPES: { value: string; labelKey: string; labelDefault: string }[] = [
  { value: "resume", labelKey: "web:documents.type.resume", labelDefault: "Resume" },
  { value: "cover_letter", labelKey: "web:documents.type.coverLetter", labelDefault: "Cover Letter" },
  { value: "linkedin", labelKey: "web:documents.type.linkedin", labelDefault: "LinkedIn Export" },
  { value: "certificate", labelKey: "web:documents.type.certificate", labelDefault: "Certificate" },
  { value: "transcript", labelKey: "web:documents.type.transcript", labelDefault: "Transcript" },
  { value: "portfolio", labelKey: "web:documents.type.portfolio", labelDefault: "Portfolio" },
  { value: "document", labelKey: "web:documents.type.other", labelDefault: "Other" },
];

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    try {
      const list = await documentsService.listDocuments();
      setDocuments(list);
    } catch (err) {
      setLoadError((err as ApiError).message || t("web:documents.loadFailedDefault", { defaultValue: "Couldn't load your documents." }));
      setDocuments([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const doc = await documentsService.uploadDocument(file, docType);
      setDocuments((prev) => (prev ? [doc, ...prev] : [doc]));
    } catch (err) {
      setUploadError((err as ApiError).message || t("web:documents.uploadFailedDefault", { defaultValue: "Upload failed. Please try again." }));
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(doc: DocumentRecord) {
    if (!confirm(t("web:documents.deleteConfirm", { defaultValue: 'Remove "{{name}}" from My Documents?', name: doc.name ?? "this file" }).toString())) return;
    setDeletingId(doc.id);
    try {
      await documentsService.deleteDocument(doc.id);
      setDocuments((prev) => (prev ? prev.filter((d) => d.id !== doc.id) : prev));
    } catch {
      // no-op — list stays as-is if delete genuinely failed
    } finally {
      setDeletingId(null);
    }
  }

  function typeLabel(kind?: string | null): string {
    if (!kind) return t("web:documents.type.other", { defaultValue: "Other" });
    const known = DOC_TYPES.find((d) => d.value === kind);
    return known ? t(known.labelKey, { defaultValue: known.labelDefault }) : kind;
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:documents.title", { defaultValue: "My Documents" })}
            subtitle={t("web:documents.subtitle", {
              defaultValue: "Upload your resume, cover letter, LinkedIn export, certificates, transcripts, or portfolio files to reuse across the app.",
            })}
          />

          <Link href="/documents/generated" className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-4 hover:border-brand/40">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="layers-outline" size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">{t("web:documents.generatedLinkTitle", { defaultValue: "Generated Documents" })}</p>
                <p className="text-xs text-hint">{t("web:documents.generatedLinkSubtitle", { defaultValue: "Redownload resumes, cover letters & variants you've exported" })}</p>
              </div>
            </div>
            <EvaIcon name="chevron-right-outline" size={16} className="text-hint" />
          </Link>

          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <h2 className="font-semibold text-primary">{t("web:documents.uploadSectionTitle", { defaultValue: "Upload a file" })}</h2>
            <SelectField label={t("web:documents.docTypeLabel", { defaultValue: "Document type" })} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, { defaultValue: opt.labelDefault })}
                </option>
              ))}
            </SelectField>
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,image/*" onChange={onFileChosen} />
            <Button type="button" onClick={onPickFile} disabled={uploading} className="w-full">
              <EvaIcon name="upload-outline" size={16} />
              {uploading ? t("web:documents.uploading", { defaultValue: "Uploading…" }) : t("web:documents.uploadAFile", { defaultValue: "Upload a File" })}
            </Button>
            {uploadError && <p className="text-sm text-danger">{uploadError}</p>}
          </div>

          {loadError && <p className="text-sm text-danger">{loadError}</p>}

          {documents === null && !loadError && <SkeletonRows count={3} />}

          {documents && documents.length === 0 && (
            <p className="text-sm text-hint">
              {t("web:documents.empty", {
                defaultValue: "No documents yet — upload a resume, cover letter, certificate, or transcript above to keep it here for reuse across the app.",
              })}
            </p>
          )}

          {documents && documents.length > 0 && (
            <div className="flex flex-col gap-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-hint">
                    <EvaIcon name="file-text-outline" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">{doc.name ?? t("web:documents.untitled", { defaultValue: "Untitled file" })}</p>
                    <p className="text-xs text-hint">
                      {typeLabel(doc.kind)}
                      {formatSize(doc.sizeBytes) ? ` · ${formatSize(doc.sizeBytes)}` : ""}
                    </p>
                  </div>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-hint hover:text-primary" aria-label={t("common:actions.view", { defaultValue: "View" })}>
                      <EvaIcon name="external-link-outline" size={18} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 text-hint hover:text-danger disabled:opacity-50"
                    aria-label={t("common:delete", { defaultValue: "Delete" })}
                  >
                    <EvaIcon name="trash-2-outline" size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
