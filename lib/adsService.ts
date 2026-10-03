import apiClient from "./apiClient";

// Web port of Saveur/services/adsService.ts (popup half). Backend:
//   GET  /api/v1/ads/next            -> next eligible popup ad or {}
//   POST /api/v1/ads/<id>/impression -> record that it was actually shown
export interface Advertisement {
  id: number;
  title: string;
  body: string;
  imageUrl?: string;
  detailBody: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

interface AdWire {
  id?: number;
  title?: string | null;
  body?: string | null;
  image_url?: string;
  detail_body?: string | null;
  cta_url?: string;
  cta_label?: string;
}

export async function getNextAd(): Promise<Advertisement | null> {
  const wire = await apiClient.get<AdWire>("/api/v1/ads/next");
  if (!wire || !wire.id) return null;
  return {
    id: wire.id,
    title: wire.title || "",
    body: wire.body || "",
    imageUrl: wire.image_url || undefined,
    detailBody: wire.detail_body || "",
    ctaUrl: wire.cta_url || undefined,
    ctaLabel: wire.cta_label || undefined,
  };
}

export async function recordImpression(adId: number): Promise<void> {
  await apiClient.post(`/api/v1/ads/${adId}/impression`);
}
