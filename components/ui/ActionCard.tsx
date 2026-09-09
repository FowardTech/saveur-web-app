import Link from "next/link";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";

interface ActionCardProps {
  href: string;
  icon: EvaIconName;
  title: string;
  description?: string;
  tint?: { bg: string; text: string };
}

/** Matches the mobile app's ActionCard: rounded-12 card, soft tinted icon
 * badge, subtle shadow. Used for both the dashboard quick-actions grid and
 * the landing page's feature showcase. */
export function ActionCard({ href, icon, title, description, tint }: ActionCardProps) {
  const badgeBg = tint?.bg ?? "bg-tint-mint";
  const badgeText = tint?.text ?? "text-tint-mint-text";
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${badgeBg} ${badgeText}`}>
        <EvaIcon name={icon} size={20} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-medium text-primary">{title}</span>
        {description && <span className="text-sm text-hint">{description}</span>}
      </span>
    </Link>
  );
}
