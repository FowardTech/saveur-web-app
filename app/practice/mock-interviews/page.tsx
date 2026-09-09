"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/interviews.py
//   GET  /api/v1/interviews/types    -> {types: string[]}
//   POST /api/v1/interviews/sessions -> {id, type, role, company, difficulty,
//     status, started_at, first_question?, question_id?}
const INTERVIEW_TYPES = [
  "behavioral", "technical", "coding", "system_design", "product_management",
  "sales", "marketing", "finance", "healthcare", "customer_service",
  "government", "consulting", "executive", "graduate", "internship", "sports",
];

function labelFor(type: string) {
  return type
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

interface SessionResult {
  id: number;
  type: string;
  role?: string;
  company?: string;
  difficulty?: string;
  first_question?: string;
}

export default function MockInterviewSetupPage() {
  const [type, setType] = useState("behavioral");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSession(null);
    try {
      const data = await apiClient.post<SessionResult>("/api/v1/interviews/sessions", {
        type,
        role: role.trim() || undefined,
        company: company.trim() || undefined,
        difficulty,
        mode: "text",
      });
      setSession(data);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Couldn't start a session. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
        <PageHeader
          title="Mock Interview"
          subtitle="Set up a session and practice with an AI interviewer."
        />

        {!session && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <SelectField label="Interview type" value={type} onChange={(e) => setType(e.target.value)}>
              {INTERVIEW_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelFor(t)}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Target role (optional)"
              placeholder="e.g. Senior Backend Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
            <TextField
              label="Target company (optional)"
              placeholder="e.g. Acme Corp"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <SelectField label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </SelectField>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading ? "Starting…" : "Start session"}
            </Button>
          </form>
        )}

        {session && (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                <EvaIcon name="checkmark-circle-2-outline" size={22} />
              </span>
              <div>
                <h2 className="font-semibold text-primary">Session created</h2>
                <p className="text-sm text-hint">
                  {labelFor(session.type)}
                  {session.role ? ` · ${session.role}` : ""}
                  {session.company ? ` · ${session.company}` : ""} · Session #{session.id}
                </p>
              </div>
            </div>

            {session.first_question ? (
              <div className="rounded-lg bg-surface-1 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-hint">First question</p>
                <p className="mt-1.5 text-sm text-primary">{session.first_question}</p>
              </div>
            ) : null}

            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-hint">
              This is where the live interview session would run — real-time Q&amp;A with your AI interviewer,
              voice/video mode, and instant feedback at the end. That experience is coming to the web app in a
              future pass; for now, this session is saved to your account the same as a mobile session.
            </div>

            <Button variant="outline" onClick={() => setSession(null)}>
              Start another session
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
