import i18n from "i18next";
import apiClient from "./apiClient";

export interface PlaceResult {
  name: string;
  region: string;
  country: string;
  /** "Iqaluit, Nunavut" — city plus its region, no country. */
  label: string;
  full: string;
}

/** Worldwide town/city search (optionally limited to one country). Never throws. */
export async function searchPlaces(q: string, country?: string): Promise<PlaceResult[]> {
  try {
    const r = await apiClient.get<{ places: PlaceResult[] }>("/api/v1/places/search", {
      params: { q, country, lang: i18n.language || "en" },
    });
    return r.places ?? [];
  } catch {
    return [];
  }
}
