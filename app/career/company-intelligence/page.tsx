"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/company_intel.py
//   POST /api/v1/company-intel/research -> {company, overview, recent_developments,
//     culture_notes, likely_questions, talking_points, salary_range, interview_process, sources}
interface Intel {
  company: string;
  overview: string;
  recent_developments: string[];
  culture_notes: string;
  likely_questions: string[];
  talking_points: string[];
  salary_range: string;
  interview_process: string;
  sources: string[];
}

export default function CompanyIntelligencePage() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intel, setIntel] = useState<Intel | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    setLoading(true);
    setError(null);
    setIntel(null);
    try {
      const data = await apiClient.post<Intel>("/api/v1/company-intel/research", {
        company: company.trim(),
        role: role.trim() || undefined,
      });
      setIntel(data);
    } catch (err) {
      setError((err as ApiError).message || "Couldn't research that company right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
        <PageHeader title="Company Intelligence" subtitle="AI research on a target company before your interview." />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
          <TextField label="Company" placeholder="e.g. Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} required />
          <TextField label="Role (optional)" placeholder="e.g. Product Manager" value={role} onChange={(e) => setRole(e.target.value)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading || !company.trim()} className="mt-1 w-full">
            {loading ? "Researching…" : "Research company"}
          </Button>
        </form>

        {intel && (
          <div className="flex flex-col gap-4">
            <div className="rounded-card border border-border bg-surface-2 p-5">
              <h2 className="font-semibold text-primary">{intel.company}</h2>
              <p className="mt-2 text-sm text-hint">{intel.overview}</p>
            </div>

            {intel.recent_developments?.length > 0 && (
              <Section title="Recent developments" items={intel.recent_developments} />
            )}
            {intel.culture_notes && (
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h3 className="text-sm font-semibold text-primary">Culture notes</h3>
                <p className="mt-2 text-sm text-hint">{intel.culture_notes}</p>
              </div>
            )}
            {intel.likely_questions?.length > 0 && <Section title="Likely interview questions" items={intel.likely_questions} />}
            {intel.talking_points?.length > 0 && <Section title="Talking points" items={intel.talking_points} />}
            {intel.salary_range && (
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h3 className="text-sm font-semibold text-primary">Salary range</h3>
                <p className="mt-2 text-sm text-hint">{intel.salary_range}</p>
              </div>
            )}
            {intel.interview_process && (
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h3 className="text-sm font-semibold text-primary">Interview process</h3>
                <p className="mt-2 text-sm text-hint">{intel.interview_process}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-card border border-border bg-surface-2 p-5">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-hint">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
