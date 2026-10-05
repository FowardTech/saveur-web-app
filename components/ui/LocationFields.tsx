"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { COUNTRIES } from "@/lib/countries";
import { CITIES_BY_COUNTRY, CURRENCIES } from "@/lib/locations";

const selectClass =
  "w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10";

/** Splits "City, Country" (or "Country") against the known country list. */
export function splitLocation(value?: string | null): { country: string; city: string } {
  const v = (value ?? "").trim();
  if (!v) return { country: "", city: "" };
  const idx = v.lastIndexOf(",");
  if (idx >= 0) {
    const country = v.slice(idx + 1).trim();
    if (COUNTRIES.includes(country)) return { country, city: v.slice(0, idx).trim() };
  }
  return COUNTRIES.includes(v) ? { country: v, city: "" } : { country: "", city: "" };
}

interface LocationSelectProps {
  label: string;
  value: string;
  onChange: (location: string) => void;
  className?: string;
}

/** Country dropdown followed by a city dropdown; value is "City, Country". */
export function LocationSelect({ label, value, onChange, className = "" }: LocationSelectProps) {
  const { t } = useTranslation();
  const { country, city } = splitLocation(value);
  const cities = CITIES_BY_COUNTRY[country] ?? [];
  // A legacy free-text value that doesn't match the lists is shown as an extra option so it isn't lost.
  const legacy = value && !country ? value : "";
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-primary">{label}</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          aria-label={t("web:fields.country", { defaultValue: "Country" })}
          className={selectClass}
          value={country || (legacy ? "__legacy" : "")}
          onChange={(e) => (e.target.value === "__legacy" ? undefined : onChange(e.target.value))}
        >
          <option value="">{t("web:fields.selectCountry", { defaultValue: "Select country" })}</option>
          {legacy && <option value="__legacy">{legacy}</option>}
          {COUNTRIES.filter((c) => c !== "Remote - Anywhere").map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label={t("web:fields.city", { defaultValue: "City" })}
          className={selectClass}
          disabled={!country || cities.length === 0}
          value={city}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}, ${country}` : country)}
        >
          <option value="">{t("web:fields.selectCity", { defaultValue: "Select city (optional)" })}</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

interface CurrencySelectProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  optional?: boolean;
  className?: string;
}

export function CurrencySelect({ label, value, onChange, optional, className = "" }: CurrencySelectProps) {
  const { t } = useTranslation();
  const known = CURRENCIES.some((c) => c.code === value);
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-primary">{label}</span>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">
          {optional ? t("web:fields.anyCurrency", { defaultValue: "Any / local currency" }) : t("web:fields.selectCurrency", { defaultValue: "Select currency" })}
        </option>
        {value && !known && <option value={value}>{value}</option>}
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
        ))}
      </select>
    </label>
  );
}
