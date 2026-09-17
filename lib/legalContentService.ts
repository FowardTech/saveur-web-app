import apiClient from "./apiClient";

/** Backs /terms and /privacy — mirrors mobile's services/contentService.ts
 * getLegalContent (GET /api/v1/content/legal/{slug}), the same public,
 * unauthenticated, admin-editable, language-aware endpoint (Saveur-Backend's
 * app/api/content.py). Single source of truth shared with mobile, rather
 * than a separate static copy on web that could drift out of sync. */
export type LegalSlug = "privacy_policy" | "terms_of_service";

export interface LegalContent {
  slug: string;
  title: string;
  bodyMd: string;
  updatedAt: number | null;
}

interface LegalContentWire {
  slug: string;
  title?: string;
  body_md?: string;
  updated_at?: string | null;
}

function fromWire(wire: LegalContentWire): LegalContent {
  return {
    slug: wire.slug,
    title: wire.title ?? "",
    bodyMd: wire.body_md ?? "",
    updatedAt: wire.updated_at ? new Date(wire.updated_at).getTime() : null,
  };
}

export async function getLegalContent(slug: LegalSlug, language: string): Promise<LegalContent> {
  const data = await apiClient.get<LegalContentWire>(`/api/v1/content/legal/${slug}`, {
    auth: false,
    params: { language },
  });
  return fromWire(data);
}
