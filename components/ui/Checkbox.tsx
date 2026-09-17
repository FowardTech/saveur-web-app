import React from "react";

/**
 * Plain checkbox matching this design system's Tailwind CSS-variable
 * convention (border-border / bg-brand / text tokens — see Button.tsx,
 * TextField.tsx for the same pattern). No checkbox component existed
 * anywhere in this app before this — added for the Terms of Service /
 * Privacy Policy acceptance gate on login/register (product report:
 * "The user is supposed to accept the terms and conditions and privacy
 * policy before they can sign up or login... implement for both mobile
 * and web" — mirrors the mobile app's existing CheckBox usage in
 * src/auth/Login/Login.tsx and src/auth/Signup/SignupThirdStep.tsx),
 * but written generically enough for any other future checkbox need.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  className = "",
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Plain text label. For a label with embedded links (e.g. "I agree to
   * the Terms and Privacy Policy"), omit this and render the label
   * yourself next to <Checkbox />, wired to the same onChange via the
   * row's onClick — see app/login/page.tsx / app/register/page.tsx for
   * the pattern this was built for. */
  label?: string;
  className?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
        checked ? "border-brand bg-brand text-white" : "border-border bg-surface-2"
      } ${className}`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
          <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
}
