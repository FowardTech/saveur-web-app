import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// companySearchService — AI web search fallback for the Mock Interview Setup
// wizard's company picker, ported from mobile's
// services/companySearchService.ts. See Saveur-Backend's
// app/services/company_search_service.py — a real, citations-verified
// Perplexity search, not a blind name-slug guess.
//
//   POST /api/v1/companies/search — {query} -> {company: {name, domain,
//                                    logoUrl} | null}
// ---------------------------------------------------------------------------

export interface CompanySearchResult {
  name: string;
  domain: string;
  logoUrl: string | null;
}

interface CompanySearchWire {
  name: string;
  domain: string;
  logoUrl?: string | null;
}

/** Returns null when nothing was confidently identified — the caller
 * (app/practice/mock-interviews/page.tsx) treats that the same whether the
 * search genuinely found no such company or the lookup itself failed, since
 * a company field is always optional here. */
export async function searchCompany(query: string): Promise<CompanySearchResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const data = await apiClient.post<{ company: CompanySearchWire | null }>("/api/v1/companies/search", {
      query: trimmed,
    });
    if (!data.company) return null;
    return {
      name: data.company.name,
      domain: data.company.domain,
      logoUrl: data.company.logoUrl ?? null,
    };
  } catch {
    return null;
  }
}
