"use client";

import { firebaseApp } from "./firebase";
import { registerDeviceToken } from "./notifications";

// Real web push, via Firebase Cloud Messaging's Web Push (firebase/messaging
// JS SDK) — the web equivalent of mobile's @react-native-firebase/messaging
// (see services/pushNotificationService.ts on that side). Needs a VAPID key
// from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push
// certificates, which does NOT exist in this project's env yet. Every
// function below no-ops gracefully (returns a typed "not-configured"
// reason) when NEXT_PUBLIC_FIREBASE_VAPID_KEY is unset, so the rest of the
// app (and the Settings UI built on top of this) works fine without it —
// this one new env var is what's required before push actually delivers
// end to end.
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const isPushConfigured = !!VAPID_KEY;

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
  // The service worker is a plain static file (public/firebase-messaging-
  // sw.js) with no access to process.env at request time, so the two
  // env-only Firebase values (apiKey, appId — see lib/firebase.ts's own
  // comment on why those two specifically aren't hardcoded) are passed as
  // query params on the registration URL; the worker reads them back off
  // `self.location.search`. The four project-wide values are hardcoded
  // identically in both places since they're stable and safe to.
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "";
  const url = `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(apiKey)}&appId=${encodeURIComponent(appId)}`;
  try {
    const registration = await navigator.serviceWorker.register(url);
    // BUG FIX (the real, concrete cause of the generic "Couldn't enable
    // push notifications right now" failure): navigator.serviceWorker
    // .register() resolves as soon as the registration OBJECT exists, not
    // once the worker has actually finished installing and become active.
    // On a genuinely first-ever visit to this browser (nothing previously
    // registered at this scope — exactly the case a user clicking "Enable
    // browser push" for the first time hits), the returned registration can
    // still be `installing` when this function returns it. getToken() below
    // is called with this exact registration passed in explicitly via
    // `serviceWorkerRegistration` — per Firebase's own contract, giving it
    // your own registration means it does NOT wait for that registration to
    // become active before calling registration.pushManager.subscribe()
    // internally (it only auto-waits for `navigator.serviceWorker.ready`
    // when you DON'T pass one and let it self-register). Chrome's
    // PushManager requires an ACTIVE service worker to subscribe — calling
    // it against one still installing throws (surfaces here as getToken()
    // rejecting, e.g. with "AbortError: Registration failed - push service
    // error" or similar), which is exactly the generic reason: "error" path
    // enableWebPush() below falls into. Awaiting `ready` closes that race —
    // it resolves once a service worker at this scope is active, and
    // resolves near-instantly on every later visit where it's already
    // active, so this costs nothing once installed.
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn("[messaging] service worker registration failed", err);
    return undefined;
  }
}

export type EnablePushReason = "unsupported" | "not-configured" | "permission-denied" | "error";
export interface EnablePushResult {
  ok: boolean;
  reason?: EnablePushReason;
}

/** Requests browser notification permission, registers the FCM service
 * worker, fetches a device token, and hands it to
 * POST /api/v1/notifications/device-token — the same endpoint mobile's
 * registerDeviceToken() call hits after messaging().getToken(). Call this
 * from an explicit user action (a Settings toggle/button), never on page
 * load — Notification.requestPermission() must be triggered by a user
 * gesture in most browsers anyway. */
export async function enableWebPush(): Promise<EnablePushResult> {
  if (!VAPID_KEY) return { ok: false, reason: "not-configured" };
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const { isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return { ok: false, reason: "unsupported" };
  } catch {
    return { ok: false, reason: "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission-denied" };

  try {
    const registration = await registerServiceWorker();
    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: "error" };
    await registerDeviceToken(token, "web");
    return { ok: true };
  } catch (err) {
    console.warn("[messaging] enableWebPush failed", err);
    return { ok: false, reason: "error" };
  }
}

export function currentNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** BUG FIX (product report: the notification bell/badge doesn't update live
 * when a push arrives while the app is open — only after a manual page
 * refresh). Firebase's `onMessage` only ever fires for FOREGROUND
 * messages (a background/killed tab instead gets a real OS notification via
 * public/firebase-messaging-sw.js's own onBackgroundMessage) — this is the
 * missing foreground counterpart, and the piece components/shell/
 * NotificationBell.tsx was missing entirely: it only ever fetched once on
 * mount/open, with nothing to tell it a new notification had just arrived.
 *
 * Deliberately push-driven rather than a polling interval — this app
 * already has real, working FCM web push (see enableWebPush above), so a
 * poll-every-N-seconds fallback would just be redundant network traffic for
 * users who already grant notification permission, and still-invisible-
 * until-refresh for the users the bell most wants to update live is exactly
 * what real-time push already solves. Callers get a plain callback (not the
 * raw payload) since every current caller just wants to know "something
 * changed, refetch" rather than parse the message itself.
 *
 * No-ops (resolves to a no-op unsubscribe) when messaging isn't supported in
 * this browser, or when getMessaging()/onMessage() throws for any reason
 * (e.g. Firebase not configured) — same fail-soft contract as the rest of
 * this module. Safe to call unconditionally, independent of whether this
 * user has ever enabled push (an onMessage listener with no messages ever
 * arriving is a harmless no-op, not an error).
 */
export async function onForegroundMessage(callback: () => void): Promise<() => void> {
  if (typeof window === "undefined" || !("Notification" in window)) return () => {};
  try {
    const { isSupported, getMessaging, onMessage } = await import("firebase/messaging");
    if (!(await isSupported())) return () => {};
    const messaging = getMessaging(firebaseApp);
    return onMessage(messaging, () => callback());
  } catch (err) {
    console.warn("[messaging] onForegroundMessage failed to attach", err);
    return () => {};
  }
}
