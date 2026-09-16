"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** Sidebar (left) + Topbar (top) shell for every authenticated route, e.g.
 * /dashboard, /subscription. Sidebar is fixed on desktop (lg+) and becomes a
 * slide-over drawer on smaller screens, toggled from the Topbar's hamburger. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Product request: "I see a lot of animations that connect ... from the
  // app dashboard to every part of the app and back ... why is ours not
  // like that?" -- one shared entrance transition (see globals.css's
  // .animate-page-in) applied here, the single choke point every
  // authenticated page's content already passes through as `children`.
  // Keyed by pathname so React remounts (and therefore re-plays the CSS
  // animation on) this wrapper on every navigation -- this is what makes
  // the motion a real connective thread between the dashboard and every
  // other screen, rather than a one-off effect on a single page.
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:shrink-0 lg:border-r lg:border-border">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 border-r border-border shadow-xl">
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t("web:shell.closeMenu", { defaultValue: "Close menu" })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hint hover:bg-surface-3"
              >
                <EvaIcon name="close-outline" size={18} />
              </button>
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar showMenuButton onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 bg-page px-4 py-6 sm:px-6 lg:px-8">
          <div key={pathname} className="animate-page-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
