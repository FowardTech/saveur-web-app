"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/Checkbox";

/**
 * "I agree to the Terms of Service and Privacy Policy" row — shared by
 * login and register (product report: "The user is supposed to accept
 * the terms and conditions and privacy policy before they can sign up or
 * login... implement for both mobile and web"; mirrors mobile's identical
 * block in src/auth/Login/Login.tsx and src/auth/Signup/
 * SignupThirdStep.tsx, including reusing the SAME acceptance requirement
 * on login, not just signup, for parity with mobile's existing behavior).
 *
 * Note on the click handling: the checkbox itself is a real <button> (see
 * Checkbox.tsx) for accessibility, so the surrounding row must NOT also
 * carry its own onClick toggle — a click on the checkbox would otherwise
 * bubble up and fire both handlers, toggling it twice (a net no-op). Only
 * the plain text span toggles on click; the two links stop propagation so
 * navigating to /terms or /privacy doesn't also flip the checkbox.
 */
export function TermsAcceptanceRow({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox checked={checked} onChange={onChange} />
      <span className="cursor-pointer text-sm text-hint" onClick={() => onChange(!checked)}>
        {t("web:auth.agreeTerms", { defaultValue: "By continuing, you agree to our" })}{" "}
        <Link href="/terms" onClick={(e) => e.stopPropagation()} className="font-medium text-link hover:underline">
          {t("common:legal.termsOfService", { defaultValue: "Terms of Service" })}
        </Link>{" "}
        {t("common:legal.and", { defaultValue: "and" })}{" "}
        <Link href="/privacy" onClick={(e) => e.stopPropagation()} className="font-medium text-link hover:underline">
          {t("common:legal.privacyPolicy", { defaultValue: "Privacy Policy" })}
        </Link>
      </span>
    </div>
  );
}
