"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { primaryNav, secondaryNav, isNavGroup } from "@/lib/navigation";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { SiteSearch } from "./SiteSearch";
import { useAuth } from "@/app/providers/AuthProvider";
import { LinkButton } from "@/components/ui/Button";

// No wordmark here — the Sidebar (visible on desktop, one tap away via the
// hamburger on mobile) is the app's single source of branding now, so this
// bar doesn't repeat "Saveur." next to it.

export function Topbar({
  onMenuClick,
  showMenuButton = false,
  showTitle = false,
}: {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  /** Admin-console style page title (eyebrow + title) on the left. */
  showTitle?: boolean;
}) {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "";
  // Resolve the current page's nav label (and its group, as the eyebrow) from
  // the same nav tree the Sidebar renders, longest matching href wins.
  const current = useMemo(() => {
    let best: { label: string; labelKey?: string; group?: string; groupKey?: string; len: number } | null = null;
    const consider = (item: { label: string; labelKey?: string; href: string }, group?: { label: string; labelKey?: string }) => {
      const base = item.href.split("?")[0];
      if ((pathname === base || pathname.startsWith(base + "/")) && (!best || base.length > best.len)) {
        best = { label: item.label, labelKey: item.labelKey, group: group?.label, groupKey: group?.labelKey, len: base.length };
      }
    };
    for (const item of [...primaryNav, ...secondaryNav]) {
      if (isNavGroup(item)) item.children.forEach((c) => consider(c, item));
      else consider(item);
    }
    return best as { label: string; labelKey?: string; group?: string; groupKey?: string } | null;
  }, [pathname]);
  const pageTitle = current ? (current.labelKey ? t(`common:nav.${current.labelKey}`, { defaultValue: current.label }) : current.label) : "";
  const eyebrow = current?.group
    ? current.groupKey
      ? t(`common:nav.${current.groupKey}`, { defaultValue: current.group })
      : current.group
    : "Saveur";
  const { firebaseUser, loading } = useAuth();
  const isSignedIn = !!firebaseUser;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/70 bg-page/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label={t("web:shell.toggleSidebar", { defaultValue: "Toggle sidebar" })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-surface-3 lg:hidden"
          >
            <EvaIcon name="menu-outline" size={20} />
          </button>
        )}
        {showTitle && pageTitle && (
          <div className="hidden min-w-0 md:block">
            <div className="text-[10px] uppercase tracking-[0.22em] text-hint">{eyebrow}</div>
            <div className="font-display truncate text-lg font-bold leading-none text-primary">{pageTitle}</div>
          </div>
        )}
      </div>

      {/* data-tour anchors for AppTour.tsx (product report: "The tour guide
          ... did not even point out the features in the sidebar and the
          navbar") -- SiteSearch is hidden below the `sm` breakpoint, same
          as here, so its tour step auto-skips on narrow viewports the same
          way AppTour.tsx already skips any step whose target has zero
          size; NotificationBell/UserMenu are always visible when signed
          in, so those two steps are reliable on every viewport. */}
      {!loading && isSignedIn && (
        <div data-tour="navbar-search" className="hidden flex-1 justify-center sm:flex">
          <SiteSearch />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
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
