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
    return await navigator.serviceWorker.register(url);
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
