import type { Extension } from "@codemirror/state";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { php } from "@codemirror/lang-php";

// File-extension -> CodeMirror language extension, for the project editor's
// syntax highlighting (CodeMirror's basicSetup already covers line numbers /
// bracket matching / auto-indent regardless of language — see
// app/practice/coding/projects/[id]/page.tsx). Covers the minimum the
// product ask calls out by name (HTML, CSS, JS/TS, Python, Java, C/C++),
// plus PHP since it was a near-zero-cost addition given @codemirror/lang-php
// was already needed for the Run panel's supported-language list.
function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "";
  return path.slice(dot + 1).toLowerCase();
}

export function languageExtensionForPath(path: string): Extension[] {
  switch (extOf(path)) {
    case "html":
    case "htm":
      return [html()];
    case "css":
      return [css()];
    case "js":
    case "mjs":
    case "cjs":
      return [javascript({ jsx: true })];
    case "jsx":
      return [javascript({ jsx: true })];
    case "ts":
      return [javascript({ jsx: true, typescript: true })];
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "py":
      return [python()];
    case "java":
      return [java()];
    case "c":
    case "h":
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
      return [cpp()];
    case "php":
      return [php()];
    default:
      return [];
  }
}

/** File-extension -> the backend's /coding/languages key, for defaulting the
 * Run panel's language picker to whatever the currently-open file looks
 * like (still overridable — this is just a sensible default, not a lock). */
export function guessRunLanguage(path: string): string | undefined {
  switch (extOf(path)) {
    case "py":
      return "python";
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "java":
      return "java";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
      return "cpp";
    case "c":
    case "h":
      return "c";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "cs":
      return "csharp";
    case "rb":
      return "ruby";
    case "php":
      return "php";
    case "kt":
      return "kotlin";
    case "swift":
      return "swift";
    default:
      return undefined;
  }
}
