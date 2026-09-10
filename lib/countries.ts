// Web port of Saveur (mobile)'s constants/countries.ts — the shared
// "which countries would you work in" list. Previously app/onboarding/
// page.tsx had its own 6-item stub (`United States`, `United Kingdom`,
// `Canada`, `Germany`, `France`, `Remote`) that didn't match mobile's real
// ~70-country canonical list at all, and app/settings/profile/page.tsx had
// its own separate, differently-named 6-item stub (`COUNTRY_OPTIONS`) on
// top of that — two stubs, neither matching mobile, guaranteed to drift.
// This is the single source of truth both screens now import, mirroring
// mobile's own "one file, two screens" fix (see that file's own header
// comment for the full history).
export const COUNTRIES = [
  "Remote - Anywhere",
  "United States",
  "United Kingdom",
  "Canada",
  "Ireland",
  "Germany",
  "France",
  "Spain",
  "Portugal",
  "Italy",
  "Switzerland",
  "Austria",
  "Belgium",
  "Netherlands",
  "Luxembourg",
  "Denmark",
  "Sweden",
  "Norway",
  "Finland",
  "Iceland",
  "Poland",
  "Czech Republic",
  "Hungary",
  "Romania",
  "Greece",
  "Estonia",
  "Latvia",
  "Lithuania",
  "Australia",
  "New Zealand",
  "Singapore",
  "Malaysia",
  "Indonesia",
  "Philippines",
  "Thailand",
  "Vietnam",
  "Hong Kong",
  "Taiwan",
  "Japan",
  "South Korea",
  "China",
  "India",
  "Pakistan",
  "Bangladesh",
  "Sri Lanka",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Israel",
  "Turkey",
  "Egypt",
  "Nigeria",
  "Kenya",
  "Ghana",
  "South Africa",
  "Morocco",
  "Brazil",
  "Mexico",
  "Argentina",
  "Chile",
  "Colombia",
  "Peru",
  "Costa Rica",
  "Uruguay",
];

// ISO 3166-1 alpha-2 code for every real country in COUNTRIES above (all
// but the synthetic "Remote - Anywhere" entry, which has no country and no
// flag) — same map as mobile's constants/countries.ts, kept in sync by hand
// since this is plain static data, not something either app fetches.
const COUNTRY_ISO_CODES: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  Canada: "CA",
  Ireland: "IE",
  Germany: "DE",
  France: "FR",
  Spain: "ES",
  Portugal: "PT",
  Italy: "IT",
  Switzerland: "CH",
  Austria: "AT",
  Belgium: "BE",
  Netherlands: "NL",
  Luxembourg: "LU",
  Denmark: "DK",
  Sweden: "SE",
  Norway: "NO",
  Finland: "FI",
  Iceland: "IS",
  Poland: "PL",
  "Czech Republic": "CZ",
  Hungary: "HU",
  Romania: "RO",
  Greece: "GR",
  Estonia: "EE",
  Latvia: "LV",
  Lithuania: "LT",
  Australia: "AU",
  "New Zealand": "NZ",
  Singapore: "SG",
  Malaysia: "MY",
  Indonesia: "ID",
  Philippines: "PH",
  Thailand: "TH",
  Vietnam: "VN",
  "Hong Kong": "HK",
  Taiwan: "TW",
  Japan: "JP",
  "South Korea": "KR",
  China: "CN",
  India: "IN",
  Pakistan: "PK",
  Bangladesh: "BD",
  "Sri Lanka": "LK",
  "United Arab Emirates": "AE",
  "Saudi Arabia": "SA",
  Qatar: "QA",
  Israel: "IL",
  Turkey: "TR",
  Egypt: "EG",
  Nigeria: "NG",
  Kenya: "KE",
  Ghana: "GH",
  "South Africa": "ZA",
  Morocco: "MA",
  Brazil: "BR",
  Mexico: "MX",
  Argentina: "AR",
  Chile: "CL",
  Colombia: "CO",
  Peru: "PE",
  "Costa Rica": "CR",
  Uruguay: "UY",
};

/** Converts an ISO 3166-1 alpha-2 code ("US") into its regional-indicator
 * flag emoji ("🇺🇸") — each letter maps to one of the 26 Unicode Regional
 * Indicator Symbol code points (U+1F1E6..U+1F1FF for A..Z); rendering
 * software pairs two adjacent ones into a single flag glyph. Same
 * zero-dependency approach mobile's countries.ts uses (see that file's own
 * comment on why: no SVG flag package, no bundle/network dependency, just a
 * Unicode transform every modern browser already renders as a flag glyph). */
function isoToFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/** ISO 3166-1 alpha-2 code for a COUNTRIES entry, or null for "Remote -
 * Anywhere" (and anything else with no mapped code). components/ui/
 * CountryFlag.tsx uses this to decide between rendering a flag emoji and a
 * globe-icon fallback. */
export function countryIsoCode(countryName: string): string | null {
  return COUNTRY_ISO_CODES[countryName] ?? null;
}

/** Flag emoji for a COUNTRIES entry, or '' for "Remote - Anywhere" (and
 * anything else with no mapped code) — callers should render nothing (not a
 * broken-glyph placeholder) when this comes back empty. */
export function countryFlagEmoji(countryName: string): string {
  const code = countryIsoCode(countryName);
  return code ? isoToFlagEmoji(code) : "";
}
