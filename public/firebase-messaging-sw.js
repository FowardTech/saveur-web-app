// Firebase Cloud Messaging background service worker — required for web
// push to deliver notifications while this tab isn't focused (or is
// closed). See lib/messaging.ts for the client-side half of this flow and
// lib/firebase.ts for where these same project values come from.
//
// This file is a plain static asset (not processed by Next.js/webpack), so
// it has no access to process.env — the two env-only values (apiKey, appId)
// are passed as query params on the registration URL in
// lib/messaging.ts's registerServiceWorker() and read back below via
// self.location.search. The other four values are stable/project-wide and
// safe to hardcode here identically to lib/firebase.ts's own fallbacks.
//
// BUG FIX (real root cause of push "not working" / not showing up when the
// tab is backgrounded, even after the service-worker-ready race fix):
// this pinned a firebase-messaging-compat build EIGHT MAJOR VERSIONS behind
// the actual `firebase` npm package this app builds against (package.json
// has "firebase": "^12.18.0" — see lib/messaging.ts/lib/firebase.ts, both of
// which resolve to the real installed v12.18.0 at build time; this file was
// still on v10.14.1 from whenever the CDN URL was first copied in). FCM's
// Web SDK shares state between the page context and this service worker via
// an IndexedDB database ("firebase-messaging-database") that both sides
// read/write to register+look up the push subscription/token — a version
// gap this large between the SDK generating the token (v12, in the page)
// and the SDK receiving/decrypting the push here (v10, in this worker) is a
// well-documented source of exactly this failure mode: getToken() succeeds
// and registration with the backend succeeds (so everything LOOKS wired up
// correctly), but this worker silently fails to correctly pick up incoming
// background pushes since it's reading that shared state with a different
// SDK generation's expectations. Pinned to the same 12.18.0 as package.json
// so both sides of the handshake agree.
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey") || "",
  authDomain: "saveur-ac8ec.firebaseapp.com",
  projectId: "saveur-ac8ec",
  storageBucket: "saveur-ac8ec.firebasestorage.app",
  messagingSenderId: "679326954548",
  appId: params.get("appId") || "",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Saveur";
  const body = payload.notification?.body || payload.data?.message || "";
  self.registration.showNotification(title, {
    body,
    icon: "/logo-badge.png",
    data: payload.data || {},
  });
});

// Mirrors mobile's push-tap routing (navigationRef.ts) in spirit — a tapped
// notification focuses/opens the app at a relevant URL when the payload's
// data carries one (see Saveur-Backend's push_service.py for what `data`
// includes per notification kind), falling back to the dashboard.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
