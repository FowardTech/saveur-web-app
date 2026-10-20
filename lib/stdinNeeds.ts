// Detects programs that read from standard input, so the Run panel can ask the
// user for that input BEFORE running. Product report: running a Python script
// that calls input() failed with "EOFError: EOF when reading a line" -- the
// runner pipes a fixed stdin string (it isn't an interactive terminal), and
// nothing told the user the program needed one. Mirrors the mobile app's
// utils/stdinNeeds.ts.

const READ_PATTERNS: Record<string, RegExp> = {
  python: /\binput\s*\(|sys\.stdin|fileinput\./,
  javascript: /readline|process\.stdin|prompt\s*\(|readFileSync\(\s*0|\/dev\/stdin/,
  typescript: /readline|process\.stdin|prompt\s*\(|readFileSync\(\s*0|\/dev\/stdin/,
  java: /\bScanner\s*\(|BufferedReader|System\.in\b|System\.console/,
  kotlin: /readLine\s*\(|readln\s*\(|Scanner\s*\(|System\.`in`|System\.in\b/,
  c: /\bscanf\s*\(|\bgets\s*\(|\bfgets\s*\(|\bgetchar\s*\(|\bgetline\s*\(/,
  cpp: /\bcin\b|\bscanf\s*\(|\bgetline\s*\(|\bgets\s*\(|\bgetchar\s*\(/,
  "c++": /\bcin\b|\bscanf\s*\(|\bgetline\s*\(|\bgets\s*\(|\bgetchar\s*\(/,
  csharp: /Console\.Read(Line)?\s*\(/,
  "c#": /Console\.Read(Line)?\s*\(/,
  go: /fmt\.Scan|bufio\.NewReader\(\s*os\.Stdin|bufio\.NewScanner\(\s*os\.Stdin/,
  ruby: /\bgets\b|STDIN|\$stdin/,
  php: /fgets\s*\(\s*STDIN|readline\s*\(|stream_get_contents\s*\(\s*STDIN|file_get_contents\s*\(\s*['"]php:\/\/stdin/,
  rust: /stdin\s*\(\)/,
  swift: /readLine\s*\(/,
  r: /readline\s*\(|readLines\s*\(\s*["']?stdin|scan\s*\(/,
  perl: /<STDIN>|<>/,
};

function key(language: string): string {
  return (language || "").trim().toLowerCase();
}

/** True when the source appears to read standard input. */
export function needsStdin(language: string, code: string): boolean {
  const re = READ_PATTERNS[key(language)];
  return !!re && re.test(code || "");
}

/** Best-effort list of the prompts a Python script shows via input("..."),
 * in source order, used as hints for what to type on each line. */
export function pythonInputPrompts(code: string): string[] {
  const out: string[] = [];
  const re = /\binput\s*\(\s*(?:f?["']([^"'\n]*)["'])?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code || ""))) out.push((m[1] ?? "").trim());
  return out;
}

/** True when a run's error output says the program tried to read input that
 * wasn't there (not provided, or not enough lines). */
export function looksLikeMissingInput(stderr?: string | null): boolean {
  if (!stderr) return false;
  return /EOFError|NoSuchElementException|InputMismatchException|No line found|End of (file|input)|unexpected EOF|EOF when reading/i.test(stderr);
}
