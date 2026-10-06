"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

// Route -> illustration + gradient accent. First matching prefix wins, so the
// most specific routes come first. Every authenticated page that uses
// <PageHeader> gets a colorful hero banner with a fitting 3D illustration.
const ART: { prefix: string; art: string; from: string; to: string }[] = [
  { prefix: "/practice/scenarios", art: "clipboard", from: "#FFE9D6", to: "#FFD3B0" },
  { prefix: "/practice/coding", art: "laptop", from: "#E6E0FF", to: "#D2C8FF" },
  { prefix: "/practice", art: "mic", from: "#DCE9FF", to: "#C4DBFF" },
  { prefix: "/resume", art: "resume", from: "#DDF6EA", to: "#C2EDD7" },
  { prefix: "/jd-analyzer", art: "resume", from: "#DDF6EA", to: "#C2EDD7" },
  { prefix: "/documents", art: "resume", from: "#DDF6EA", to: "#C2EDD7" },
  { prefix: "/learning", art: "books", from: "#FFF1CC", to: "#FFE39B" },
  { prefix: "/career-diary", art: "books", from: "#FFF1CC", to: "#FFE39B" },
  { prefix: "/ai-coach", art: "chat", from: "#E6E0FF", to: "#D2C8FF" },
  { prefix: "/career", art: "compass", from: "#DCE9FF", to: "#D2C8FF" },
  { prefix: "/goals", art: "target", from: "#FFE1E7", to: "#FFC9D4" },
  { prefix: "/applications", art: "target", from: "#FFE1E7", to: "#FFC9D4" },
  { prefix: "/job-alerts", art: "target", from: "#FFE1E7", to: "#FFC9D4" },
  { prefix: "/shared-with-me", art: "chat", from: "#DCE9FF", to: "#E6E0FF" },
];
const DEFAULT_ART = { art: "compass", from: "#DCE9FF", to: "#E6E0FF" };

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const pathname = usePathname() ?? "";
  const a = ART.find((x) => pathname.startsWith(x.prefix)) ?? DEFAULT_ART;
  return (
    <div
      className="page-hero relative w-full basis-full overflow-hidden rounded-[24px] border border-border px-6 py-6 sm:px-8 sm:py-8"
      style={{ ["--hero-a" as string]: a.from, ["--hero-b" as string]: a.to }}
    >
      {/* soft decorative shapes */}
      <span className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-white/50 blur-2xl" />
      <span className="pointer-events-none absolute bottom-[-40px] left-1/3 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
      <span className="pointer-events-none absolute right-40 top-6 hidden h-3 w-3 rounded-full bg-white/80 sm:block" />
      <span className="pointer-events-none absolute right-24 bottom-8 hidden h-2 w-2 rounded-full bg-white/80 sm:block" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#18181b] sm:text-3xl">{title}</h1>
          {subtitle && <p className="max-w-xl text-sm text-[#52525b] sm:text-base">{subtitle}</p>}
        </div>
        <Image
          src={`/illustrations/3d/${a.art}.png`}
          alt=""
          width={120}
          height={120}
          className="hidden h-24 w-24 shrink-0 object-contain drop-shadow-xl sm:block md:h-28 md:w-28"
          priority={false}
        />
      </div>
    </div>
  );
}
