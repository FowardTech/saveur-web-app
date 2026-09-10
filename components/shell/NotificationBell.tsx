"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  listNotifications,
  markNotificationsRead,
  notificationHref,
  type AppNotification,
} from "@/lib/notifications";

function relativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString();
}

/** Bell icon + dropdown Notification Center — replaces Topbar's old plain
 * link-to-/settings behavior (product request: real notification center +
 * web push, see Saveur-Backend/app/api/notifications.py). Fetches on mount
 * and again whenever the panel is opened, so a badge cleared elsewhere
 * (e.g. reading a job alert on /job-alerts) is reflected next open without
 * needing a full page reload. */
export function NotificationBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  async function load() {
    setLoading(true);
    try {
      const data = await listNotifications();
      setNotifications(data);
    } catch {
      // Fails soft — the bell just shows no badge / an empty panel rather
      // than breaking the topbar.
      setNotifications((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!firebaseUser) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  async function handleSelect(n: AppNotification) {
    setOpen(false);
    if (!n.read) {
      setNotifications((prev) => (prev ? prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)) : prev));
      markNotificationsRead([n.id]).catch(() => {});
    }
    const href = notificationHref(n);
    if (href) router.push(href);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={t("web:shell.notifications", { defaultValue: "Notifications" })}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-hint transition hover:bg-surface-3 hover:text-primary"
      >
        <EvaIcon name="bell-outline" size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-brand px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 max-h-96 w-80 overflow-y-auto rounded-card border border-border bg-surface-2 shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-primary">
              {t("web:notifications.title", { defaultValue: "Notifications" })}
            </h3>
            <Link
              href="/settings/security"
              onClick={() => setOpen(false)}
              className="text-xs text-hint transition hover:text-brand"
            >
              {t("web:notifications.manage", { defaultValue: "Manage" })}
            </Link>
          </div>

          {loading && !notifications && (
            <p className="px-4 py-6 text-center text-sm text-hint">
              {t("common:actions.loading", { defaultValue: "Loading…" })}
            </p>
          )}

          {notifications && notifications.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-hint">
              {t("web:notifications.empty", { defaultValue: "You're all caught up." })}
            </p>
          )}

          {notifications && notifications.length > 0 && (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(n)}
                    className={`flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-3 ${
                      n.read ? "" : "bg-brand/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm ${n.read ? "text-primary" : "font-semibold text-primary"}`}>{n.title}</span>
                      {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    </div>
                    <p className="line-clamp-2 text-xs text-hint">{n.message}</p>
                    <span className="mt-0.5 text-[11px] text-hint">{relativeTime(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
