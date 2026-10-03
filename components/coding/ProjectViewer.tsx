"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ViewerFile {
  path: string;
  content: string;
}

/** Read-only project viewer (file list + contents) used for projects shared
 * with a Saveur user and for the public external link page. */
export function ProjectViewer({ name, files }: { name: string; files: ViewerFile[] }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(files[0]?.path ?? "");
  const current = files.find((f) => f.path === active) ?? files[0];
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4">
      <h1 className="text-lg font-bold text-primary">{name}</h1>
      {files.length === 0 ? (
        <p className="text-sm text-hint">{t("web:share.projectEmpty", { defaultValue: "This project has no files yet." })}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface-1 p-2">
            {files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setActive(f.path)}
                className={`truncate rounded px-2 py-1 text-left text-sm ${f.path === current?.path ? "bg-brand/10 font-semibold text-brand" : "text-primary hover:bg-surface-3"}`}
              >
                {f.path}
              </button>
            ))}
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-1 p-3 text-xs text-primary">
            {current?.content}
          </pre>
        </div>
      )}
      <p className="text-xs text-hint">{t("web:share.readOnly", { defaultValue: "Read-only view." })}</p>
    </div>
  );
}
