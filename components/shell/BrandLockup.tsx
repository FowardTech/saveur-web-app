import Image from "next/image";

/** The app's one real logo+wordmark lockup — logo-badge.png at a 22% corner
 * radius next to "Saveur." set in the self-hosted Montserrat Alternates
 * Black wordmark font (`font-brand`). Used by Sidebar.tsx and
 * AuthLayout.tsx; also used by app/onboarding/page.tsx's header, which used
 * to have its own bare-text-only "Saveur." (no logo image, no brand font) —
 * inconsistent with this app's "logo everywhere" pattern. Pulled out here so
 * the three call sites can't drift out of sync with each other again. */
export function BrandLockup({
  size = 28,
  textClassName = "text-2xl",
}: {
  size?: number;
  textClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Image src="/logo-badge.png" alt="" width={size} height={size} priority className="rounded-[22%]" />
      <span className={`font-brand tracking-tight text-primary ${textClassName}`}>
        Saveur<span className="text-brand">.</span>
      </span>
    </div>
  );
}

export default BrandLockup;
