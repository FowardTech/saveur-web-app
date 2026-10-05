"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { COUNTRIES } from "@/lib/countries";
import { CITIES_BY_COUNTRY, CURRENCIES } from "@/lib/locations";
import { searchPlaces, type PlaceResult } from "@/lib/placesService";

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
        <CityCombobox
          country={country}
          city={city}
          disabled={!country}
          localCities={cities}
          onPick={(c) => onChange(c ? `${c}, ${country}` : country)}
        />
      </div>
    </div>
  );
}

/** Searchable city/town field: curated hubs show instantly, and typing 2+ letters
 * also searches every town and village worldwide (limited to the chosen country).
 * Anything typed can be used as-is if it isn't found. */
function CityCombobox({ country, city, disabled, localCities, onPick }: {
  country: string;
  city: string;
  disabled: boolean;
  localCities: string[];
  onPick: (city: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState(city);
  const [remote, setRemote] = React.useState<PlaceResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setQ(city), [city, country]);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  React.useEffect(() => {
    const term = q.trim();
    if (!open || !country || term.length < 2 || term === city) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(async () => {
      const res = await searchPlaces(term, country);
      if (!cancelled) {
        setRemote(res);
        setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, open, country, city]);

  const term = q.trim().toLowerCase();
  const local = (term && term !== city.toLowerCase() ? localCities.filter((c) => c.toLowerCase().includes(term)) : localCities).slice(0, 12);
  const extra = remote.filter((p) => !local.some((l) => l.toLowerCase() === p.name.toLowerCase()));
  const pick = (c: string) => {
    setQ(c);
    setOpen(false);
    onPick(c);
  };
  const showUseTyped = term.length >= 2 && !local.some((l) => l.toLowerCase() === term) && !extra.some((p) => p.label.toLowerCase() === term);

  return (
    <div ref={boxRef} className="relative">
      <input
        aria-label={t("web:fields.city", { defaultValue: "City" })}
        className={selectClass}
        disabled={disabled}
        value={q}
        placeholder={t("web:fields.searchCity", { defaultValue: "Search city or town (optional)" })}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (!e.target.value) onPick("");
        }}
        autoComplete="off"
      />
      {open && !disabled && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface-2 p-1 shadow-soft">
          {local.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => pick(c)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-surface-3">
                {c}
              </button>
            </li>
          ))}
          {extra.map((p) => (
            <li key={p.full}>
              <button type="button" onClick={() => pick(p.label)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-surface-3">
                {p.name}
                {p.region && p.region !== p.name && <span className="text-hint">, {p.region}</span>}
              </button>
            </li>
          ))}
          {loading && <li className="px-3 py-2 text-xs text-hint">{t("web:fields.searching", { defaultValue: "Searching…" })}</li>}
          {showUseTyped && (
            <li>
              <button type="button" onClick={() => pick(q.trim())} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-link hover:bg-surface-3">
                {t("web:fields.useTyped", { defaultValue: "Use \"{{city}}\"", city: q.trim() })}
              </button>
            </li>
          )}
        </ul>
      )}
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
