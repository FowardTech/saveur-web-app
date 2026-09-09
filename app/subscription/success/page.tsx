import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { LinkButton } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";

export default function SubscriptionSuccessPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
          <EvaIcon name="checkmark-circle-2-outline" size={28} />
        </span>
        <h1 className="text-2xl font-bold text-primary">You&apos;re all set</h1>
        <p className="text-sm text-hint">
          Your subscription is being confirmed. It may take a moment to reflect everywhere in your account.
        </p>
        <LinkButton href="/dashboard">Go to dashboard</LinkButton>
        <Link href="/subscription" className="text-sm text-link hover:underline">
          Back to plans
        </Link>
      </div>
    </AppShell>
  );
}
