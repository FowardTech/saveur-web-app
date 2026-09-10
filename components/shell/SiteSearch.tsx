"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { primaryNav, secondaryNav, isNavGroup, type NavLeaf } from "@/lib/navigation";

interface SearchEntry {
  label: string;
  href: string;
  icon: NavLeaf["icon"];
}

/** Flattens lib/navigation.ts's existing route index (the same data Sidebar
 * renders) into one searchable list of every real page, instead of hand-
 * duplicating a second list — that file is already the single source of
 * truth for route+label+icon. Nav groups (e.g. "Practice") aren't
 * independently navigable, so only their children are included; a group's
 * own label never appears as a standalone result. */
function buildIndex(t: (key: string, opts: { defaultValue: string }) => string): SearchEntry[] {
  const leaves: NavLeaf[] = [];
  for (const item of [...primaryNav, ...secondaryNav]) {
    if (isNavGroup(item)) leaves.push(...item.children);
    else leaves.push(item);
  }
  return leaves.map((item) => ({
    href: item.href,
    icon: item.icon,
    label: item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label,
  }));
}

// Simple substring/fuzzy ranking, not a search backend — exact label match
// first, then "starts with", then "a word inside the label starts with it",
// then a plain substring anywhere. Good enough for a few dozen page titles;
// scoped deliberately (see this file's own header comment) rather than
// pulling in a fuzzy-search dependency for a list this small.
function scoreMatch(label: string, query: string): number {
  const l = label.toLowerCase();
  const q = query.toLowerCase();
  if (l === q) return 0;
  if (l.startsWith(q)) return 1;
  if (l.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  if (l.includes(q)) return 3;
  return -1;
}

/** Long site-wide search bar in the dashboard Topbar — product request:
 * "a long search bar in the web app dashboard navbar so that users can
 * search anything or any page and then click and redirect them there."
 *
 * SCOPE: this searches PAGES/FEATURES only, matched against
 * lib/navigation.ts's existing nav-item index (the same data Sidebar
 * renders) — not actual content like job alert titles or dream-company
 * names. Searching real content too would mean either a heavy new
 * aggregated backend search endpoint or several separate lightweight ones
 * (job alerts, dream companies, applications, etc.) fanned out on every
 * keystroke, which is a meaningfully bigger feature than "let me jump to a
 * page" — left out here as an honest scope boundary rather than a half-built
 * attempt at full content search. */
export function SiteSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildIndex(t), [t]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return index
      .map((entry) => ({ entry, score: scoreMatch(entry.label, q) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label))
      .slice(0, 8)
      .map((r) => r.entry);
  }, [index, query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function goTo(href: string) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      goTo(results[activeIndex].href);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative w-full max-w-xl" ref={ref}>
      <div className="relative">
        <EvaIcon
          name="search-outline"
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-hint"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("web:shell.searchPlaceholder", { defaultValue: "Search anything or any page…" })}
          aria-label={t("web:shell.searchPlaceholder", { defaultValue: "Search anything or any page…" })}
          className="w-full rounded-full border border-border bg-surface-1 py-2 pl-9 pr-3.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-96 overflow-y-auto rounded-card border border-border bg-surface-2 shadow-lg">
          <ul>
            {results.map((r, i) => (
              <li key={r.href}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => goTo(r.href)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                    i === activeIndex ? "bg-surface-3 text-primary" : "text-hint hover:bg-surface-3 hover:text-primary"
                  }`}
                >
                  <EvaIcon name={r.icon} size={16} />
                  <span className="truncate">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && query.trim() !== "" && results.length === 0 && (
        <div className="absolute left-0 right-0 z-20 mt-2 rounded-card border border-border bg-surface-2 p-4 text-center text-sm text-hint shadow-lg">
          {t("web:shell.searchNoResults", { defaultValue: "No matching pages found." })}
        </div>
      )}
    </div>
  );
}
