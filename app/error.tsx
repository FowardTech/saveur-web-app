"use client";

import Link from "next/link";
import Image from "next/image";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** Root error boundary — catches any otherwise-unhandled render/runtime
 * error thrown by a page or component below the root layout and shows a
 * themed screen instead of Next.js's raw default error overlay/blank page.
 * Deliberately does NOT reuse AppShell/AuthProvider-dependent components:
 * this is the fallback for when something in the app tree already broke,
 * so it stays a minimal, self-contained page (same pattern as AuthLayout)
 * that can't itself fail for the same reason as whatever crashed. */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="px-6 py-5">
        <Link href="/" className="text-lg font-bold tracking-tight text-primary">
          Saveur<span className="text-brand">.</span>
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-card border border-border bg-surface-2 p-6 text-center shadow-sm sm:p-8">
          <div className="mb-1 flex items-center gap-2">
            <Image src="/logo-badge.png" alt="" width={32} height={32} priority className="rounded-[22%]" />
            <span className="font-brand text-2xl tracking-tight text-primary">
              Saveur<span className="text-brand">.</span>
            </span>
          </div>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <EvaIcon name="alert-circle-outline" size={28} />
          </span>
          <h1 className="text-xl font-bold text-primary">Something went wrong</h1>
          <p className="text-sm text-hint">
            An unexpected error occurred. You can try again, or head back to the dashboard.
          </p>
          <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-pill bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-pill border border-border px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-3"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
