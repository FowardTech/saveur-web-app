import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCard } from "@/components/ui/ActionCard";

const settingsLinks = [
  {
    href: "/settings/profile",
    icon: "person-outline" as const,
    title: "Profile",
    description: "Update your name and view your account email.",
    tint: { bg: "bg-tint-mint", text: "text-tint-mint-text" },
  },
  {
    href: "/settings/payment",
    icon: "credit-card-outline" as const,
    title: "Payment Method",
    description: "Manage your subscription and billing details.",
    tint: { bg: "bg-tint-purple", text: "text-tint-purple-text" },
  },
  {
    href: "/settings/security",
    icon: "shield-outline" as const,
    title: "Security",
    description: "Two-factor authentication and account security.",
    tint: { bg: "bg-tint-orange", text: "text-tint-orange-text" },
  },
];

export default function SettingsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-5xl flex-col gap-8 pb-10">
          <PageHeader title="Settings" subtitle="Manage your account, billing, and security." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {settingsLinks.map((link) => (
              <ActionCard key={link.href} href={link.href} icon={link.icon} title={link.title} description={link.description} tint={link.tint} />
            ))}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
