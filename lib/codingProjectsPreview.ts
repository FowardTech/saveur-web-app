// Builds a single self-contained HTML string for a "web" project's live
// preview iframe (srcDoc) — see Saveur-Backend/app/api/coding.py's own
// comment on run_project(): "web" projects have NO run endpoint at all,
// the frontend is expected to render the already-fetched file contents
// client-side. This is deliberately the simple, common case per the
// product ask ("build a small landing page"): an index.html at the project
// root, plus optionally sibling style.css / script.js referenced via plain
// <link href> / <script src> tags — not a general bundler. Anything it
// can't resolve (a missing file, an absolute/external URL) is left as-is in
// the markup rather than dropped, so an external CDN <script src> still
// works in the preview.
export function buildProjectPreviewHtml(files: Record<string, string>): string {
  const indexPath = Object.keys(files).find((p) => p.toLowerCase() === "index.html");
  if (!indexPath) {
    return `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;color:#666">
      <p>No <code>index.html</code> found at the project root — add one to see a live preview.</p>
    </body></html>`;
  }

  let html = files[indexPath];

  // Inline <link ... href="style.css"> style stylesheet references (only
  // ones ending in .css, so a <link rel="icon"> favicon tag is left alone).
  html = html.replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (match, href: string) => {
    const key = resolveRelative(href, files);
    if (key == null) return match;
    return `<style>\n${files[key]}\n</style>`;
  });

  // Inline <script src="script.js"></script> references to project files.
  html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi, (match, src: string) => {
    const key = resolveRelative(src, files);
    if (key == null) return match;
    return `<script>\n${files[key]}\n</script>`;
  });

  return html;
}

function resolveRelative(href: string, files: Record<string, string>): string | null {
  if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith("data:")) return null; // external — leave alone
  const normalized = href.replace(/^\.\//, "").replace(/^\//, "");
  return normalized in files ? normalized : null;
}
