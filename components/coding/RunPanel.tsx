"use client";

import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import type { RunResult } from "@/lib/codingProjectsService";

interface RunPanelProps {
  languages: string[];
  language: string;
  onLanguageChange: (lang: string) => void;
  stdin: string;
  onStdinChange: (v: string) => void;
  entryPath: string | null;
  running: boolean;
  onRun: () => void;
  result: RunResult | null;
  error: string | null;
  onClose: () => void;
}

/** Bottom run panel for "script" type projects — POST
 * /coding/projects/<id>/run. Multi-file execution there is only reliably
 * confirmed for interpreted languages (Python/Node/Ruby/PHP) that resolve
 * sibling files via their own import/require; compiled languages are
 * best-effort, hence the soft "may not see other files" note rather than a
 * flat claim it works. */
export function RunPanel({ languages, language, onLanguageChange, stdin, onStdinChange, entryPath, running, onRun, result, error, onClose }: RunPanelProps) {
  const { t } = useTranslation();
  const passed = result?.passed === true;
  const hasVerdict = result && typeof result.status === "string";

  return (
    <div className="flex h-full flex-col border-t border-border bg-surface-2">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-hint">{t("web:practice.codingProjects.runPanelTitle", { defaultValue: "Run" })}</span>
          <span className="text-xs text-hint">
            {entryPath
              ? t("web:practice.codingProjects.runEntry", { defaultValue: "Entry: {{path}}", path: entryPath })
              : t("web:practice.codingProjects.runNoEntry", { defaultValue: "Open a file to set it as the entry point." })}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label={t("common:actions.close", { defaultValue: "Close" })} className="inline-flex h-6 w-6 items-center justify-center rounded text-hint hover:bg-surface-3">
          <EvaIcon name="close-outline" size={14} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField label={t("web:practice.codingProjects.language", { defaultValue: "Language" })} value={language} onChange={(e) => onLanguageChange(e.target.value)} className="w-40">
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </SelectField>
          <Button type="button" onClick={onRun} disabled={running || !entryPath} className="mb-0.5">
            <EvaIcon name="play-circle-outline" size={16} />
            {running ? t("web:practice.codingProjects.running", { defaultValue: "Running…" }) : t("web:practice.codingProjects.run", { defaultValue: "Run" })}
          </Button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-hint">{t("web:practice.codingProjects.stdinLabel", { defaultValue: "stdin (optional)" })}</span>
          <textarea
            value={stdin}
            onChange={(e) => onStdinChange(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            placeholder={t("web:practice.codingProjects.stdinPlaceholder", { defaultValue: "Input piped to the program, if any" }).toString()}
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        {hasVerdict && result && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${passed ? "bg-tint-mint text-tint-mint-text" : "bg-tint-rose text-tint-rose-text"}`}>{result.status}</span>
              {result.multi_file_forwarded && (
                <span className="text-xs text-hint">{t("web:practice.codingProjects.multiFileForwarded", { defaultValue: "Other project files were forwarded to the run (best-effort for compiled languages)." })}</span>
              )}
              {(result.time || result.memory) && (
                <span className="text-xs text-hint">
                  {result.time ? `${result.time}s` : ""} {result.memory ? `· ${result.memory} KB` : ""}
                </span>
              )}
            </div>
            {(result.stdout || result.actual_output) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-hint">{t("web:practice.codingProjects.stdout", { defaultValue: "Output" })}</p>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-2 font-mono text-xs text-primary">{result.stdout || result.actual_output}</pre>
              </div>
            )}
            {result.compile_output && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-hint">{t("web:practice.codingProjects.compileOutput", { defaultValue: "Compile output" })}</p>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-2 font-mono text-xs text-primary">{result.compile_output}</pre>
              </div>
            )}
            {result.stderr && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-hint">{t("web:practice.codingProjects.stderr", { defaultValue: "Errors" })}</p>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-2 font-mono text-xs text-danger">{result.stderr}</pre>
              </div>
            )}
            {result.message && <p className="text-xs text-hint">{result.message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
