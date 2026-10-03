import apiClient from "./apiClient";
import { downloadUrlAsFile } from "./downloadFile";

// Export / external-link helpers shared by Coding Projects and Practical
// Scenario projects (both are CodingProject rows server-side — see
// Saveur-Backend app/services/project_share_service.py).
export type ProjectKind = "coding" | "practical";

function base(kind: ProjectKind): string {
  return kind === "practical" ? "/api/v1/practical/projects" : "/api/v1/coding/projects";
}

/** GET .../export -> {url, filename}; triggers a browser download of the zip. */
export async function exportProjectZip(kind: ProjectKind, id: number | string): Promise<void> {
  const { url, filename } = await apiClient.get<{ url: string; filename: string }>(`${base(kind)}/${id}/export`);
  await downloadUrlAsFile(url, filename);
}

/** POST .../share-link -> public read-only URL for non-Saveur viewers. */
export async function getProjectPublicUrl(kind: ProjectKind, id: number | string): Promise<string> {
  const { token } = await apiClient.post<{ token: string }>(`${base(kind)}/${id}/share-link`);
  return `${window.location.origin}/shared/project/${token}`;
}
