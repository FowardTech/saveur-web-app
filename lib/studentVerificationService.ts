import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// studentVerificationService — web port of mobile's services/
// studentVerificationService.ts. Student verification + discounted billing
// (product report: "I noticed that you did not implement the student
// package in the onboarding and in the dashboard. Why?"). Real, worldwide
// university search (Hipolabs directory, see Saveur-Backend's
// app/services/student_service.py module docstring), school-email
// one-time-code verification, and server-enforced final-year-only
// eligibility — same backend contract mobile already uses
// (app/api/student_verification.py), so nothing new on the backend.
// ---------------------------------------------------------------------------

export type YearOfStudy = "final_year";
// Shown in the picker so a non-final-year student understands why they
// can't proceed, rather than the option simply not existing — only
// 'final_year' is ever sent to the backend as an actual selection.
export const YEAR_OPTIONS: { value: string; isEligible: boolean }[] = [
  { value: "1st_year", isEligible: false },
  { value: "2nd_year", isEligible: false },
  { value: "3rd_year", isEligible: false },
  { value: "final_year", isEligible: true },
];

export interface University {
  name: string;
  country: string;
  countryCode: string;
  domains: string[];
}

interface WireUniversity {
  name?: string;
  country?: string;
  country_code?: string;
  domains?: string[];
}

export async function searchUniversities(query: string, country?: string): Promise<University[]> {
  if (!query.trim() && !country) return [];
  try {
    const data = await apiClient.get<{ items?: WireUniversity[] }>("/api/v1/student/universities", {
      params: { query: query.trim(), country },
    });
    return (data.items ?? []).map((u) => ({
      name: u.name ?? "",
      country: u.country ?? "",
      countryCode: u.country_code ?? "",
      domains: u.domains ?? [],
    }));
  } catch {
    return [];
  }
}

export interface StudentProfile {
  universityName: string | null;
  universityCountry: string | null;
  schoolEmail: string | null;
  schoolEmailVerified: boolean;
  yearOfStudy: string | null;
  graduationDate: string | null;
  isStudent: boolean;
  studentDiscountActive: boolean;
  graduated: boolean;
}

interface WireProfile {
  university_name?: string | null;
  university_country?: string | null;
  school_email?: string | null;
  school_email_verified?: boolean;
  year_of_study?: string | null;
  graduation_date?: string | null;
  is_student?: boolean;
  student_discount_active?: boolean;
  graduated?: boolean;
}

function mapProfile(w: WireProfile): StudentProfile {
  return {
    universityName: w.university_name ?? null,
    universityCountry: w.university_country ?? null,
    schoolEmail: w.school_email ?? null,
    schoolEmailVerified: !!w.school_email_verified,
    yearOfStudy: w.year_of_study ?? null,
    graduationDate: w.graduation_date ?? null,
    isStudent: !!w.is_student,
    studentDiscountActive: !!w.student_discount_active,
    graduated: !!w.graduated,
  };
}

export async function getStatus(): Promise<StudentProfile | null> {
  try {
    const data = await apiClient.get<{ profile?: WireProfile | null }>("/api/v1/student/status");
    return data.profile ? mapProfile(data.profile) : null;
  } catch {
    return null;
  }
}

/** Throws (an ApiError, message already resolved from the backend's
 * `detail`) on rejection — invalid country, non-final year, bad graduation
 * date, etc. */
export async function sendVerificationCode(input: {
  universityName: string;
  universityCountry: string;
  schoolEmail: string;
  yearOfStudy: string;
  graduationDate: string; // YYYY-MM-DD
  // The selected university's own domain(s), straight from
  // searchUniversities() — lets the backend reject an email that isn't
  // actually this school's (or any personal Gmail/Yahoo/Outlook-style
  // address) instead of accepting anything with an "@" in it. See
  // app/services/student_service.py's start_verification.
  universityDomains?: string[];
}): Promise<void> {
  await apiClient.post("/api/v1/student/verify/send-code", {
    university_name: input.universityName,
    university_country: input.universityCountry,
    school_email: input.schoolEmail,
    year_of_study: input.yearOfStudy,
    graduation_date: input.graduationDate,
    university_domains: input.universityDomains ?? [],
  });
}

// Client-side mirror of student_service.py's FREE_EMAIL_DOMAINS check —
// purely for an immediate inline hint before the round trip; the backend
// remains the actual source of truth (this list can't be the only guard,
// since a direct API call could skip the app entirely).
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com",
  "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "protonmail.com", "proton.me", "mail.com", "gmx.com",
  "yandex.com", "zoho.com", "qq.com", "163.com",
]);

function emailDomain(email: string): string {
  return email.trim().split("@").pop()?.toLowerCase() ?? "";
}

export interface SchoolEmailWarning {
  message: string;
  // 'block': unambiguously never valid (a personal provider) — the caller
  // should disable Send, not just show the message.
  // 'warn': the selected university's own domain list doesn't match, but
  // that list can be incomplete/stale in the public directory backing the
  // picker — the server has the final say, so the caller should just show
  // this rather than block submission on it.
  severity: "block" | "warn";
}

/** Best-effort, client-side-only check for the school-email field's inline
 * hint. Returns null if there's nothing to flag yet (empty input, no "@",
 * or it looks fine). The server-side check in
 * app/services/student_service.py's start_verification is the actual
 * enforcement — this only exists to surface the same reasoning before the
 * round trip. */
export function schoolEmailWarning(
  email: string,
  university: { name: string; domains: string[] } | null
): SchoolEmailWarning | null {
  const trimmed = email.trim();
  if (!trimmed.includes("@")) return null;
  const domain = emailDomain(trimmed);
  if (!domain) return null;
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return {
      severity: "block",
      message: "That's a personal email provider — please use your official school email instead.",
    };
  }
  const schoolDomains = (university?.domains ?? []).map((d) => d.toLowerCase().trim()).filter(Boolean);
  if (university && schoolDomains.length && !schoolDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return {
      severity: "warn",
      message: `This doesn't look like a ${university.name} email — expected it to end in @${schoolDomains[0]}.`,
    };
  }
  return null;
}

/** Throws (an ApiError) on a wrong/expired code. */
export async function confirmVerificationCode(code: string): Promise<StudentProfile> {
  const data = await apiClient.post<{ profile?: WireProfile }>("/api/v1/student/verify/confirm-code", { code });
  return mapProfile(data.profile ?? {});
}
