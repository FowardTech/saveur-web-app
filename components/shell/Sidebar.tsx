"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { primaryNav, secondaryNav, isNavGroup, type NavItem } from "@/lib/navigation";

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
        <span className="flex-1 truncate text-left">{item.label}</span>
        <EvaIcon name="chevron-down-outline" size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
          {item.children.map((child) => (
            <NavLink key={child.href} href={child.href} icon={child.icon} label={child.label} active={pathname === child.href} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-surface-1">
      <div className="flex items-center gap-2 px-5 py-5">
        <Image src="/logo-mark.png" alt="" width={28} height={26} priority />
        <span className="text-xl font-bold tracking-tight text-primary">
          Saveur<span className="text-brand">.</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3" onClick={onNavigate}>
        <div className="flex flex-col gap-0.5">
          {primaryNav.map((item) =>
            isNavGroup(item) ? (
              <NavGroupItem key={item.label} item={item} pathname={pathname} />
            ) : (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} />
            )
          )}
        </div>

        <div className="my-3 border-t border-border" />

        <div className="flex flex-col gap-0.5 pb-4">
          {secondaryNav.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} />
          ))}
        </div>
      </nav>

      <div className="border-t border-border px-3 py-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-pill px-3 py-2 text-sm text-hint transition hover:bg-surface-3 hover:text-primary"
        >
          <EvaIcon name="globe-2-outline" size={18} />
          <span className="flex-1 text-left">Language</span>
          <span className="text-xs text-hint">English</span>
        </button>
      </div>
    </div>
  );
}
