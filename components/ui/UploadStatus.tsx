"use client";

import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** Shared upload state for any file upload in the web app. `uploading` has a
 * real percentage (XHR upload progress); `processing` is the short stretch
 * after the bytes are sent while the server stores/parses the file. */
export interface UploadState {
  name: string;
  sizeBytes?: number;
  percent: number;
  phase: "uploading" | "processing" | "done" | "error";
  error?: string;
}

export function formatBytes(n?: number): string {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Helper for pages: start state for a freshly chosen file. */
export function startUpload(file: File): UploadState {
  return { name: file.name, sizeBytes: file.size, percent: 0, phase: "uploading" };
}

/** Moves to "processing" once the bytes are all sent, otherwise keeps
 * "uploading" with the live percentage. */
export function withProgress(prev: UploadState | null, percent: number): UploadState | null {
  if (!prev) return prev;
  return { ...prev, percent, phase: percent >= 100 ? "processing" : "uploading" };
}

export function UploadStatus({ upload, onDismiss }: { upload: UploadState | null; onDismiss?: () => void }) {
  const { t } = useTranslation();
  if (!upload) return null;
  const { phase, percent } = upload;

  const label =
    phase === "uploading"
      ? t("web:upload.uploadingPercent", { defaultValue: "Uploading… {{percent}}%", percent })
      : phase === "processing"
        ? t("web:upload.processing", { defaultValue: "Upload complete — processing…" })
        : phase === "done"
          ? t("web:upload.done", { defaultValue: "Uploaded successfully" })
          : upload.error || t("web:upload.failed", { defaultValue: "Upload failed. Please try again." });

  const tone = phase === "done" ? "text-success" : phase === "error" ? "text-danger" : "text-primary";
  const icon = phase === "done" ? "checkmark-circle-2-outline" : phase === "error" ? "alert-circle-outline" : "file-text-outline";

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 p-3">
      <div className="flex items-center gap-3">
        <EvaIcon name={icon} size={18} className={tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-primary">{upload.name}</p>
          <p className={`text-xs ${tone}`}>
            {label}
            {upload.sizeBytes != null && phase !== "error" ? <span className="text-hint"> · {formatBytes(upload.sizeBytes)}</span> : null}
          </p>
        </div>
        {(phase === "done" || phase === "error") && onDismiss && (
          <button type="button" onClick={onDismiss} aria-label={t("web:upload.dismiss", { defaultValue: "Dismiss" }).toString()} className="text-hint hover:text-primary">
            <EvaIcon name="close-outline" size={16} />
          </button>
        )}
      </div>
      {(phase === "uploading" || phase === "processing") && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className={`h-full rounded-full bg-brand transition-all duration-200 ${phase === "processing" ? "animate-pulse" : ""}`}
            style={{ width: `${phase === "processing" ? 100 : Math.max(3, percent)}%` }}
          />
        </div>
      )}
    </div>
  );
}
