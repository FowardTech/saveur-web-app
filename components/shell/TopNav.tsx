"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { BrandLockup } from "./BrandLockup";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { SiteSearch } from "./SiteSearch";
import { useAuth } from "@/app/providers/AuthProvider";
import { LinkButton } from "@/components/ui/Button";
import { primaryNav, secondaryNav, isNavGroup, filterNav, type NavItem, type NavLeaf } from "@/lib/navigation";
import { isFeatureEnabled } from "@/lib/appConfigService";

// Indeed-style top navigation (product request: "redesign the web app to look
// like Indeed UI"): a white bar with the logo on the left, plain bold text
// links whose active one is marked with a 2px blue underline, dropdowns for
// the groups, and the notification / profile icons on the right. It replaces
// the old fixed left sidebar on desktop; the sidebar still exists as the
// slide-over drawer on small screens (hamburger on the left).

// Which top-level entries sit directly in the bar (by labelKey); everything
// else in the nav tree goes under "More".
const INLINE_KEYS = ["home", "aiCoach", "practice", "jobTracker", "careerTools", "resumeTools", "learningCourses"];

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ref, onClose]);
}

function isActiveHref(pathname: string, href: string) {
  const base = href.split("?")[0];
  return pathname === base || pathname.startsWith(base + "/");
}

function labelOf(t: (k: string, o: { defaultValue: string }) => string, item: { label: string; labelKey?: string }) {
  return item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label;
}

const linkBase = "relative flex h-16 items-center px-3 text-sm font-bold transition-colors";

function NavLink({ item, pathname, t }: { item: NavLeaf; pathname: string; t: Parameters<typeof labelOf>[0] }) {
  const active = isActiveHref(pathname, item.href);
  return (
    <Link href={item.href} className={`${linkBase} ${active ? "text-primary" : "text-hint hover:text-primary"}`}>
      {labelOf(t, item)}
      {active && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-brand" />}
    </Link>
  );
}

function Dropdown({
  label,
  active,
  children,
  wide,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useOutsideClose(ref, () => setOpen(false));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${linkBase} gap-1 ${active || open ? "text-primary" : "text-hint hover:text-primary"}`}
      >
        {label}
        <EvaIcon name="chevron-down-outline" size={14} />
        {active && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-brand" />}
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full z-40 mt-0 rounded-card border border-border bg-surface-2 p-2 shadow-lg ${
            wide ? "w-[560px]" : "w-64"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuLink({ item, t }: { item: NavLeaf; t: Parameters<typeof labelOf>[0] }) {
  return (
    <Link href={item.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-surface-3">
      <EvaIcon name={item.icon} size={16} className="shrink-0 text-hint" />
      <span className="truncate">{labelOf(t, item)}</span>
    </Link>
  );
}

export function TopNav({ onMenuClick }: { onMenuClick?: () => void }) {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "";
  const { firebaseUser, loading } = useAuth();
  const isSignedIn = !!firebaseUser;

  const { inline, more } = useMemo(() => {
    const prim = filterNav(primaryNav, (f) => isFeatureEnabled(f as never));
    const inlineItems: NavItem[] = [];
    const rest: NavLeaf[] = [];
    for (const item of prim) {
      if (INLINE_KEYS.includes(item.labelKey ?? "")) inlineItems.push(item);
      else if (isNavGroup(item)) rest.push(...item.children);
      else rest.push(item);
    }
    rest.push(...secondaryNav);
    return { inline: inlineItems, more: rest };
  }, []);

  const moreActive = more.some((m) => isActiveHref(pathname, m.href));

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-page px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={t("web:shell.toggleSidebar", { defaultValue: "Toggle sidebar" })}
        className="mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-surface-3 lg:hidden"
      >
        <EvaIcon name="menu-outline" size={20} />
      </button>

      <Link href={isSignedIn ? "/dashboard" : "/"} className="mr-4 shrink-0">
        <BrandLockup size={28} textClassName="text-xl" />
      </Link>

      {isSignedIn && (
        <nav className="hidden items-center lg:flex">
          {inline.map((item) =>
            isNavGroup(item) ? (
              <Dropdown key={item.label} label={labelOf(t, item)} active={item.children.some((c) => isActiveHref(pathname, c.href))}>
                {item.children.map((c) => (
                  <MenuLink key={c.href} item={c} t={t} />
                ))}
              </Dropdown>
            ) : (
              <NavLink key={item.href} item={item} pathname={pathname} t={t} />
            ),
          )}
          <Dropdown label={t("web:shell.more", { defaultValue: "More" }).toString()} active={moreActive} wide>
            <div className="grid grid-cols-2 gap-x-2">
              {more.map((m) => (
                <MenuLink key={m.href} item={m} t={t} />
              ))}
            </div>
          </Dropdown>
        </nav>
      )}

      <div className="ml-auto flex items-center gap-2">
        {!loading && isSignedIn && (
          <div data-tour="navbar-search" className="hidden 2xl:block">
            <SiteSearch />
          </div>
        )}
        {!loading && !isSignedIn && (
          <>
            <ThemeToggle />
            <LinkButton href="/login" variant="ghost" size="sm">
              {t("common:actions.signIn", { defaultValue: "Sign In" })}
            </LinkButton>
            <LinkButton href="/register" variant="primary" size="sm">
              {t("common:actions.register", { defaultValue: "Register" })}
            </LinkButton>
          </>
        )}
        {!loading && isSignedIn && (
          <>
            <ThemeToggle />
            <span data-tour="navbar-notifications">
              <NotificationBell />
            </span>
            <span data-tour="navbar-profile">
              <UserMenu />
            </span>
          </>
        )}
      </div>
    </header>
  );
}
