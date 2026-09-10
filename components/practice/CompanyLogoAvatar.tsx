"use client";

import { useState } from "react";
import { EvaIcon } from "@/components/icons/EvaIcon";

interface CompanyLogoAvatarProps {
  logoUrl?: string | null;
  companyName: string;
  size?: number;
  className?: string;
}

/** Web counterpart to mobile's components/CompanyLogoAvatar.tsx — renders a
 * company's logo (real, AI-search-verified, or geticon.dev-guessed — see
 * lib/companyData.ts's guessCompanyLogoUrl) inside a small round badge, and
 * degrades to a plain briefcase icon (never initials, matching mobile) if
 * the image 404s or no URL could be guessed at all. Used by the Mock
 * Interview Setup company picker (app/practice/mock-interviews/page.tsx). */
export function CompanyLogoAvatar({ logoUrl, companyName, size = 20, className = "" }: CompanyLogoAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !logoUrl || failed;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 ${className}`}
      style={{ width: size, height: size }}
    >
      {showFallback ? (
        <EvaIcon name="briefcase-outline" size={Math.round(size * 0.6)} className="text-hint" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- external,
        // unconfigured domain (geticon.dev / AI-search-provided logo URLs),
        // same reasoning as HomeBannerAd.tsx's own plain <img>.
        <img
          src={logoUrl ?? undefined}
          alt={companyName}
          width={size}
          height={size}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
