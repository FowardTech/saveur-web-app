"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";

export function UserMenu() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const firstName = profile?.firstName || profile?.name?.split(" ")[0] || "Account";
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-pill py-1 pl-1 pr-3 transition hover:bg-surface-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-medium text-white">
          {initial}
        </span>
        <span className="hidden text-sm font-medium text-primary sm:inline">{firstName}</span>
        <EvaIcon name="chevron-down-outline" size={14} className="hidden text-hint sm:inline" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded-card border border-border bg-surface-2 p-1.5 shadow-lg">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-primary hover:bg-surface-3"
          >
            <EvaIcon name="person-outline" size={16} />
            {t("web:shell.profile", { defaultValue: "Profile" })}
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-primary hover:bg-surface-3"
          >
            <EvaIcon name="settings-2-outline" size={16} />
            {t("common:nav.settings", { defaultValue: "Settings" })}
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-surface-3"
          >
            <EvaIcon name="log-out-outline" size={16} />
            {t("common:actions.signOut", { defaultValue: "Sign out" })}
          </button>
        </div>
      )}
    </div>
  );
}
