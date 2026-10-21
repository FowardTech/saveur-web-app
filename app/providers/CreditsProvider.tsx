"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { EvaIcon } from "@/components/icons/EvaIcon";
import * as creditsService from "@/lib/creditsService";
import type { CreditsOverview } from "@/lib/creditsService";

interface CreditsContextValue {
  credits: CreditsOverview | null;
  refresh: () => Promise<void>;
  /** Configured credit cost of an action key (0 when unknown / credits off). */
  costOf: (action: string) => number;
}

const CreditsContext = createContext<CreditsContextValue>({ credits: null, refresh: async () => {}, costOf: () => 0 });

export const useCredits = () => useContext(CreditsContext);

/** Holds the user's credit balance + cost table, keeps it fresh (after any
 * write request, on tab focus), and shows the global "out of credits" dialog
 * when an API call fails with insufficient_credits. */
export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { firebaseUser } = useAuth();
  const signedIn = !!firebaseUser;
  const [credits, setCredits] = useState<CreditsOverview | null>(null);
  const [dialog, setDialog] = useState<{ message: string; required?: number; available?: number } | null>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      setCredits(await creditsService.getCredits());
    } catch {
      /* balance chip simply stays as-is */
    }
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) {
      setCredits(null);
      return;
    }
    refresh();
    const stale = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(refresh, 800); // debounce bursts of writes
    };
    const insufficient = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      setDialog({ message: d.message, required: d.required, available: d.available });
      refresh();
    };
    const onFocus = () => refresh();
    window.addEventListener("credits:stale", stale);
    window.addEventListener("credits:insufficient", insufficient);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("credits:stale", stale);
      window.removeEventListener("credits:insufficient", insufficient);
      window.removeEventListener("focus", onFocus);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [signedIn, refresh]);

  const value = useMemo<CreditsContextValue>(
    () => ({ credits, refresh, costOf: (a) => (credits?.enabled ? credits.costs?.[a] ?? 0 : 0) }),
    [credits, refresh],
  );

  return (
    <CreditsContext.Provider value={value}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-card bg-surface-2 p-6 shadow-xl">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-tint-blue text-tint-blue-text">
              <EvaIcon name="flash-outline" size={22} />
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-bold text-primary">{t("web:credits.outTitle", { defaultValue: "You're out of credits" })}</h2>
              <p className="text-sm text-hint">
                {dialog.required != null
                  ? t("web:credits.outBody", {
                      defaultValue: "This needs {{required}} credits and you have {{available}}. Buy more credits, or wait for your monthly reset.",
                      required: dialog.required,
                      available: dialog.available ?? 0,
                    })
                  : dialog.message}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDialog(null)} className="flex-1 rounded-lg bg-surface-3 px-4 py-2.5 text-sm font-bold text-primary hover:opacity-90">
                {t("web:credits.notNow", { defaultValue: "Not now" })}
              </button>
              <Link href="/credits" onClick={() => setDialog(null)} className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-bold text-white hover:opacity-90">
                {t("web:credits.buyCredits", { defaultValue: "Buy credits" })}
              </Link>
            </div>
          </div>
        </div>
      )}
    </CreditsContext.Provider>
  );
}
