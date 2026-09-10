"use client";

import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/app/providers/AuthProvider";
import { LinkButton } from "@/components/ui/Button";

// No wordmark here — the Sidebar (visible on desktop, one tap away via the
// hamburger on mobile) is the app's single source of branding now, so this
// bar doesn't repeat "Saveur." next to it.

export function Topbar({ onMenuClick, showMenuButton = false }: { onMenuClick?: () => void; showMenuButton?: boolean }) {
  const { t } = useTranslation();
  const { firebaseUser, loading } = useAuth();
  const isSignedIn = !!firebaseUser;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface-2/80 px-4 backdrop-blur sm:px-6">
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
      </div>

      <div className="flex items-center gap-2">
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
            <NotificationBell />
            <UserMenu />
          </>
        )}
      </div>
    </header>
  );
}
