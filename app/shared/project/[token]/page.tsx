"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ProjectViewer } from "@/components/coding/ProjectViewer";
import * as sharesService from "@/lib/sharesService";
import type { PublicProject } from "@/lib/sharesService";

// Public, unauthenticated read-only page for a project shared through an
// external link (people who aren't on Saveur). No RequireAuth / AppShell on
// purpose.
export default function PublicProjectPage() {
  const { t } = useTranslation();
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [project, setProject] = useState<PublicProject | null | undefined>(undefined);

  useEffect(() => {
    if (!token) return;
    sharesService
      .getPublicProject(token)
      .then(setProject)
      .catch(() => setProject(null));
  }, [token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-6">
      {project === undefined && <p className="text-sm text-hint">{t("common:loading", { defaultValue: "Loading…" })}</p>}
      {project === null && (
        <p className="text-sm text-hint">
          {t("web:share.linkInvalid", { defaultValue: "This link is invalid or was revoked by its owner." })}
        </p>
      )}
      {project && <ProjectViewer name={project.name} files={project.files} />}
      <p className="text-center text-xs text-hint">
        {t("web:share.sharedViaSaveur", { defaultValue: "Shared via Saveur" })} ·{" "}
        <Link href="/" className="text-brand hover:underline">
          saveur
        </Link>
      </p>
    </main>
  );
}
