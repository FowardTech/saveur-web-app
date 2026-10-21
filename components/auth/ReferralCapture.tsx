"use client";

import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/referral";

/** Mounted once in the root layout so a `?ref=CODE` on ANY entry URL
 * (register, login, landing) is remembered until the account is created. */
export function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return null;
}
