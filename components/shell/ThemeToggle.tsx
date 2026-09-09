"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { EvaIcon } from "@/components/icons/EvaIcon";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Classic SSR-safe "mounted" flag: next-themes can't know the real
    // theme until after hydration (it reads localStorage/media query
    // client-side), so this defers rendering the actual icon by one tick to
    // avoid a server/client mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-hint transition hover:bg-surface-3 hover:text-primary ${className}`}
    >
      {mounted ? <EvaIcon name={isDark ? "sun-outline" : "moon-outline"} size={18} /> : null}
    </button>
  );
}
