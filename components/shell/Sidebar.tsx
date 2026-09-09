"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { primaryNav, secondaryNav, isNavGroup, type NavItem } from "@/lib/navigation";
import { SUPPORTED_LANGUAGES, LOCALE_STORAGE_KEY, getLanguageNativeLabel } from "@/i18n/config";
import { useAuth } from "@/app/providers/AuthProvider";

function NavLink({ href, icon, label, active }: { href: string; icon: Parameters<typeof EvaIcon>[0]["name"]; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-pill px-3 py-2 text-sm transition ${
        active ? "bg-brand/10 text-brand font-medium" : "text-hint hover:bg-surface-3 hover:text-primary"
      }`}
    >
      <EvaIcon name={icon} size={18} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavGroupItem({ item, pathname }: { item: Extract<NavItem, { children: unknown[] }>; pathname: string }) {
  const { t } = useTranslation();
  const hasActiveChild = item.children.some((c) => pathname.startsWith(c.href));
  const [open, setOpen] = useState(hasActiveChild);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-pill px-3 py-2 text-sm transition ${
          hasActiveChild ? "text-brand font-medium" : "text-hint hover:bg-surface-3 hover:text-primary"
        }`}
      >
        <EvaIcon name={item.icon} size={18} />
        <span className="flex-1 truncate text-left">
          {item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label}
        </span>
        <EvaIcon name="chevron-down-outline" size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              href={child.href}
              icon={child.icon}
              label={child.labelKey ? t(`common:nav.${child.labelKey}`, { defaultValue: child.label }) : child.label}
              active={pathname === child.href}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const { profile, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function selectLanguage(code: string) {
    setOpen(false);
    if (code === i18n.language) return;
    await i18n.changeLanguage(code);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, code);
    } catch {
      // localStorage unavailable — ignore, in-memory language change still applies.
    }
    if (profile) {
      setSaving(true);
      try {
        await updateProfile({ locale: code });
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className="flex w-full items-center gap-3 rounded-pill px-3 py-2 text-sm text-hint transition hover:bg-surface-3 hover:text-primary disabled:opacity-60"
      >
        <EvaIcon name="globe-2-outline" size={18} />
        <span className="flex-1 text-left">{t("common:nav.language", { defaultValue: "Language" })}</span>
        <span className="text-xs text-hint">{getLanguageNativeLabel(i18n.language)}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-56 overflow-y-auto rounded-card border border-border bg-surface-2 p-1.5 shadow-lg">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => selectLanguage(lang.code)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-3 ${
                lang.code === i18n.language ? "text-brand font-medium" : "text-primary"
              }`}
            >
              <span>{lang.nativeLabel}</span>
              {lang.code === i18n.language && <EvaIcon name="checkmark-outline" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-64 flex-col bg-surface-1">
      <div className="flex items-center gap-2 px-5 py-5">
        <Image src="/logo-badge.png" alt="" width={28} height={28} priority className="rounded-[22%]" />
        <span className="font-brand text-xl tracking-tight text-primary">
          Saveur<span className="text-brand">.</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3" onClick={onNavigate}>
        <div className="flex flex-col gap-0.5">
          {primaryNav.map((item) =>
            isNavGroup(item) ? (
              <NavGroupItem key={item.label} item={item} pathname={pathname} />
            ) : (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label}
                active={pathname === item.href}
              />
            )
          )}
        </div>

        <div className="my-3 border-t border-border" />

        <div className="flex flex-col gap-0.5 pb-4">
          {secondaryNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label}
              active={pathname === item.href}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-border px-3 py-3">
        <LanguageMenu />
      </div>
    </div>
  );
}
