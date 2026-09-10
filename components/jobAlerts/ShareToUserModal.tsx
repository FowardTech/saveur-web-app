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
}

type LookupState = "idle" | "checking" | "found_connected" | "found_not_connected" | "request_sent" | "not_found";

export function ShareToUserModal({ open, onClose, contentType, contentId }: ShareToUserModalProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [banner, setBanner] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername("");
      setMessage("");
      setLookupState("idle");
      setBanner(null);
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

  if (!open) return null;

  const canSend = lookupState === "found_connected" && !isSending;
  const canRequest = lookupState === "found_not_connected" && !isRequesting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface-2 p-5 shadow-2xl">
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

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="sr-only">{t("web:jobAlerts.details.shareUsernamePlaceholder", { defaultValue: "their username" })}</span>
          <div className="relative">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={t("web:jobAlerts.details.shareUsernamePlaceholder", { defaultValue: "their username" })}
              className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 pr-9 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
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
              className="mb-3 w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
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

        {banner && (
          <p className={`mt-3 text-sm font-medium ${banner.tone === "success" ? "text-success-text" : banner.tone === "warning" ? "text-warning-text" : "text-danger"}`}>
            {banner.text}
          </p>
        )}
      </div>
    </div>
  );
}
