export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-bold text-primary sm:text-3xl">{title}</h1>
      {subtitle && <p className="text-sm text-hint">{subtitle}</p>}
    </div>
  );
}
