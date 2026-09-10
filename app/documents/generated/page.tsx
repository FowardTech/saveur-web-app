"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import * as generatedDocumentsService from "@/lib/generatedDocumentsService";
import type { GeneratedDocument, GeneratedDocumentKind } from "@/lib/generatedDocumentsService";
import { downloadUrlAsFile } from "@/lib/downloadFile";

// Web port of Saveur (mobile)'s src/more/GeneratedDocuments.tsx — every
// resume/CV, cover letter, and tailored resume variant this user has ever
// exported to PDF/DOCX, redownloadable anytime. Real backend contract —
// GET/DELETE/PATCH /api/v1/resume/documents (Saveur-Backend/app/api/
// resume.py). See lib/generatedDocumentsService.ts.
const KIND_META: Record<GeneratedDocumentKind, { icon: EvaIconName; labelKey: string; labelDefault: string }> = {
  resume: { icon: "file-text-outline", labelKey: "web:documents.generated.kind.resume", labelDefault: "Resume/CV" },
  cover_letter: { icon: "email-outline", labelKey: "web:documents.generated.kind.coverLetter", labelDefault: "Cover Letter" },
  resume_variant: { icon: "layers-outline", labelKey: "web:documents.generated.kind.resumeVariant", labelDefault: "Resume Variant" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function GeneratedDocumentsPage() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<GeneratedDocument[] | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<GeneratedDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generatedDocumentsService.listGeneratedDocuments().then(setDocuments);
  }, []);

  async function onDownload(doc: GeneratedDocument) {
    if (downloadingId || !doc.url) return;
    setDownloadingId(doc.id);
    setError(null);
    try {
      const ext = (doc.format || "pdf").toLowerCase();
      await downloadUrlAsFile(doc.url, `${doc.label || "Document"}.${ext}`);
    } catch {
      setError(t("web:documents.generated.downloadFailed", { defaultValue: "Couldn't download this document — it may be too old to redownload. Try generating it again." }));
    } finally {
      setDownloadingId(null);
    }
  }

  function onOpenRename(doc: GeneratedDocument) {
    setRenamingDoc(doc);
    setRenameValue(doc.label);
  }

  async function onSaveRename() {
    if (!renamingDoc) return;
    const label = renameValue.trim();
    if (!label) return;
    setSavingRename(true);
    try {
      const updated = await generatedDocumentsService.renameGeneratedDocument(renamingDoc.id, label);
      setDocuments((prev) => (prev ? prev.map((d) => (d.id === updated.id ? updated : d)) : prev));
      setRenamingDoc(null);
    } catch {
      setError(t("web:documents.generated.renameFailed", { defaultValue: "Couldn't rename that document." }));
    } finally {
      setSavingRename(false);
    }
  }

  async function onDelete(doc: GeneratedDocument) {
    if (!confirm(doc.label || t("web:documents.generated.deleteConfirm", { defaultValue: "Remove this document?" }).toString())) return;
    setDocuments((prev) => (prev ? prev.filter((d) => d.id !== doc.id) : prev));
    await generatedDocumentsService.deleteGeneratedDocument(doc.id);
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:documents.generated.title", { defaultValue: "Generated Documents" })}
            subtitle={t("web:documents.generated.subtitle", { defaultValue: "Every resume, cover letter, and tailored variant you've generated — redownload any of them anytime." })}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          {documents === null && <SkeletonRows count={3} />}

          {documents && documents.length === 0 && (
            <p className="text-sm text-hint">
              {t("web:documents.generated.empty", {
                defaultValue: "Nothing here yet — anything you download from Resume Builder, Cover Letter Generator, or Resume Variants will show up here.",
              })}
            </p>
          )}

          {documents && documents.length > 0 && (
            <div className="flex flex-col gap-3">
              {documents.map((doc) => {
                const meta = KIND_META[doc.kind] ?? KIND_META.resume;
                return (
                  <div key={doc.id} className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-hint">
                      <EvaIcon name={meta.icon} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-primary">{doc.label || t(meta.labelKey, { defaultValue: meta.labelDefault })}</p>
                      <p className="text-xs text-hint">
                        {t(meta.labelKey, { defaultValue: meta.labelDefault })}
                        {doc.format ? ` · ${doc.format.toUpperCase()}` : ""}
                        {doc.createdAt ? ` · ${formatDate(doc.createdAt)}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => onOpenRename(doc)} className="p-1.5 text-hint hover:text-primary" aria-label={t("common:actions.edit", { defaultValue: "Edit" })}>
                      <EvaIcon name="edit-2-outline" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(doc)}
                      disabled={downloadingId === doc.id}
                      className="p-1.5 text-hint hover:text-primary disabled:opacity-50"
                      aria-label={t("web:documents.generated.download", { defaultValue: "Download" })}
                    >
                      <EvaIcon name="download-outline" size={18} />
                    </button>
                    <button type="button" onClick={() => onDelete(doc)} className="p-1.5 text-hint hover:text-danger" aria-label={t("common:delete", { defaultValue: "Delete" })}>
                      <EvaIcon name="trash-2-outline" size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {renamingDoc && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !savingRename && setRenamingDoc(null)}>
              <div className="w-full max-w-sm rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
                <h2 className="mb-4 font-semibold text-primary">{t("web:documents.generated.renameTitle", { defaultValue: "Rename document" })}</h2>
                <TextField label={t("web:documents.generated.nameLabel", { defaultValue: "Document name" })} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                <div className="mt-4 flex flex-col gap-2">
                  <Button type="button" onClick={onSaveRename} disabled={!renameValue.trim() || savingRename}>
                    {savingRename ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("common:save", { defaultValue: "Save" })}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setRenamingDoc(null)} disabled={savingRename}>
                    {t("common:cancel", { defaultValue: "Cancel" })}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
