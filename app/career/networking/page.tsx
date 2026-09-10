"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

// Web counterpart to Saveur/src/more/NetworkingAssistant.tsx: ONE screen
// with a pill tab bar switching between "Career Events" (index 0, default)
// and "Your Contacts" (index 1) -- see that file's own comment for the
// product-request history ("we need to separate the career Events and the
// Your contacts into separate tabs"). Used to be two unrelated web pages:
// app/career/events/page.tsx (a real, working Career Events list -- kept
// verbatim below as the Events tab) and this file, which was ONLY the
// AI outreach-message-generator form (POST /api/v1/networking/message)
// with no contact to attach it to -- not the "Your Contacts" list/CRUD
// feature at all. Per services/networkingService.ts, the real "Your
// Contacts" tracker (list/add/edit/delete, mark-contacted-today) has no
// backend endpoint of its own either -- only message generation is a real
// API call -- so mobile keeps it local, seeded empty and persisted to
// AsyncStorage. This does the same with localStorage, scoped per uid so a
// shared browser doesn't leak one account's contacts into another's.
//
// Both tabs' data loads start on mount regardless of which tab is active
// (mirrors NetworkingAssistant.tsx lifting both loadEvents/loadContacts to
// the parent, not lazily inside each tab) -- among other things this means
// the single @require_pro gate on GET /api/v1/career-events (mirroring
// mobile's one `if (!isPro) return <ProLockGate .../>` covering the whole
// screen, not per-tab) still locks the whole page, not just Events.
type Tab = "events" | "contacts";

interface CareerEvent {
  id: string;
  title: string;
  organizer?: string;
  location?: string;
  matched_country?: string;
  matched_role?: string;
  url: string;
  source?: string;
  logo_url?: string;
  event_date?: string;
  created_at: string;
  read: boolean;
  saved?: boolean;
}

interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  note?: string;
  lastContactedDate: number | null;
}

type MessageTone = "friendly" | "formal" | "enthusiastic" | "warm";
const MESSAGE_TONES: { id: MessageTone; label: string }[] = [
  { id: "friendly", label: "Friendly" },
  { id: "formal", label: "Formal" },
  { id: "enthusiastic", label: "Enthusiastic" },
  { id: "warm", label: "Warm" },
];

function contactsStorageKey(uid?: string | null) {
  return `saveur:networkingContacts:${uid ?? "anon"}`;
}

function readContacts(uid?: string | null): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(contactsStorageKey(uid));
    return raw ? (JSON.parse(raw) as Contact[]) : [];
  } catch {
    return [];
  }
}

function writeContacts(uid: string | null | undefined, contacts: Contact[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(contactsStorageKey(uid), JSON.stringify(contacts));
  } catch {
    // Storage full/unavailable (private browsing, etc.) -- same
    // best-effort tolerance mobile's own AsyncStorage writes get.
  }
}

function formatEventDate(iso?: string) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const emptyForm = { name: "", company: "", role: "", note: "" };

function NetworkingAssistantInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser, loading: authLoading } = useAuth();
  const uid = firebaseUser?.uid;

  const tabParam = searchParams?.get("tab");
  const tab: Tab = tabParam === "contacts" ? "contacts" : "events";
  function setTab(next: Tab) {
    const qs = next === "contacts" ? "?tab=contacts" : "";
    router.replace(`/career/networking${qs}`);
  }

  // ---- Career Events (identical contract/behavior to the old
  // app/career/events/page.tsx, just lifted here so its unread count can
  // feed the tab pill's badge, one level above either tab's own content --
  // same reason NetworkingAssistant.tsx's own comment gives). ----
  const [events, setEvents] = useState<CareerEvent[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [refreshingEvents, setRefreshingEvents] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);

  async function loadEvents() {
    try {
      const data = await apiClient.get<{ data: CareerEvent[] }>("/api/v1/career-events");
      setEvents(data.data);
      const unreadIds = data.data.filter((e) => !e.read).map((e) => e.id);
      if (unreadIds.length) {
        apiClient.post("/api/v1/career-events/read", { ids: unreadIds }).catch(() => {});
        setEvents((prev) => (prev ? prev.map((e) => ({ ...e, read: true })) : prev));
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setEventsError(apiErr.message || t("web:career.events.loadFailedDefault", { defaultValue: "Couldn't load career events." }));
      }
    }
  }

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  async function handleRefreshEvents() {
    setRefreshingEvents(true);
    setEventsError(null);
    setRefreshMessage(null);
    try {
      const data = await apiClient.post<{ ok: boolean; status: string; message?: string }>("/api/v1/career-events/refresh");
      if (data.message) setRefreshMessage(data.message);
      await loadEvents();
    } catch (err) {
      setEventsError((err as ApiError).message || t("web:career.events.refreshFailedDefault", { defaultValue: "Couldn't refresh events right now." }));
    } finally {
      setRefreshingEvents(false);
    }
  }

  async function handleToggleSaveEvent(ev: CareerEvent) {
    setSavingEventId(ev.id);
    try {
      const updated = await apiClient.post<CareerEvent>(`/api/v1/career-events/${ev.id}/save`, { saved: !ev.saved });
      setEvents((prev) => (prev ? prev.map((e) => (e.id === ev.id ? updated : e)) : prev));
    } catch (err) {
      setEventsError((err as ApiError).message || t("web:career.events.saveFailedDefault", { defaultValue: "Couldn't update that event right now." }));
    } finally {
      setSavingEventId(null);
    }
  }

  const unreadEventsCount = useMemo(() => (events ?? []).filter((e) => !e.read).length, [events]);

  // ---- Your Contacts ----
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContacts(readContacts(uid).sort((a, b) => Number(b.lastContactedDate ?? 0) - Number(a.lastContactedDate ?? 0)));
  }, [uid]);

  function persistContacts(next: Contact[]) {
    setContacts(next);
    writeContacts(uid, next);
  }

  function onOpenAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  }
  function onOpenEdit(contact: Contact) {
    setEditingId(contact.id);
    setForm({ name: contact.name, company: contact.company, role: contact.role, note: contact.note ?? "" });
    setIsFormOpen(true);
  }
  function onCancelForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }
  function onSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const current = contacts ?? [];
    if (editingId != null) {
      persistContacts(current.map((c) => (c.id === editingId ? { ...c, ...form } : c)));
    } else {
      const created: Contact = { ...form, id: `contact_${Date.now()}`, lastContactedDate: null };
      persistContacts([created, ...current]);
    }
    onCancelForm();
  }
  function onDeleteContact(id: string) {
    persistContacts((contacts ?? []).filter((c) => c.id !== id));
    if (messageContactId === id) onCloseGenerateMessage();
  }
  function onMarkContactedToday(contact: Contact) {
    persistContacts((contacts ?? []).map((c) => (c.id === contact.id ? { ...c, lastContactedDate: Date.now() } : c)));
  }

  // "Generate Message" panel -- one contact's at a time, same as mobile.
  const [messageContactId, setMessageContactId] = useState<string | null>(null);
  const [messageContext, setMessageContext] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("friendly");
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [generateMessageError, setGenerateMessageError] = useState<string | null>(null);

  function onOpenGenerateMessage(contact: Contact) {
    setMessageContactId(contact.id);
    setMessageContext(
      contact.note?.trim()
        ? contact.note
        : t("web:career.networking.defaultOutreachContext", {
            defaultValue: "Reaching out to {{name}} at {{company}} about the {{role}} team.",
            name: contact.name,
            company: contact.company,
            role: contact.role,
          })
    );
    setMessageTone("friendly");
    setGeneratedMessage(null);
    setGenerateMessageError(null);
  }
  function onCloseGenerateMessage() {
    setMessageContactId(null);
    setGeneratedMessage(null);
    setGenerateMessageError(null);
  }
  async function onGenerateMessage(contact: Contact) {
    if (isGeneratingMessage) return;
    setIsGeneratingMessage(true);
    setGenerateMessageError(null);
    try {
      const data = await apiClient.post<{ message: string }>("/api/v1/networking/message", {
        recipient_role: contact.role,
        context: messageContext.trim(),
        tone: messageTone,
      });
      setGeneratedMessage(data.message);
    } catch (err) {
      const apiErr = err as ApiError;
      setGenerateMessageError(
        apiErr.status === 402 || apiErr.status === 403
          ? t("web:career.networking.messageProRequired", { defaultValue: "Generating outreach messages is a Basic feature." })
          : apiErr.message || t("web:career.networking.draftFailedDefault", { defaultValue: "Couldn't draft a message right now. Please try again." })
      );
    } finally {
      setIsGeneratingMessage(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title={t("web:career.networking.title", { defaultValue: "Networking Assistant" })}
              subtitle={t("web:career.networking.pageSubtitle", { defaultValue: "Career events matched to you, and a place to track the people you're networking with." })}
            />
            {!proRequired && tab === "events" && (
              <Button variant="outline" size="sm" onClick={handleRefreshEvents} disabled={refreshingEvents}>
                {refreshingEvents ? t("web:career.events.refreshing", { defaultValue: "Refreshing…" }) : t("web:career.events.refreshEvents", { defaultValue: "Refresh events" })}
              </Button>
            )}
            {!proRequired && tab === "contacts" && (
              <Button size="sm" onClick={onOpenAdd}>
                <EvaIcon name="plus-outline" size={16} />
                {t("web:career.networking.addContact", { defaultValue: "Add contact" })}
              </Button>
            )}
          </div>

          {proRequired ? (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:career.networking.proRequiredTitle", { defaultValue: "Networking Assistant requires a paid plan" })}</h2>
              <p className="text-sm text-hint">
                {t("web:career.networking.proRequiredSubtitle", {
                  defaultValue: "Upgrade to Saveur Basic or above to see AI-matched career events, track contacts, and get AI-drafted outreach messages.",
                })}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Pill selected={tab === "events"} onClick={() => setTab("events")}>
                  {t("web:career.networking.tabs.events", { defaultValue: "Career Events" })}
                  {unreadEventsCount > 0 && (
                    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-purple px-1 text-[11px] font-semibold text-white">
                      {unreadEventsCount > 9 ? "9+" : unreadEventsCount}
                    </span>
                  )}
                </Pill>
                <Pill selected={tab === "contacts"} onClick={() => setTab("contacts")}>
                  {t("web:career.networking.tabs.contacts", { defaultValue: "Your Contacts" })}
                </Pill>
              </div>

              {tab === "events" ? (
                <div className="flex flex-col gap-3">
                  {eventsError && <p className="text-sm text-danger">{eventsError}</p>}
                  {refreshMessage && <p className="text-sm text-hint">{refreshMessage}</p>}

                  {events === null && !eventsError && <SkeletonRows count={5} />}

                  {events && events.length === 0 && (
                    <EmptyState
                      illustration="search"
                      title={t("web:career.events.empty", { defaultValue: "No events matched yet — try refreshing, or check back after your next scan." })}
                    />
                  )}

                  {events &&
                    events.length > 0 &&
                    events.map((ev) => (
                      <div key={ev.id} className="flex items-start justify-between gap-4 rounded-card border border-border bg-surface-2 p-4 shadow-sm">
                        <a href={ev.url} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-start gap-3">
                          <CompanyLogoAvatar logoUrl={ev.logo_url ?? null} companyName={ev.organizer || ev.title} size={44} className="shrink-0 bg-tint-orange" />
                          <div className="flex-1">
                            <h3 className="font-medium text-primary">{ev.title}</h3>
                            <p className="text-sm text-hint">{[ev.organizer, ev.location].filter(Boolean).join(" · ")}</p>
                            {formatEventDate(ev.event_date) && <p className="mt-1 text-xs font-medium text-brand">{formatEventDate(ev.event_date)}</p>}
                          </div>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleToggleSaveEvent(ev)}
                          disabled={savingEventId === ev.id}
                          aria-label={t("web:career.events.markInterested", { defaultValue: "Mark interested" })}
                          className="shrink-0 text-hint transition hover:text-brand disabled:opacity-50"
                        >
                          <EvaIcon name="star-outline" size={18} className={ev.saved ? "text-brand" : undefined} />
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {contacts === null ? (
                    <SkeletonRows count={2} />
                  ) : contacts.length === 0 ? (
                    <EmptyState
                      illustration="list"
                      title={t("web:career.networking.noContacts", { defaultValue: "No contacts yet — add someone you met networking." })}
                    />
                  ) : (
                    contacts.map((contact) => (
                      <div key={contact.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-primary">{contact.name}</h3>
                          <button
                            type="button"
                            onClick={() => onDeleteContact(contact.id)}
                            aria-label={t("common:actions.delete", { defaultValue: "Delete" })}
                            className="shrink-0 text-hint transition hover:text-danger"
                          >
                            <EvaIcon name="trash-2-outline" size={16} />
                          </button>
                        </div>
                        <p className="text-sm text-hint">
                          {contact.role} · {contact.company}
                        </p>
                        {contact.note && <p className="text-sm text-primary">{contact.note}</p>}
                        <p className="text-xs text-hint">
                          {contact.lastContactedDate
                            ? t("web:career.networking.lastContacted", {
                                defaultValue: "Last contacted: {{date}}",
                                date: new Date(contact.lastContactedDate).toLocaleString(),
                              })
                            : t("web:career.networking.neverContacted", { defaultValue: "Not yet contacted" })}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-4 text-sm font-medium">
                          <button type="button" onClick={() => onMarkContactedToday(contact)} className="text-brand hover:underline">
                            {t("web:career.networking.markContacted", { defaultValue: "Mark contacted" })}
                          </button>
                          <button
                            type="button"
                            onClick={() => (messageContactId === contact.id ? onCloseGenerateMessage() : onOpenGenerateMessage(contact))}
                            className="text-brand hover:underline"
                          >
                            {t("web:career.networking.generateMessage", { defaultValue: "Message" })}
                          </button>
                          <button type="button" onClick={() => onOpenEdit(contact)} className="text-brand hover:underline">
                            {t("common:actions.edit", { defaultValue: "Edit" })}
                          </button>
                        </div>

                        {messageContactId === contact.id && (
                          <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
                            <p className="text-xs text-hint">
                              {t("web:career.networking.generateMessageHint", { defaultValue: "AI-drafted LinkedIn outreach message for this contact." })}
                            </p>
                            <label className="flex flex-col gap-1.5">
                              <span className="text-sm font-medium text-primary">{t("web:career.networking.contextLabel", { defaultValue: "Context" })}</span>
                              <textarea
                                value={messageContext}
                                onChange={(e) => setMessageContext(e.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {MESSAGE_TONES.map((tn) => (
                                <Pill key={tn.id} selected={messageTone === tn.id} onClick={() => setMessageTone(tn.id)}>
                                  {t(`web:career.networking.tones.${tn.id}`, { defaultValue: tn.label })}
                                </Pill>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              className="w-fit"
                              disabled={isGeneratingMessage || !messageContext.trim()}
                              onClick={() => onGenerateMessage(contact)}
                            >
                              {isGeneratingMessage ? t("web:career.networking.generating", { defaultValue: "Generating…" }) : t("web:career.networking.generate", { defaultValue: "Generate" })}
                            </Button>
                            {generateMessageError && <p className="text-sm text-danger">{generateMessageError}</p>}
                            {generatedMessage && (
                              <div className="rounded-lg bg-surface-1 p-3">
                                <p className="whitespace-pre-wrap text-sm text-primary">{generatedMessage}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancelForm}>
            <form
              onSubmit={onSaveContact}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-md flex-col gap-4 rounded-card border border-border bg-surface-2 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-primary">
                  {editingId != null
                    ? t("web:career.networking.editContact", { defaultValue: "Edit Contact" })
                    : t("web:career.networking.addContactTitle", { defaultValue: "Add Contact" })}
                </h2>
                <button
                  type="button"
                  onClick={onCancelForm}
                  aria-label={t("common:actions.close", { defaultValue: "Close" })}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hint hover:bg-surface-3"
                >
                  <EvaIcon name="close-outline" size={18} />
                </button>
              </div>
              <TextField label={t("web:career.networking.contactName", { defaultValue: "Name" })} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              <TextField label={t("web:career.networking.contactCompany", { defaultValue: "Company" })} value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />
              <TextField label={t("web:career.networking.contactRole", { defaultValue: "Role" })} value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-primary">{t("web:career.networking.contactNote", { defaultValue: "Note (how you met, follow-up plan…)" })}</span>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={!form.name.trim()}>
                  {t("common:actions.save", { defaultValue: "Save" })}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancelForm}>
                  {t("common:actions.cancel", { defaultValue: "Cancel" })}
                </Button>
              </div>
            </form>
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}

// useSearchParams() requires a Suspense boundary in the app router (same
// pattern as app/practice/mock-interviews/page.tsx).
export default function NetworkingAssistantPage() {
  return (
    <Suspense fallback={null}>
      <NetworkingAssistantInner />
    </Suspense>
  );
}
