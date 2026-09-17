import React from "react";

/** Very small markdown-lite renderer — mirrors mobile's identical renderer
 * in src/more/policyScreen/index.tsx (see that file's own comment): this
 * content is admin-authored plain markdown (#/## headers, "- " bullets,
 * plain paragraphs), so pulling in a full markdown-rendering dependency
 * felt like overkill for a couple of heading levels and bullets. Kept in
 * sync with mobile's line-by-line logic so the same admin-authored
 * body_md renders equivalently on both platforms. */
export function renderMarkdownLite(bodyMd: string): React.ReactNode[] {
  const lines = bodyMd.split("\n");
  const blocks: React.ReactNode[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = (key: string) => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!text) return;
    blocks.push(
      <p key={key} className="mb-4 leading-relaxed text-primary">
        {text}
      </p>
    );
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      flushParagraph(`p${i}`);
      blocks.push(
        <h2 key={`h2-${i}`} className="mb-2 mt-4 text-lg font-bold text-primary">
          {line.replace(/^##\s+/, "")}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      flushParagraph(`p${i}`);
      blocks.push(
        <h1 key={`h1-${i}`} className="mb-3 text-2xl font-bold text-primary">
          {line.replace(/^#\s+/, "")}
        </h1>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph(`p${i}`);
      blocks.push(
        <p key={`li-${i}`} className="mb-1.5 ml-1 leading-relaxed text-primary">
          {"•  "}
          {line.replace(/^[-*]\s+/, "").replace(/\*\*/g, "")}
        </p>
      );
    } else if (!line) {
      flushParagraph(`p${i}`);
    } else {
      paragraphBuffer.push(line.replace(/\*\*/g, ""));
    }
  });
  flushParagraph("p-last");
  return blocks;
}
