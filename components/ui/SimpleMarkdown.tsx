import React from "react";

// Minimal markdown renderer (headings, bullets, **bold**) so AI-written
// briefs don't show raw "###" and "**" characters.
function inline(line: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
  );
}

export function SimpleMarkdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm text-primary">
      {(text || "").split("\n").map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={i} className="h-2" />;
        const h = line.match(/^#{1,6}\s+(.*)$/);
        if (h) return <h3 key={i} className="mt-2 text-sm font-bold">{h[1].replace(/\*\*/g, "")}</h3>;
        const b = line.match(/^\s*[*-]\s+(.*)$/);
        if (b) return <div key={i} className="flex gap-2"><span>•</span><span>{inline(b[1])}</span></div>;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}
