import apiClient, { API_BASE_URL } from "./apiClient";

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
  const isOwnApi = !url.startsWith("http") || url.startsWith(API_BASE_URL);

  // BUG FIX (product report: "Couldn't download the file. Please try
  // again." on every generated PDF/DOCX — persisted even after apiClient's
  // downloadBlob stopped attaching our own auth header to this url). That
  // first fix addressed a CORS PREFLIGHT (triggered by the custom
  // Authorization header); this addresses the deeper issue underneath it —
  // a browser fetch()/XHR read of ANY cross-origin response, even one sent
  // with zero custom headers, still requires the response to carry an
  // Access-Control-Allow-Origin header before script is allowed to read
  // the bytes at all. This app's S3/DigitalOcean Spaces bucket has never
  // had CORS configured (see s3_service.py's own documented history of
  // this account/plan rejecting ACLs and bucket policies too), so fetching
  // this url via JS — with or without extra headers — was always going to
  // be blocked by the browser once it got past the preflight fix.
  //
  // A plain browser-native <a href> click is NOT subject to CORS at all —
  // the browser navigates to/streams the resource itself, nothing in this
  // page's JS ever reads the response bytes. The one thing this loses vs.
  // the fetch+blob approach is guaranteed control over the saved filename
  // and forced "Save As" behavior (a `download` attribute on a cross-origin
  // anchor is only ever a hint browsers may ignore) — that gap is closed
  // server-side instead: the returned `url` for every export now bakes in
  // a matching `ResponseContentDisposition: attachment; filename="..."`
  // at presign time (s3_service.py's S3Storage.get_url), so the browser
  // downloads it with the right name and a real save dialog regardless of
  // which path (this fetch fallback or a bare click) reaches it.
  if (!isOwnApi) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

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
