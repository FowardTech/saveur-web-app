// Ported 1:1 from mobile's constants/Data.ts (DATA_COMPANIES, COMPANY_ANY,
// REGION_BY_COUNTRY, REGION_COMPANIES, companiesForCountries) for the web
// Mock Interview Setup wizard's company picker (app/practice/mock-interviews/
// page.tsx). Kept as a straight port rather than a shared package since the
// two apps don't currently share a common lib — if these ever drift, mobile's
// copy is the source of truth (see that file's own comments for the product
// history behind each entry).

export const DATA_COMPANIES: string[] = [
  "Google",
  "Amazon",
  "Microsoft",
  "Meta",
  "Apple",
  "Netflix",
  "Stripe",
  "Airbnb",
  "Uber",
  "Salesforce",
  "Goldman Sachs",
  "JPMorgan Chase",
  "Morgan Stanley",
  "McKinsey & Company",
  "Boston Consulting Group",
  "Bain & Company",
  "Deloitte",
  "PwC",
  "Johnson & Johnson",
  "Procter & Gamble",
];

export const COMPANY_ANY = "Other / Any Company";

export type CompanyRegion =
  | "north_america"
  | "uk_ireland"
  | "western_europe"
  | "nordics"
  | "eastern_europe"
  | "anz"
  | "southeast_asia"
  | "east_asia"
  | "south_asia"
  | "middle_east"
  | "africa"
  | "latin_america";

export const REGION_BY_COUNTRY: Record<string, CompanyRegion> = {
  "United States": "north_america",
  Canada: "north_america",
  "United Kingdom": "uk_ireland",
  Ireland: "uk_ireland",
  Germany: "western_europe",
  France: "western_europe",
  Spain: "western_europe",
  Portugal: "western_europe",
  Italy: "western_europe",
  Switzerland: "western_europe",
  Austria: "western_europe",
  Belgium: "western_europe",
  Netherlands: "western_europe",
  Luxembourg: "western_europe",
  Denmark: "nordics",
  Sweden: "nordics",
  Norway: "nordics",
  Finland: "nordics",
  Iceland: "nordics",
  Poland: "eastern_europe",
  "Czech Republic": "eastern_europe",
  Hungary: "eastern_europe",
  Romania: "eastern_europe",
  Greece: "eastern_europe",
  Estonia: "eastern_europe",
  Latvia: "eastern_europe",
  Lithuania: "eastern_europe",
  Australia: "anz",
  "New Zealand": "anz",
  Singapore: "southeast_asia",
  Malaysia: "southeast_asia",
  Indonesia: "southeast_asia",
  Philippines: "southeast_asia",
  Thailand: "southeast_asia",
  Vietnam: "southeast_asia",
  "Hong Kong": "east_asia",
  Taiwan: "east_asia",
  Japan: "east_asia",
  "South Korea": "east_asia",
  China: "east_asia",
  India: "south_asia",
  Pakistan: "south_asia",
  Bangladesh: "south_asia",
  "Sri Lanka": "south_asia",
  "United Arab Emirates": "middle_east",
  "Saudi Arabia": "middle_east",
  Qatar: "middle_east",
  Israel: "middle_east",
  Turkey: "middle_east",
  Egypt: "middle_east",
  Nigeria: "africa",
  Kenya: "africa",
  Ghana: "africa",
  "South Africa": "africa",
  Morocco: "africa",
  Brazil: "latin_america",
  Mexico: "latin_america",
  Argentina: "latin_america",
  Chile: "latin_america",
  Colombia: "latin_america",
  Peru: "latin_america",
  "Costa Rica": "latin_america",
  Uruguay: "latin_america",
};

export const REGION_COMPANIES: Partial<Record<CompanyRegion, string[]>> = {
  uk_ireland: [
    "HSBC", "Barclays", "BP", "Unilever", "Vodafone", "Tesco",
    "GlaxoSmithKline", "AstraZeneca", "Rolls-Royce", "Revolut", "Sky",
  ],
  western_europe: [
    "SAP", "Siemens", "Volkswagen", "BMW", "Mercedes-Benz", "Nestlé",
    "Roche", "Novartis", "LVMH", "L'Oréal", "TotalEnergies", "ING",
    "Philips", "ASML", "Adyen",
  ],
  nordics: [
    "Spotify", "Ericsson", "Volvo", "IKEA", "Novo Nordisk", "Maersk",
    "Nokia", "H&M", "Equinor", "Klarna",
  ],
  eastern_europe: [
    "CD Projekt", "Škoda Auto", "Wise", "Bolt", "InPost", "Allegro",
    "MOL Group",
  ],
  anz: [
    "Atlassian", "Canva", "Commonwealth Bank", "BHP", "Telstra",
    "Woolworths", "Xero", "Qantas",
  ],
  southeast_asia: [
    "Grab", "Sea Limited", "DBS Bank", "Singtel", "Gojek", "Tokopedia",
    "TSMC", "PLDT",
  ],
  east_asia: [
    "Sony", "Toyota", "SoftBank", "Rakuten", "Samsung", "LG", "Hyundai",
    "Naver", "Alibaba", "Tencent", "ByteDance", "Huawei",
  ],
  south_asia: [
    "Tata Consultancy Services", "Infosys", "Wipro", "Reliance Industries",
    "HDFC Bank", "Flipkart", "Zomato",
  ],
  middle_east: [
    "Emirates", "Saudi Aramco", "Qatar Airways", "Wix", "Check Point",
    "Careem", "noon", "Turkish Airlines",
  ],
  africa: [
    "Flutterwave", "Paystack", "MTN Group", "Dangote Group", "Safaricom",
    "Naspers", "Standard Bank", "Jumia",
  ],
  latin_america: [
    "Nubank", "Mercado Libre", "Itaú Unibanco", "Rappi", "América Móvil",
    "Grupo Bimbo", "iFood",
  ],
};

/**
 * Region-aware company list for the interview setup company picker — the
 * user's own regional employers (deduped, in REGION_COMPANIES order) first,
 * then the rest of DATA_COMPANIES. Takes the user's full preferredCountries
 * list since a user can select more than one at signup/in job preferences,
 * and surfaces every matching region's companies, not just the first
 * country's.
 */
export function companiesForCountries(preferredCountries: string[] | undefined): string[] {
  const regional: string[] = [];
  const seen = new Set<string>();
  (preferredCountries ?? []).forEach((country) => {
    const region = REGION_BY_COUNTRY[country];
    const companies = region ? REGION_COMPANIES[region] : undefined;
    (companies ?? []).forEach((name) => {
      if (!seen.has(name)) {
        seen.add(name);
        regional.push(name);
      }
    });
  });
  const rest = DATA_COMPANIES.filter((name) => !seen.has(name));
  return [...regional, ...rest];
}

// ---------------------------------------------------------------------------
// Company logo guessing — ported from mobile's utils/companyLogo.ts. Same
// geticon.dev domain-guess approach (Clearbit's logo API shut down for good
// on Dec 8 2025); CompanyLogoAvatar.tsx (components/practice/) is the web
// counterpart to mobile's own avatar component and degrades to a plain
// building icon (never initials) on a 404, same fallback contract.
// ---------------------------------------------------------------------------

const KNOWN_DOMAIN_OVERRIDES: Record<string, string> = {
  "boston consulting group": "bcg.com",
  "johnson & johnson": "jnj.com",
  "procter & gamble": "pg.com",
  google: "google.com",
  alphabet: "abc.xyz",
  amazon: "amazon.com",
  microsoft: "microsoft.com",
  apple: "apple.com",
  meta: "meta.com",
  facebook: "meta.com",
  netflix: "netflix.com",
  tesla: "tesla.com",
  nvidia: "nvidia.com",
  openai: "openai.com",
  ibm: "ibm.com",
  oracle: "oracle.com",
  salesforce: "salesforce.com",
  adobe: "adobe.com",
  intel: "intel.com",
  cisco: "cisco.com",
  spotify: "spotify.com",
  airbnb: "airbnb.com",
  uber: "uber.com",
  lyft: "lyft.com",
  stripe: "stripe.com",
  paypal: "paypal.com",
  shopify: "shopify.com",
  linkedin: "linkedin.com",
  twitter: "x.com",
  x: "x.com",
  samsung: "samsung.com",
  sony: "sony.com",
  dell: "dell.com",
  hp: "hp.com",
  "hewlett packard": "hp.com",
  walmart: "walmart.com",
  target: "target.com",
  costco: "costco.com",
  jpmorgan: "jpmorganchase.com",
  "jpmorgan chase": "jpmorganchase.com",
  "goldman sachs": "goldmansachs.com",
  "morgan stanley": "morganstanley.com",
  visa: "visa.com",
  mastercard: "mastercard.com",
  "american express": "americanexpress.com",
  mckinsey: "mckinsey.com",
  deloitte: "deloitte.com",
  accenture: "accenture.com",
  ey: "ey.com",
  kpmg: "kpmg.com",
  pwc: "pwc.com",
  bcg: "bcg.com",
  bain: "bain.com",
  "coca-cola": "coca-colacompany.com",
  pepsico: "pepsico.com",
  nike: "nike.com",
  adidas: "adidas.com",
  disney: "disney.com",
  starbucks: "starbucks.com",
  mcdonalds: "mcdonalds.com",
  "mcdonald's": "mcdonalds.com",
  boeing: "boeing.com",
  airbus: "airbus.com",
  ford: "ford.com",
  "general motors": "gm.com",
  toyota: "toyota.com",
  siemens: "siemens.com",
  sap: "sap.com",
  atlassian: "atlassian.com",
  slack: "slack.com",
  zoom: "zoom.us",
  dropbox: "dropbox.com",
  github: "github.com",
  gitlab: "gitlab.com",
  figma: "figma.com",
  notion: "notion.so",
  asana: "asana.com",
  hubspot: "hubspot.com",
  twilio: "twilio.com",
  snowflake: "snowflake.com",
  databricks: "databricks.com",
  palantir: "palantir.com",
  anthropic: "anthropic.com",
  coinbase: "coinbase.com",
  doordash: "doordash.com",
  pinterest: "pinterest.com",
  reddit: "reddit.com",
  etsy: "etsy.com",
  ebay: "ebay.com",
};

const CORPORATE_SUFFIXES = new Set([
  "incorporated", "corporation", "holdings", "limited", "company", "group",
  "worldwide", "global", "international", "technologies", "solutions",
  "services", "partners", "llc", "inc", "ltd", "corp", "co", "plc", "gmbh",
  "sa", "ag", "nv", "pty",
]);

function guessCompanyDomain(company: string): string | null {
  const name = company.trim().toLowerCase();
  if (!name) return null;
  const override = KNOWN_DOMAIN_OVERRIDES[name];
  if (override) return override;
  const words = (name.match(/[a-z0-9]+/g) ?? []).filter((w) => !CORPORATE_SUFFIXES.has(w));
  const slug = words.join("");
  return slug ? `${slug}.com` : null;
}

/** Best-effort geticon.dev logo URL for a company name, or null when
 * nothing usable could be guessed. */
export function guessCompanyLogoUrl(company?: string | null): string | null {
  if (!company) return null;
  const domain = guessCompanyDomain(company);
  return domain ? `https://geticon.dev/?url=${encodeURIComponent(domain)}` : null;
}
