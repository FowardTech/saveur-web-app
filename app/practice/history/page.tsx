"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Recent Interviews used to be its own top-level page here. Per mobile's
// real structure (Saveur/src/requests/RequestsSrc.tsx), Practice History is
// one of two pill tabs on a single "Interviews" screen (Applications is the
// other) -- merged into app/applications/page.tsx, which is now the
// canonical route for both. Kept as a redirect so any old bookmark/link to
// /practice/history still lands somewhere useful instead of 404ing.
export default function PracticeHistoryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/applications?tab=history");
  }, [router]);
  return null;
}
