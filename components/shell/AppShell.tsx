"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** Indeed-style shell for every authenticated route: a top navigation bar
 * (components/shell/TopNav.tsx) over the page content. On small screens the
 * Sidebar component is the slide-over drawer opened from the hamburger. */
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
    <div className="flex min-h-screen flex-col">
      {/* Mobile drawer (the desktop sidebar is replaced by the Indeed-style
          top navigation). */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 border-r border-border shadow-sm">
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

      <TopNav onMenuClick={() => setMobileOpen(true)} />
      <main className="page-wash flex-1 bg-page px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div key={pathname} className="animate-page-in mx-auto w-full max-w-[1400px]">
          {children}
        </div>
      </main>
      <footer className="flex items-center justify-between border-t border-border bg-page px-4 py-4 text-xs text-hint sm:px-6 lg:px-8">
        <span>{t("web:shell.footer", { defaultValue: "Saveur · AI career coaching" })} · {new Date().getFullYear()}</span>
        <Link href="/support" className="hover:text-primary">
          {t("web:shell.footerSupport", { defaultValue: "Help & support" })}
        </Link>
      </footer>
    </div>
  );
}
