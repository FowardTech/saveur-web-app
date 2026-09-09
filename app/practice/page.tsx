import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCard } from "@/components/ui/ActionCard";

const modes = [
  {
    href: "/practice/mock-interviews",
    icon: "mic-outline" as const,
    title: "Mock Interviews",
    description: "Practice live with an AI interviewer across behavioral, technical, and role-specific formats.",
    tint: { bg: "bg-tint-mint", text: "text-tint-mint-text" },
  },
  {
    href: "/practice/coding",
    icon: "code-outline" as const,
    title: "Coding Practice",
    description: "Work through real coding problems with instant AI review and feedback.",
    tint: { bg: "bg-tint-purple", text: "text-tint-purple-text" },
  },
  {
    href: "/practice/scenarios",
    icon: "clipboard-outline" as const,
    title: "Practical Scenarios",
    description: "Hands-on, multi-step judgment scenarios for sales, healthcare, finance, and more.",
    tint: { bg: "bg-tint-orange", text: "text-tint-orange-text" },
  },
];

export default function PracticeHubPage() {
  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-5xl flex-col gap-8 pb-10">
          <PageHeader
            title="Practice"
            subtitle="Choose a mode to sharpen your skills before the real thing."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {modes.map((mode) => (
              <ActionCard
                key={mode.href}
                href={mode.href}
                icon={mode.icon}
                title={mode.title}
                description={mode.description}
                tint={mode.tint}
              />
            ))}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
