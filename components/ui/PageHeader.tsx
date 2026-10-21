"use client";

// Indeed-style page header: a plain bold title with an optional gray
// subtitle. (It used to carry a colorful 3D illustration per route; Indeed's
// pages are clean headings on white, so that is gone app-wide.)
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="w-full basis-full">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{title}</h1>
        {subtitle && <p className="max-w-2xl text-sm text-hint sm:text-base">{subtitle}</p>}
      </div>
    </div>
  );
}
