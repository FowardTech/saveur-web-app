import apiClient from "./apiClient";

// Shared "download a file the backend just generated" helper — every
// resume/cover-letter export endpoint (POST /resume/export, POST
// /resume/cover-letter/export) returns {url}, a real https link to the
// rendered PDF/DOCX in storage. Web's equivalent of mobile's share-sheet
// download (see Saveur's GenerateResume.tsx/JDCoverLetterGenerator.tsx
// onDownload) is fetching those bytes and triggering a browser save via a
// temporary <a download> — same pattern app/resume/variants/page.tsx's own
// handleShare already established, pulled out here so every export button
// across Resume Builder / Cover Letter / JD Analyzer / Generate can share it.
export async function downloadUrlAsFile(url: string, filename: string): Promise<void> {
  const blob = await apiClient.downloadBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
