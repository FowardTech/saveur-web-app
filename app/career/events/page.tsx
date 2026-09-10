"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Career Events used to be its own top-level page here. Per mobile's real
// structure (Saveur/src/more/NetworkingAssistant.tsx), Career Events is one
// of two pill tabs on a single "Networking Assistant" screen, not a
// standalone screen of its own -- merged into app/career/networking/page.tsx
// (Events is that page's default tab, index 0, matching
// NetworkingAssistant.tsx's own default activeIndex). This route stays as a
// redirect so any old bookmark/link to /career/events still lands somewhere
// useful instead of 404ing.
export default function CareerEventsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/career/networking?tab=events");
  }, [router]);
  return null;
}
