"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

// Web port of Saveur (mobile)'s src/more/CareerDiary.tsx — a plain journal
// for logging what the user did, learned, or achieved day-to-day regarding
// a role, career, or job. Real backend CRUD, no AI involved — Saveur-Backend/
// app/api/career_diary.py:
//   GET    /api/v1/career-diary        -> {items: Entry[]} (most recent first)
//   POST   /api/v1/career-diary        -> Entry (entry_date defaults to today)
//   DELETE /api/v1/career-diary/{id}
type DiaryCategory = "did" | "learned" | "achieved";

interface DiaryEntry {
  id: number;
  entryDate: string;
  category?: DiaryCategory;
  role?: string;
  text: string;
}

interface EntryWire {
  id: number;
  entry_date?: string;
  category?: string;
  role?: string;
  text: string;
}

function fromWire(w: EntryWire): DiaryEntry {
  return { id: w.id, entryDate: w.entry_date ?? "", category: (w.category as DiaryCategory) || undefined, role: w.role || undefined, text: w.text };
}

const CATEGORY_KEYS: DiaryCategory[] = ["did", "learned", "achieved"];
const CATEGORY_DEFAULTS: Record<DiaryCategory, string> = { did: "Did", learned: "Learned", achieved: "Achieved" };

function formatDateHeader(dateStr: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!dateStr) return "";
  const today = new Date();
  const d = new Date(`${dateStr}T00:00:00`);
  if (d.toDateString() === today.toDateString()) return t("web:careerDiary.today", { defaultValue: "Today" });
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t("web:careerDiary.yesterday", { defaultValue: "Yesterday" });
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function CareerDiaryPage() {
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [category, setCategory] = useState<DiaryCategory | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await apiClient.get<{ items?: EntryWire[] }>("/api/v1/career-diary");
      setEntries((data.items ?? []).map(fromWire));
    } catch (err) {
      setLoadError((err as ApiError).message || t("web:careerDiary.loadFailedDefault", { defaultValue: "Could not load your Career Diary." }));
      setEntries([]);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  async function onAdd() {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const data = await apiClient.post<EntryWire>("/api/v1/career-diary", { text: trimmed, category, role: role.trim() || undefined });
      setEntries((prev) => (prev ? [fromWire(data), ...prev] : [fromWire(data)]));
      setText("");
      setRole("");
      setCategory(undefined);
      setShowComposer(false);
    } catch {
      setLoadError(t("web:careerDiary.saveFailedDefault", { defaultValue: "Couldn't save that entry. Please try again." }));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(entry: DiaryEntry) {
    if (!confirm(t("web:careerDiary.deleteConfirm", { defaultValue: "Delete this entry? This cannot be undone." }).toString())) return;
    setEntries((prev) => (prev ? prev.filter((e) => e.id !== entry.id) : prev));
    try {
      await apiClient.delete(`/api/v1/career-diary/${entry.id}`);
    } catch {
      load();
    }
  }

  function categoryLabel(key: DiaryCategory): string {
    return t(`web:careerDiary.category.${key}`, { defaultValue: CATEGORY_DEFAULTS[key] });
  }

  const groups: { date: string; items: DiaryEntry[] }[] = [];
  (entries ?? []).forEach((entry) => {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.entryDate) last.items.push(entry);
    else groups.push({ date: entry.entryDate, items: [entry] });
  });

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:careerDiary.title", { defaultValue: "Career Diary" })}
            subtitle={t("web:careerDiary.subtitle", { defaultValue: "Log what you did, learned, or achieved today regarding a role, career, or job — a running record you can look back on." })}
          />

          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4 text-left hover:border-brand/40"
          >
            <EvaIcon name="plus-outline" size={18} className="text-brand" />
            <span className="flex-1 text-sm font-semibold text-primary">{t("web:careerDiary.addEntry", { defaultValue: "Add Entry" })}</span>
            <EvaIcon name="arrow-forward-outline" size={14} className="text-hint" />
          </button>

          {loadError && <p className="text-sm text-danger">{loadError}</p>}

          {entries === null && !loadError && <SkeletonRows count={4} />}

          {entries && entries.length === 0 && (
            <EmptyState
              illustration="list"
              title={t("web:careerDiary.emptyTitle", { defaultValue: "No entries yet" })}
              description={t("web:careerDiary.empty", { defaultValue: "Add your first one above." })}
            />
          )}

          {groups.map((group) => (
            <div key={group.date} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-hint">{formatDateHeader(group.date, t)}</h2>
              {group.items.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {entry.category && <span className="rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">{CATEGORY_KEYS.includes(entry.category) ? categoryLabel(entry.category) : entry.category}</span>}
                      {entry.role && <span className="rounded-pill bg-surface-3 px-2.5 py-1 text-xs font-semibold text-primary">{entry.role}</span>}
                    </div>
                    <button type="button" onClick={() => onDelete(entry)} className="p-1 text-hint hover:text-danger" aria-label={t("common:delete", { defaultValue: "Delete" })}>
                      <EvaIcon name="trash-2-outline" size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-primary">{entry.text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>

        {showComposer && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !saving && setShowComposer(false)}>
            <div className="w-full max-w-md rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-primary">{t("web:careerDiary.addEntry", { defaultValue: "Add Entry" })}</h2>
                <button type="button" onClick={() => setShowComposer(false)} aria-label={t("common:actions.close", { defaultValue: "Close" })}>
                  <EvaIcon name="close-outline" size={20} className="text-hint" />
                </button>
              </div>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("web:careerDiary.composerPlaceholder", { defaultValue: "What did you do, learn, or achieve today?" }).toString()}
                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <div className="mt-3 flex gap-2">
                {CATEGORY_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(category === key ? undefined : key)}
                    className={`rounded-pill px-3.5 py-1.5 text-sm font-medium ${category === key ? "bg-brand text-white" : "bg-surface-3 text-hint"}`}
                  >
                    {categoryLabel(key)}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <TextField label={t("web:careerDiary.roleLabel", { defaultValue: "Role / career / job (optional)" })} value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Button type="button" onClick={onAdd} disabled={!text.trim() || saving}>
                  {saving ? t("web:careerDiary.saving", { defaultValue: "Saving…" }) : t("web:careerDiary.addEntry", { defaultValue: "Add Entry" })}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowComposer(false)} disabled={saving}>
                  {t("common:cancel", { defaultValue: "Cancel" })}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}
