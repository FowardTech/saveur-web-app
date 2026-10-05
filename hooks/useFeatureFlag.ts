"use client";

import { useEffect, useState } from "react";
import { getAppConfig, isFeatureEnabled, type FeatureFlags } from "@/lib/appConfigService";

/** Reactive admin feature flag: true until the config loads (fail open, like
 * the rest of the app), then follows Admin > Config > Feature flags. */
export function useFeatureFlag(key: keyof FeatureFlags): boolean {
  const [, setTick] = useState(0);
  useEffect(() => {
    getAppConfig().then(() => setTick((n) => n + 1));
  }, []);
  return isFeatureEnabled(key);
}
