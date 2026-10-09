"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { primaryNav as allPrimaryNav, secondaryNav, isNavGroup, filterNav, type NavItem } from "@/lib/navigation";
import { getAppConfig, isFeatureEnabled } from "@/lib/appConfigService";
import { SUPPORTED_LANGUAGES, LOCALE_STORAGE_KEY, getLanguageNativeLabel } from "@/i18n/config";
import { useAuth } from "@/app/providers/AuthProvider";
import { getMoreBadges, badgeCountFor, type MoreBadges } from "@/lib/moreBadges";
import { getSharedWithMeBadgeCount } from "@/lib/sharesService";
import { onForegroundMessage } from "@/lib/messaging";
import apiClient from "@/lib/apiClient";

// Product report: "The sidebar items icons in the web app should have
// linear gradient background just as the items in the mobile app settings"
// -- exact same 10-color two-stop gradient pairs as src/more/MoreSrc.tsx's
// ICON_GRADIENTS (mobile Settings row icon badges), cycled by position the
// same way (gradientFor(i)) rather than per-item hardcoded colors, so a nav
// item's color is stable by its position in the list but the whole set
// doesn't need hand-picking a color per feature.
/** The gradient badge behind each nav item's icon glyph — a small rounded
 * square filled with a CSS linear-gradient (Tailwind has no utility for an
 * arbitrary two-stop gradient pair, hence the inline style) with a white
 * icon on top, matching mobile's ButtonOptional icon-badge shape/size
 * closely enough to read as the same visual language while staying at the
 * smaller scale a sidebar row needs. */
function NavIconBadge({ icon, active }: { icon: Parameters<typeof EvaIcon>[0]["name"]; index?: number; active?: boolean }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
      <EvaIcon name={icon} size={20} className={active ? "text-brand" : "text-hint"} />
    </span>
  );
}

/** Small unread-count pill — mirrors mobile MainDrawer.tsx's `styles.navBadge`
 * (rounded, brand-colored background, white text) and its `item.badge > 9 ?
 * '9+' : item.badge` convention. */
function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-pill bg-brand px-1.5 text-[11px] font-semibold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
  badge,
  collapsed,
}: {
  href: string;
  icon: Parameters<typeof EvaIcon>[0]["name"];
  label: string;
  active: boolean;
  badge?: number;
  gradientIndex: number;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      // BUG FIX (product report: "I want the font weight for the sidebar
      // elements to be bolder", then follow-up "I thought I asked you to
      // make the font weight of the web app sidebar bolder" after the
      // first pass had no visible effect): inactive rows had no
      // font-weight class at all (the browser default, 400). The first
      // fix bumped active rows to font-semibold (600) -- but this app's
      // self-hosted Plus Jakarta Sans (app/layout.tsx's localFont() call)
      // only registers 400/500/700 .woff2 files, mirroring mobile's three
      // named cuts (Regular/Medium/Bold); 600 was never one of them, so
      // requesting font-semibold asked the browser to fake-match a weight
      // that isn't actually loaded, which renders unreliably (often
      // indistinguishable from 500) instead of visibly bolder. font-bold
      // (700) IS one of the three registered weights, so it's the
      // reliable choice for an active row that needs to read as
      // meaningfully heavier than font-medium (500) on inactive ones.
      // Admin-console nav pattern: rounded-lg rows, small text, active row
      // is a soft brand tint (bg-brand/10) with brand-colored text.
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-brand/10 text-brand" : "text-hint hover:bg-surface-3 hover:text-primary"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      <NavIconBadge icon={icon} active={active} />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && !!badge && <NavBadge count={badge} />}
    </Link>
  );
}

function NavGroupItem({
  item,
  pathname,
  badges,
  gradientIndex,
  collapsed,
}: {
  item: Extract<NavItem, { children: unknown[] }>;
  pathname: string;
  badges: MoreBadges | null;
  gradientIndex: number;
  collapsed?: boolean;
}) {
  const { t } = useTranslation();
  const hasActiveChild = item.children.some((c) => pathname.startsWith(c.href));
  const [open, setOpen] = useState(hasActiveChild);
  const groupBadge = item.children.reduce((sum, c) => sum + (badgeCountFor(c.badgeKey, badges) || 0), 0);
  const groupLabel = item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label;
  if (collapsed) {
    // Icon-rail mode: a group collapses to a single icon linking to its first page.
    return (
      <Link
        href={item.children[0].href}
        title={groupLabel}
        className={`flex items-center justify-center rounded-lg py-2 transition-colors ${
          hasActiveChild ? "bg-brand/10 text-brand" : "text-hint hover:bg-surface-3 hover:text-primary"
        }`}
      >
        <NavIconBadge icon={item.icon} active={hasActiveChild} />
      </Link>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          hasActiveChild ? "text-primary" : "text-hint hover:bg-surface-3 hover:text-primary"
        }`}
      >
        <NavIconBadge icon={item.icon} active={hasActiveChild} />
        <span className="flex-1 truncate text-left">
          {item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label}
        </span>
        {!open && !!groupBadge && <NavBadge count={groupBadge} />}
        <EvaIcon name="chevron-down-outline" size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
          {item.children.map((child, i) => (
            <NavLink
              key={child.href}
              href={child.href}
              icon={child.icon}
              label={child.labelKey ? t(`common:nav.${child.labelKey}`, { defaultValue: child.label }) : child.label}
              active={pathname === child.href}
              badge={badgeCountFor(child.badgeKey, badges)}
              gradientIndex={gradientIndex + i + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LanguageMenu({ collapsed }: { collapsed?: boolean }) {
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
        title={collapsed ? t("common:nav.language", { defaultValue: "Language" }) : undefined}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-hint transition-colors hover:bg-surface-3 hover:text-primary disabled:opacity-60 ${
          collapsed ? "justify-center px-0" : ""
        }`}
      >
        <EvaIcon name="globe-2-outline" size={20} />
        {!collapsed && <span className="flex-1 text-left">{t("common:nav.language", { defaultValue: "Language" })}</span>}
        {!collapsed && <span className="text-xs text-hint">{getLanguageNativeLabel(i18n.language)}</span>}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-56 overflow-y-auto rounded-card border border-border bg-surface-2 p-1.5 shadow-sm">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => selectLanguage(lang.code)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-3 ${
                lang.code === i18n.language ? "text-primary font-medium" : "text-primary"
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

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  /** Icon-rail mode (desktop only). */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { firebaseUser, loading } = useAuth();
  const [badges, setBadges] = useState<MoreBadges | null>(null);

  // BUG FIX (real root cause of "Request failed with status 401" on every
  // page refresh): Sidebar mounts as part of AppShell, which RequireAuth
  // (and app/dashboard/page.tsx's own identical inline pattern) render
  // UNCONDITIONALLY for its own loading placeholder -- so this effect was
  // already live on every single page load, well before any page's own
  // content gets a chance to gate on auth readiness. onAuthStateChanged's
  // handler in AuthProvider calls `setFirebaseUser(user)` BEFORE awaiting
  // `Promise.all([syncProfile(), refreshSubscriptionStatus()])` and only
  // THEN flips `loading` to false -- that `await` means React commits an
  // intermediate render where `firebaseUser` is already truthy but
  // `loading` is still `true`. This effect depended on `firebaseUser`
  // alone, so it fired its authenticated fetch on exactly that
  // intermediate render, every time, instead of waiting for the provider's
  // own "fully ready" signal. Gating on `!loading` too defers the fetch to
  // the steady-state render, after the provider has finished initializing.
  // Fetches the combined badge snapshot: getMoreBadges() covers Job Alerts/
  // Career Events/Settings (all from the one GET /api/v1/more/badges round
  // trip), and getSharedWithMeBadgeCount() is a SEPARATE fetch layered on
  // top for the Shared with Me row (product request: badge it despite
  // neither mobile parity nor /more/badges backing it — see
  // lib/navigation.ts's and lib/moreBadges.ts's comments on that field).
  // Both results merge into the one `badges` state object so
  // badgeCountFor/NavLink's rendering path stays a single code path
  // regardless of which endpoint actually produced a given count.
  function fetchBadges(onResult: (badges: MoreBadges) => void) {
    Promise.all([getMoreBadges(), getSharedWithMeBadgeCount()]).then(([moreBadges, sharedWithMeUnreadCount]) => {
      onResult({ ...moreBadges, sharedWithMeUnreadCount });
    });
  }

  useEffect(() => {
    if (loading || !firebaseUser) {
      setBadges(null);
      return;
    }
    let cancelled = false;
    fetchBadges((result) => {
      if (!cancelled) setBadges(result);
    });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, loading]);

  // Product report: job alerts "are not auto fetching unless I navigate".
  // The nav badge (Job Alerts unread count) was only fetched on mount and on
  // a live foreground push -- a user who never gets/permits push, or whose
  // tab sat open, never saw new matches counted. Re-poll every 60s while the
  // tab is visible and when it regains focus.
  useEffect(() => {
    if (loading || !firebaseUser) return;
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      fetchBadges((result) => {
        if (!cancelled) setBadges(result);
      });
    };
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, loading]);

  // Keep job alerts coming without the user ever opening Job Alerts / Job
  // Tracker (product report: alerts only arrived after navigating there).
  // Silent, best-effort ping on load and whenever the tab regains focus; the
  // backend rate-limits it per user to once per refresh interval (non-
  // subscribers just get a 402 we ignore). The 60s badge poll above then
  // picks up the new unread count, and a push arrives per new alert.
  useEffect(() => {
    if (loading || !firebaseUser) return;
    const ping = () => {
      if (document.visibilityState === "hidden") return;
      apiClient.post("/api/v1/job-alerts/ensure-fresh").catch(() => {});
    };
    ping();
    document.addEventListener("visibilitychange", ping);
    return () => document.removeEventListener("visibilitychange", ping);
  }, [firebaseUser, loading]);

  // Live-updates the badges (including Shared with Me) when a foreground
  // push arrives, mirroring NotificationBell.tsx's identical
  // onForegroundMessage wiring (see that component for the full writeup) —
  // otherwise a new share/connection request/job alert etc. would only
  // show up here after a manual page refresh. Same !loading && firebaseUser
  // gate as the fetch-on-mount effect above, for the same 401-on-refresh
  // reason (see this file's BUG FIX comment further up).
  useEffect(() => {
    if (loading || !firebaseUser) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    onForegroundMessage(() => {
      fetchBadges((result) => {
        if (!cancelled) setBadges(result);
      });
    }).then((unsub) => {
      if (cancelled) unsub();
      else unsubscribe = unsub;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, loading]);

  // Admin feature flags: hide rows an admin has switched off.
  const [flagsTick, setFlagsTick] = useState(0);
  useEffect(() => {
    getAppConfig().then(() => setFlagsTick((n) => n + 1));
  }, []);
  const primaryNav = useMemo(
    () => filterNav(allPrimaryNav, (f) => isFeatureEnabled(f as never)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flagsTick]
  );

  return (
    // BUG FIX (product report: "I want the dashboard sidebar background to
    // be white not gray") -- was bg-surface-1 (#f6faf8, the pale mint-gray
    // task #45 already moved the main content area OFF of, onto bg-page).
    // Uses that same bg-page white token instead of a fresh surface-2
    // reference so the two stay in sync if `--page` is ever retuned. The
    // existing border-r border-border wrap around <Sidebar /> in
    // AppShell.tsx already gives it a visible edge against the (also now
    // white) main content, so this doesn't need its own border/shadow.
    <div className={`flex h-full flex-col bg-page transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-64"}`}>
      {/* Admin-console sidebar header: logo with brand glow, display-font
          wordmark, and a collapse toggle. */}
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-4">
        <Image
          src="/logo-badge.png"
          alt=""
          width={32}
          height={32}
          priority
          className="h-8 w-8 shrink-0 rounded-lg object-cover shadow-[0_8px_20px_-8px_rgba(39,115,238,0.55)]"
        />
        {!collapsed && (
          <span className="font-display truncate text-lg font-bold text-primary">
            Saveur<span className="text-brand">.</span>
          </span>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={t("web:shell.toggleSidebar", { defaultValue: "Toggle sidebar" })}
            className="ml-auto rounded p-1 text-hint hover:text-primary"
          >
            <EvaIcon name={collapsed ? "chevron-right-outline" : "chevron-left-outline"} size={18} />
          </button>
        )}
      </div>

      {/* data-tour anchor for AppTour.tsx's "sidebar-nav" step -- every real
          nav item lives inside this <nav>, so a single spotlight around the
          whole thing covers "the sidebar" as a feature area. */}
      <nav data-tour="sidebar-nav" className="scrollbar-hide flex-1 overflow-y-auto px-3 pt-4" onClick={onNavigate}>
        {!collapsed && (
          <div className="mb-1 px-3 text-[10px] uppercase tracking-[0.16em] text-hint/80">
            {t("web:shell.sectionMenu", { defaultValue: "Menu" })}
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {primaryNav.map((item, i) =>
            isNavGroup(item) ? (
              <NavGroupItem key={item.label} item={item} pathname={pathname} badges={badges} gradientIndex={i} collapsed={collapsed} />
            ) : (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label}
                active={pathname === item.href}
                badge={badgeCountFor(item.badgeKey, badges)}
                gradientIndex={i}
                collapsed={collapsed}
              />
            )
          )}
        </div>

        <div className="my-3 border-t border-border/60" />
        {!collapsed && (
          <div className="mb-1 px-3 text-[10px] uppercase tracking-[0.16em] text-hint/80">
            {t("web:shell.sectionAccount", { defaultValue: "Account" })}
          </div>
        )}
        <div className="flex flex-col gap-0.5 pb-4">
          {secondaryNav.map((item, i) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.labelKey ? t(`common:nav.${item.labelKey}`, { defaultValue: item.label }) : item.label}
              active={pathname === item.href}
              badge={badgeCountFor(item.badgeKey, badges)}
              gradientIndex={primaryNav.length + i}
              collapsed={collapsed}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-border/60 px-3 py-3">
        <LanguageMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
