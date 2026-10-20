// Terminal-style interactive runs on top of a NON-interactive runner.
//
// Product request: "how do you deal with codes that require input prompts like
// Python, Java, C etc. -- that should be possible too". The code runner
// (Judge0) executes a program once with a fixed stdin string; there is no live
// process to type into. So we emulate a terminal by REPLAYING the program:
//
//   1. run with the answers typed so far (stdin = answers joined by "\n");
//   2. if the program reached a point where it wanted MORE input, stop and
//      show everything it printed up to that point (including its prompt) --
//      the user types the next answer, and we go back to step 1;
//   3. otherwise the program finished: show the full output.
//
// "Wanted more input" is detected from the run failing with an EOF-style error
// when stdin ran out: Python (EOFError) and Java (Scanner's
// NoSuchElementException / InputMismatchException, or a BufferedReader.readLine()
// null). Those two give an exact terminal transcript. Languages like C, C++, Go,
// JS, Ruby and PHP just carry on silently when stdin ends (scanf returns EOF,
// etc.), so there's no reliable signal of WHERE the program wanted input -- for
// those the UI asks for all the input up front instead (see needsUpfrontInput).
//
// Because each answer replays the program from the start, this is exact for
// deterministic programs (the overwhelming majority of practice programs) and
// best-effort for ones that use randomness/time. Mirrors the mobile app's
// utils/interactiveRun.ts.

import { looksLikeMissingInput, needsStdin } from "./stdinNeeds";

export interface RunOut {
  stdout?: string | null;
  stderr?: string | null;
  status?: string | null;
  engine?: string | null;
}

export interface InteractiveState {
  /** Lines the user has typed so far, in order. */
  answers: string[];
  /** snapshots[k] = the program's stdout up to the point it asked for input #k+1
   * (k answers supplied). Used to rebuild a terminal transcript. */
  snapshots: string[];
  /** Terminal-style text: program output with the user's answers echoed in place. */
  transcript: string;
  /** True when the program is blocked waiting for another line of input. */
  waiting: boolean;
  /** Raw result of the latest run (final status/stderr/time when finished). */
  last: RunOut | null;
  /** The runner couldn't really execute (AI-simulated engine) -- no live input. */
  simulated: boolean;
}

const LIVE_LANGUAGES = new Set(["python", "java"]);
export const MAX_INTERACTIVE_ANSWERS = 200;

/** Languages where a missing-input failure is reliable, so the console can be
 * truly live (prompt -> type -> continue). */
export function isLiveInteractive(language: string): boolean {
  return LIVE_LANGUAGES.has((language || "").trim().toLowerCase());
}

/** For every other language: should the UI ask for ALL the program's input up
 * front (the runner can't tell us where it blocks)? */
export function needsUpfrontInput(language: string, code: string): boolean {
  return !isLiveInteractive(language) && needsStdin(language, code);
}

/** BufferedReader.readLine() returns null at EOF, which then blows up as a NullPointerException. */
function javaNullReadLine(stderr: string | null | undefined, source: string): boolean {
  return /NullPointerException/.test(stderr ?? "") && /BufferedReader|readLine\s*\(/.test(source);
}

function toStdin(answers: string[]): string {
  return answers.map((a) => `${a}\n`).join("");
}

function buildTranscript(answers: string[], snapshots: string[], tail: string): string {
  // snapshots[i] is stdout when i answers were supplied; the answer i is typed
  // right after the output printed up to snapshot i.
  let out = "";
  let consumed = "";
  for (let i = 0; i < answers.length; i++) {
    const snap = snapshots[i] ?? "";
    const seg = snap.startsWith(consumed) ? snap.slice(consumed.length) : snap;
    out += seg + answers[i] + "\n";
    consumed = snap;
  }
  const last = tail.startsWith(consumed) ? tail.slice(consumed.length) : tail;
  return out + last;
}

/** Run the program with `answers` supplied and work out whether it wants more. */
export async function advance(
  run: (stdin: string) => Promise<RunOut>,
  language: string,
  answers: string[],
  snapshots: string[],
  source = "",
): Promise<InteractiveState> {
  const lang = language.trim().toLowerCase();
  const base = await run(toStdin(answers));
  const stdout = typeof base.stdout === "string" ? base.stdout : "";

  // The AI-simulated fallback engine predicts output instead of executing, so
  // there is no real "program waiting for input" to detect.
  if (base.engine === "ai") {
    return { answers, snapshots, transcript: stdout, waiting: false, last: base, simulated: true };
  }

  let waiting = false;
  if (isLiveInteractive(lang) && answers.length < MAX_INTERACTIVE_ANSWERS) {
    waiting = looksLikeMissingInput(base.stderr) || (lang === "java" && javaNullReadLine(base.stderr, source));
  }
  const shown = stdout;

  const nextSnapshots = snapshots.slice(0, answers.length);
  nextSnapshots[answers.length] = waiting ? shown : stdout;
  const transcript = buildTranscript(answers, nextSnapshots, waiting ? shown : stdout);
  return { answers, snapshots: nextSnapshots, transcript, waiting, last: base, simulated: false };
}
