"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/app/providers/AuthProvider";
import type { ApiError } from "@/lib/apiClient";

// Edits name/phone/address via PATCH /api/v1/users/me (see
// Saveur-Backend/app/api/users.py's update_me()) — mirrors mobile's
// EditProfile.tsx field set. Email is read-only (tied to the Firebase
// account, not editable from a profile form on either client).
export default function ProfileSettingsPage() {
  const { profile, updateProfile } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phoneNumber || "");
      setAddress(profile.homeAddress || "");
    }
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ name: name.trim(), phoneNumber: phone.trim(), homeAddress: address.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as ApiError).message || "Couldn't save your profile right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-xl flex-col gap-8 pb-10">
          <PageHeader title="Profile" subtitle="Update your account details." />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextField label="Email" value={profile?.email || ""} disabled className="opacity-60" />
            <TextField label="Phone number" placeholder="Optional" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label="Home address" placeholder="Optional" value={address} onChange={(e) => setAddress(e.target.value)} />
            {error && <p className="text-sm text-danger">{error}</p>}
            {saved && <p className="text-sm text-success-text">Saved.</p>}
            <Button type="submit" disabled={saving} className="mt-1 w-full">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
