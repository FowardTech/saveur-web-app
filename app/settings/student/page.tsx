"use client";

import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { StudentVerificationStep } from "@/components/onboarding/StudentVerificationStep";

// Standalone "Student Package and Verification" page — reachable any time
// from Settings (mobile's More menu entry, src/more/MoreSrc.tsx), not just
// the optional onboarding step (app/onboarding/page.tsx). Product report:
// "I noticed that you did not implement the student package in the
// onboarding and in the dashboard. Why?" `onDone` is intentionally omitted
// here — see StudentVerificationStep's own header comment for why that
// hides the Skip/Continue affordances that only make sense mid-wizard.
export default function StudentVerificationPage() {
  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <div className="rounded-card border border-border bg-surface-2 p-6 sm:p-8">
            <StudentVerificationStep />
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
