"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { getAppConfig } from "@/lib/appConfigService";

const FALLBACK_SUPPORT_EMAIL = "support@saveurnow.com";

interface FaqItem {
  question: string;
  answer: string;
}

// Turns "Take a look at our [help center] for ..." into text with the
// bracketed part rendered as a link. Brackets (not markup) keep the
// translated strings plain text, so word order can differ per language.
function withLink(text: string, link: (label: string) => ReactNode): ReactNode[] {
  return text.split(/(\[[^\]]+\])/g).map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <span key={i}>{link(part.slice(1, -1))}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const linkClass = "text-link underline underline-offset-2 hover:opacity-80";
const buttonClass =
  "inline-flex w-full items-center justify-center rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-600";

export default function SupportPage() {
  const { t, i18n } = useTranslation();
  const [faqs, setFaqs] = useState<FaqItem[] | null>(null);
  const [email, setEmail] = useState(FALLBACK_SUPPORT_EMAIL);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // The backend translates the admin-written FAQ/About text per language
  // (GET /content/config?language=xx), so refetch when the language changes.
  useEffect(() => {
    let cancelled = false;
    getAppConfig(i18n.language).then((cfg) => {
      if (cancelled) return;
      const items = (cfg.faq as { items?: FaqItem[] } | undefined)?.items;
      setFaqs(Array.isArray(items) ? items.filter((f) => f?.question && f?.answer) : []);
      const contact = (cfg.about as { contact_email?: string } | undefined)?.contact_email;
      if (contact) setEmail(contact);
    });
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  const scrollToFaq = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("faq")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-2 py-10">
        <h1 className="text-4xl font-bold text-primary">{t("web:support.title", { defaultValue: "Support" })}</h1>
        <p className="mt-3 text-base text-hint">
          {t("web:support.subtitle", {
            defaultValue:
              "You've got questions, we've got answers! Find what you need in the following resources or contact us directly.",
          })}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Help Center */}
          <section className="flex flex-col rounded-card border border-border bg-surface-2 p-8 shadow-soft">
            <h2 className="text-2xl font-bold text-primary">
              {t("web:support.helpCenter.title", { defaultValue: "Help Center" })}
            </h2>
            <p className="mt-5 text-lg leading-8 text-hint">
              {withLink(
                t("web:support.helpCenter.body", {
                  defaultValue: "Take a look at our [help center] for frequently asked questions.",
                }),
                (label) => (
                  <a href="#faq" onClick={scrollToFaq} className={linkClass}>
                    {label}
                  </a>
                ),
              )}
            </p>
            <div className="mt-auto pt-10">
              <a href="#faq" onClick={scrollToFaq} className={buttonClass}>
                {t("web:support.helpCenter.cta", { defaultValue: "Visit Help Center" })}
              </a>
            </div>
          </section>

          {/* Contact Us */}
          <section className="flex flex-col rounded-card border border-border bg-surface-2 p-8 shadow-soft">
            <h2 className="text-2xl font-bold text-primary">
              {t("web:support.contact.title", { defaultValue: "Contact Us" })}
            </h2>
            <p className="mt-5 text-lg leading-8 text-hint">
              {withLink(
                t("web:support.contact.body", {
                  defaultValue: "You can always email us at [{{email}}] for assistance.",
                  email,
                }),
                (label) => (
                  <a href={`mailto:${email}`} className={linkClass}>
                    {label}
                  </a>
                ),
              )}
            </p>
            <div className="mt-auto pt-10">
              <a href={`mailto:${email}`} className={buttonClass}>
                {t("web:support.contact.cta", { defaultValue: "Contact Us" })}
              </a>
            </div>
          </section>
        </div>

        {/* FAQ (the Help Center) */}
        <section id="faq" className="mt-14 scroll-mt-6">
          <h2 className="text-2xl font-bold text-primary">
            {t("web:support.faq.title", { defaultValue: "Frequently asked questions" })}
          </h2>

          {faqs === null ? (
            <p className="mt-4 text-sm text-hint">{t("web:support.faq.loading", { defaultValue: "Loading…" })}</p>
          ) : faqs.length === 0 ? (
            <p className="mt-4 text-sm text-hint">
              {t("web:support.faq.empty", {
                defaultValue: "Answers aren't available right now. Please email us and we'll help.",
              })}
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-2">
              {faqs.map((item, i) => {
                const open = openIndex === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenIndex(open ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-start transition hover:bg-surface-1"
                    >
                      <span className="text-base font-semibold text-primary">{item.question}</span>
                      <span className={`shrink-0 text-hint transition-transform ${open ? "rotate-180" : ""}`}>
                        <EvaIcon name="chevron-down-outline" size={20} />
                      </span>
                    </button>
                    {open && <p className="px-6 pb-5 text-base leading-7 text-hint">{item.answer}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
