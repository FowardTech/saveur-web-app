"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import * as documentsService from "@/lib/documentsService";
import type { DocumentRecord } from "@/lib/documentsService";

// Web port of Saveur (mobile)'s components/DocumentPickerModal.tsx — a
// compact "choose from My Documents" picker reused by Resume Builder's
// import cards and JD Analyzer's "tailor an existing resume" flow. Returns
// the picked DocumentRecord to the caller rather than managing the list
// itself (that's app/documents/page.tsx's job).
export function DocumentPickerModal({
  open,
  onClose,
  onSelect,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (doc: DocumentRecord) => void;
  title?: string;
}) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setDocuments(null);
    documentsService
      .listDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-primary">{title ?? t("web:documents.picker.title", { defaultValue: "Choose from My Documents" })}</h2>
          <button type="button" onClick={onClose} aria-label={t("common:actions.close", { defaultValue: "Close" })}>
            <EvaIcon name="close-outline" size={20} className="text-hint" />
          </button>
        </div>

        {documents === null && <SkeletonRows count={3} />}

        {documents && documents.length === 0 && (
          <p className="text-sm text-hint">
            {t("web:documents.picker.empty", { defaultValue: "You haven't uploaded any documents yet — head to My Documents to upload one." })}
          </p>
        )}

        {documents && documents.length > 0 && (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelect(doc)}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 p-3 text-left hover:border-brand/50"
              >
                <EvaIcon name="file-text-outline" size={18} className="shrink-0 text-hint" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{doc.name ?? t("web:documents.untitled", { defaultValue: "Untitled file" })}</p>
                  {doc.kind && <p className="text-xs text-hint">{doc.kind}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
