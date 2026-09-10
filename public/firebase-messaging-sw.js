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
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

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
