"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import * as adsService from "@/lib/adsService";
import type { Advertisement } from "@/lib/adsService";

/**
 * Web port of mobile's components/AdPopupModal.tsx + HomeSrc's ad queue
 * (product report: "pop up ads are missing in the web app"). Fetches the
 * next admin-configured popup ad (server enforces the per-user
 * max_impressions cap), shows it as a centered image dialog once `enabled`
 * (so it never stacks on the rating / daily check-in modals), and records
 * the impression only after it is actually on screen. Renders nothing when
 * there is no eligible ad. Portaled to document.body for the same
 * fixed-position containing-block reason as RatingModal.
 */
export function AdPopupModal({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const [ad, setAd] = useState<Advertisement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fetched = useRef(false);
  const recorded = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!enabled || fetched.current) return;
    fetched.current = true;
    let cancelled = false;
    adsService
      .getNextAd()
      .then((next) => {
        if (cancelled || !next) return;
        setAd(next);
        // Small delay so the dashboard settles first, like mobile's 1500ms.
        setTimeout(() => !cancelled && setOpen(true), 1500);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!open || !ad || recorded.current) return;
    recorded.current = true;
    adsService.recordImpression(ad.id).catch(() => {});
  }, [open, ad]);

  if (!open || !ad || !enabled || !mounted) return null;

  const close = () => setOpen(false);
  const openCta = () => {
    if (ad.ctaUrl) window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
    close();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" role="dialog" aria-modal="true">
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-card bg-surface-2 shadow-2xl">
        <button
          type="button"
          onClick={close}
          aria-label={t("web:common.close", { defaultValue: "Close" })}
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <EvaIcon name="close-outline" size={18} />
        </button>
        {ad.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.imageUrl} alt={ad.title || ""} className="max-h-[70vh] w-full object-cover" />
        )}
        {(ad.title || ad.body) && (
          <div className="flex flex-col gap-1 p-4">
            {ad.title && <h2 className="text-lg font-bold text-primary">{ad.title}</h2>}
            {ad.body && <p className="text-sm text-hint">{ad.body}</p>}
          </div>
        )}
        {ad.ctaUrl && (
          <div className="p-4 pt-0">
            <button
              type="button"
              onClick={openCta}
              className="w-full rounded-pill bg-solid px-4 py-2.5 text-sm font-semibold text-solid-fg hover:opacity-90"
            >
              {ad.ctaLabel || t("web:common.learnMore", { defaultValue: "Learn more" })}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
