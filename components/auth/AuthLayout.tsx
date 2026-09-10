import Link from "next/link";
import { BrandLockup } from "@/components/shell/BrandLockup";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="px-6 py-5">
        <Link href="/" className="text-lg font-bold tracking-tight text-primary">
          Saveur<span className="text-brand">.</span>
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm rounded-card border border-border bg-surface-2 p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <BrandLockup size={32} textClassName="text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-primary">{title}</h1>
          <p className="mt-1.5 text-sm text-hint">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 text-center text-sm text-hint">{footer}</div>
        </div>
      </div>
    </div>
  );
}
