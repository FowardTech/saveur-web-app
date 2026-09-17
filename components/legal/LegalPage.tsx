"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { getLegalContent, type LegalSlug } from "@/lib/legalContentService";
import { renderMarkdownLite } from "@/lib/markdownLite";
import { Button } from "@/components/ui/Button";

/** Renders one legal document (Terms of Service / Privacy Policy) fetched
 * from the same backend endpoint mobile's PolicyScreen uses — see
 * lib/legalContentService.ts. Unauthenticated by design: this needs to be
 * readable from the login/register pages before a session exists (product
 * report: "The user is supposed to accept the terms and conditions and
 * privacy policy before they can sign up or login"), so it deliberately
 * does NOT wrap in RequireAuth the way most app/ pages do.
 *
 * Not built on AuthLayout: that shell's narrow max-w-xl card fits a login
 * form, not a full legal document — this uses its own wider column instead
 * while keeping the same header treatment (Saveur wordmark linking home). */
export function LegalPage({ slug, titleDefault }: { slug: LegalSlug; titleDefault: string }) {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState(titleDefault);
  const [bodyMd, setBodyMd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Named load function (rather than setState calls directly in the effect
  // body) — same shape as mobile's PolicyScreen `load` callback.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getLegalContent(slug, i18n.language || "en");
      setTitle(result.title || titleDefault);
      setBodyMd(result.bodyMd);
    } catch {
      setError(t("web:legal.loadFailed", { defaultValue: "Couldn't load this content. Please try again." }));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, i18n.language]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, i18n.language]);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="px-6 py-5">
        <Link href="/" className="text-lg font-bold tracking-tight text-primary">
          Saveur<span className="text-brand">.</span>
        </Link>
      </header>
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-20">
        <h1 className="mb-6 text-2xl font-bold text-primary">{title}</h1>
        {loading ? (
          <div className="flex flex-col gap-3">
            <div className="h-4 w-full animate-pulse rounded bg-surface-1" />
            <div className="h-4 w-full animate-pulse rounded bg-surface-1" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-1" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-danger">{error}</p>
            <Button size="sm" onClick={() => void load()}>
              {t("common:try_again", { defaultValue: "Try again" })}
            </Button>
          </div>
        ) : (
          <div>{renderMarkdownLite(bodyMd ?? "")}</div>
        )}
      </div>
    </div>
  );
}
