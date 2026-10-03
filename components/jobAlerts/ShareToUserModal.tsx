"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import * as sharesService from "@/lib/sharesService";
import type { SharedContentType } from "@/lib/sharesService";
import type { ApiError } from "@/lib/apiClient";

// Web port of Saveur (mobile)'s components/ShareToUserModal.tsx — see
// lib/sharesService.ts's own header comment for why this is full parity
// (a plain REST contract, not a mobile-only push/deep-link mechanism) and
// not a simplified "copy a link" stand-in. Same bottom-sheet-style
// interaction, same connection-required-before-sharing flow (product
// request: "Before a user can share something with another Saveur user
// they must send a request first and until the other person accept it
// then they can now be able to send or share with that user"), same
// lookupState machine mobile's version uses.
interface ShareToUserModalProps {
  open: boolean;
  onClose: () => void;
  contentType: SharedContentType;
  contentId: string | number;
  /** When provided, shows a "Copy public link" action for people who are not on Saveur. */
  getPublicLink?: () => Promise<string>;
}

type LookupState = "idle" | "checking" | "found_connected" | "found_not_connected" | "request_sent" | "not_found";

export function ShareToUserModal({ open, onClose, contentType, contentId, getPublicLink }: ShareToUserModalProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [banner, setBanner] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);
  // Accepted connections to pick from (select one / select all) so the user
  // doesn't have to type usernames for people they're already connected to.
  const [connections, setConnections] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    sharesService.listConnections().then((list) => {
      if (!cancelled) setConnections(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername("");
      setMessage("");
      setLookupState("idle");
      setBanner(null);
      setSelected([]);
      setLinkCopied(false);
    }
  }, [open]);

  useEffect(() => {
    const candidate = username.trim();
    if (!candidate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookupState("idle");
      return;
    }
    setLookupState("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await sharesService.checkRecipientExists(candidate);
      if (cancelled) return;
      if (!result.exists) setLookupState("not_found");
      else setLookupState(result.connected ? "found_connected" : "found_not_connected");
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  function errorMessage(code?: string): string {
    switch (code) {
      case "recipient_not_found":
        return t("web:jobAlerts.details.shareUserNotFound", { defaultValue: "No Saveur user found with that username." });
      case "cannot_share_with_self":
        return t("web:jobAlerts.details.shareCannotShareSelf", { defaultValue: "You can't share with yourself." });
      case "not_connected":
        return t("web:jobAlerts.details.shareNotConnected", { defaultValue: "Send a connection request first — they need to accept before you can share." });
      case "already_connected":
        return t("web:jobAlerts.details.shareAlreadyConnected", { defaultValue: "You're already connected with this user." });
      case "request_already_sent":
        return t("web:jobAlerts.details.shareRequestAlreadySent", { defaultValue: "You've already sent a request to this user." });
      default:
        return t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." });
    }
  }

  async function onSendRequest() {
    const candidate = username.trim();
    if (!candidate || isRequesting) return;
    setIsRequesting(true);
    setBanner(null);
    try {
      const result = await sharesService.sendConnectionRequest(candidate);
      if (result.autoAccepted) {
        setLookupState("found_connected");
        setBanner({ tone: "success", text: t("web:jobAlerts.details.shareConnectedBody", { defaultValue: "You and @{{username}} can now share with each other.", username: candidate }) });
      } else {
        setLookupState("request_sent");
        setBanner({ tone: "success", text: t("web:jobAlerts.details.shareRequestSentBody", { defaultValue: "@{{username}} needs to accept before you can share with them.", username: candidate }) });
      }
    } catch (e) {
      const code = (e as ApiError).error;
      if (code === "request_already_sent") setLookupState("request_sent");
      if (code === "already_connected") setLookupState("found_connected");
      setBanner({ tone: "danger", text: errorMessage(code) });
    } finally {
      setIsRequesting(false);
    }
  }

  async function onSend() {
    const candidate = username.trim();
    if (!candidate || isSending) return;
    setIsSending(true);
    setBanner(null);
    try {
      await sharesService.shareContent({ recipientUsername: candidate, contentType, contentId, message: message.trim() || undefined });
      setBanner({ tone: "success", text: t("web:jobAlerts.details.shareSentBody", { defaultValue: "@{{username}} will be notified.", username: candidate }) });
      setTimeout(onClose, 1200);
    } catch (e) {
      const code = (e as ApiError).error;
      if (code === "not_connected") setLookupState("found_not_connected");
      setBanner({ tone: "danger", text: errorMessage(code) });
    } finally {
      setIsSending(false);
    }
  }

  const allSelected = connections.length > 0 && selected.length === connections.length;
  function toggle(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  async function onSendSelected() {
    if (selected.length === 0 || isSending) return;
    setIsSending(true);
    setBanner(null);
    let ok = 0;
    for (const name of selected) {
      try {
        await sharesService.shareContent({ recipientUsername: name, contentType, contentId, message: message.trim() || undefined });
        ok += 1;
      } catch {
        // counted below
      }
    }
    setIsSending(false);
    if (ok === selected.length) {
      setBanner({ tone: "success", text: t("web:share.sentToCount", { defaultValue: "Sent to {{count}} user(s).", count: ok }) });
      setTimeout(onClose, 1200);
    } else {
      setBanner({ tone: "danger", text: t("web:share.sentPartial", { defaultValue: "Sent to {{ok}} of {{total}}. Please try the rest again.", ok, total: selected.length }) });
    }
  }

  async function onCopyPublicLink() {
    if (!getPublicLink) return;
    try {
      const url = await getPublicLink();
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setBanner({ tone: "success", text: t("web:share.linkCopiedBody", { defaultValue: "Public link copied — anyone with it can view (not edit) this project." }) });
    } catch {
      setBanner({ tone: "danger", text: t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." }) });
    }
  }

  if (!open) return null;

  const canSend = lookupState === "found_connected" && !isSending;
  const canRequest = lookupState === "found_not_connected" && !isRequesting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-card border border-border bg-surface-2 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-primary">{t("web:jobAlerts.details.shareToSaveurUser", { defaultValue: "Share with a Saveur user" })}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common:actions.close", { defaultValue: "Close" })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hint hover:bg-surface-3"
          >
            <EvaIcon name="close-outline" size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-hint">
          {t("web:jobAlerts.details.shareToSaveurUserDescription", { defaultValue: "Send this to another Saveur user by their username — they'll get a notification." })}
        </p>

        {connections.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-hint">
                {t("web:share.yourConnections", { defaultValue: "Your connections" })}
              </span>
              <button
                type="button"
                onClick={() => setSelected(allSelected ? [] : connections)}
                className="text-xs font-medium text-brand hover:underline"
              >
                {allSelected ? t("web:share.clearAll", { defaultValue: "Clear" }) : t("web:share.selectAll", { defaultValue: "Select all" })}
              </button>
            </div>
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface-1 p-2">
              {connections.map((name) => (
                <label key={name} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-primary hover:bg-surface-3">
                  <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} className="h-4 w-4 accent-primary" />
                  @{name}
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("web:jobAlerts.details.shareMessagePlaceholder", { defaultValue: "Add a note (optional)" })}
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2 text-sm text-primary placeholder:text-hint focus:border-primary focus:outline-none"
                />
                <Button type="button" onClick={onSendSelected} disabled={isSending} className="mt-2 w-full justify-center">
                  {t("web:share.sendToSelected", { defaultValue: "Send to {{count}} selected", count: selected.length })}
                </Button>
              </>
            )}
            <p className="mt-3 text-xs text-hint">{t("web:share.orAddNew", { defaultValue: "Or connect with someone new by username:" })}</p>
          </div>
        )}

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="sr-only">{t("web:jobAlerts.details.shareUsernamePlaceholder", { defaultValue: "their username" })}</span>
          <div className="relative">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={t("web:jobAlerts.details.shareUsernamePlaceholder", { defaultValue: "their username" })}
              className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 pr-9 text-sm text-primary placeholder:text-hint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {lookupState === "checking" && <span className="block h-4 w-4 animate-spin rounded-full border-2 border-hint border-t-transparent" />}
              {lookupState === "found_connected" && <EvaIcon name="checkmark-circle-2-outline" size={18} className="text-success-text" />}
              {(lookupState === "found_not_connected" || lookupState === "request_sent") && <EvaIcon name="people-outline" size={18} className="text-warning-text" />}
              {lookupState === "not_found" && <EvaIcon name="close-circle-outline" size={18} className="text-danger" />}
            </span>
          </div>
        </label>

        {lookupState === "not_found" && (
          <p className="mb-3 text-xs text-danger">{t("web:jobAlerts.details.shareUserNotFound", { defaultValue: "No Saveur user found with that username." })}</p>
        )}
        {lookupState === "found_not_connected" && (
          <p className="mb-3 text-xs text-warning-text">{t("web:jobAlerts.details.shareNotConnectedHint", { defaultValue: "Send a connection request first — they need to accept before you can share." })}</p>
        )}
        {lookupState === "request_sent" && (
          <p className="mb-3 text-xs text-warning-text">{t("web:jobAlerts.details.shareRequestPendingHint", { defaultValue: "Request sent — waiting for them to accept." })}</p>
        )}

        {lookupState === "found_connected" ? (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("web:jobAlerts.details.shareMessagePlaceholder", { defaultValue: "Add a note (optional)" })}
              rows={3}
              className="mb-3 w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            <Button type="button" onClick={onSend} disabled={!canSend} className="w-full justify-center">
              {isSending ? `${t("web:jobAlerts.details.shareSend", { defaultValue: "Send" })}…` : t("web:jobAlerts.details.shareSend", { defaultValue: "Send" })}
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={onSendRequest} disabled={!canRequest} className="w-full justify-center">
            {lookupState === "request_sent"
              ? t("web:jobAlerts.details.shareRequestPending", { defaultValue: "Request pending" })
              : isRequesting
              ? `${t("web:jobAlerts.details.shareSendRequest", { defaultValue: "Send connection request" })}…`
              : t("web:jobAlerts.details.shareSendRequest", { defaultValue: "Send connection request" })}
          </Button>
        )}

        {getPublicLink && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs text-hint">{t("web:share.externalHint", { defaultValue: "Sharing with someone who isn't on Saveur? Create a read-only link." })}</p>
            <Button type="button" variant="secondary" onClick={onCopyPublicLink} className="w-full justify-center">
              {linkCopied ? t("web:share.linkCopied", { defaultValue: "Link copied" }) : t("web:share.copyPublicLink", { defaultValue: "Copy public link" })}
            </Button>
          </div>
        )}

        {banner && (
          <p className={`mt-3 text-sm font-medium ${banner.tone === "success" ? "text-success-text" : banner.tone === "warning" ? "text-warning-text" : "text-danger"}`}>
            {banner.text}
          </p>
        )}
      </div>
    </div>
  );
}
