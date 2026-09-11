// Web port of mobile's VoiceCoachView.tsx isAffirmative/AFFIRMATIVE_WORDS/
// NEGATIVE_WORDS — used by app/ai-coach/voice/page.tsx to decide whether a
// spoken reply to the coach's "Want me to take you to X?" offer means yes
// or no. Ported verbatim (same word lists, same negative-wins-first logic,
// same whole-word vs. substring split per language) rather than
// reimplemented, since mobile's own history already documents a real, fixed
// false-positive bug here (declines containing filler words like "okay" or
// "sure" were misread as a yes) — reusing the exact fixed logic avoids
// reintroducing that bug on web.
const AFFIRMATIVE_WORDS: Record<string, string[]> = {
  en: ["yes", "yeah", "yep", "sure", "ok", "okay", "please", "go ahead", "take me there", "let's do it"],
  es: ["si", "sí", "claro", "vale", "dale", "por favor"],
  fr: ["oui", "d'accord", "ok", "vas-y", "s'il te plait", "s'il vous plait"],
  de: ["ja", "klar", "gerne", "okay", "ok"],
  it: ["si", "sì", "certo", "va bene", "ok", "okay"],
  pt: ["sim", "claro", "vamos", "ok", "okay", "por favor"],
  ru: ["да", "конечно", "давай", "хорошо"],
  zh: ["是", "好", "好的", "可以", "去吧"],
  ja: ["はい", "うん", "お願いします", "いいよ"],
  ko: ["네", "예", "좋아", "그래"],
  ar: ["نعم", "اكيد", "حسنا", "تمام"],
  hi: ["हाँ", "ठीक है", "हां", "चलो"],
};

const NEGATIVE_WORDS: Record<string, string[]> = {
  en: ["no", "nope", "nah", "don't", "dont", "not now", "never mind", "nevermind", "not really", "no thanks", "not yet"],
  es: ["no", "nunca", "para nada", "ahora no"],
  fr: ["non", "pas maintenant", "jamais"],
  de: ["nein", "niemals", "jetzt nicht"],
  it: ["no", "mai", "non ora"],
  pt: ["não", "nao", "nunca", "agora não"],
  ru: ["нет", "не сейчас", "никогда"],
};

const WORD_TOKENIZED_LANGS = new Set(["en", "es", "fr", "de", "it", "pt", "ru"]);
const WORD_SPLIT_RE = /[^a-zà-ÿ0-9а-яё']+/;

function matchesAnyWord(normalized: string, words: string[], wholeWord: boolean): boolean {
  if (!wholeWord) return words.some((w) => normalized.includes(w));
  const tokens = normalized.split(WORD_SPLIT_RE).filter(Boolean);
  return words.some((w) => (w.includes(" ") ? normalized.includes(w) : tokens.includes(w)));
}

export function isAffirmative(text: string, language: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  const lang = language?.split("-")[0] ?? "en";
  const wholeWord = WORD_TOKENIZED_LANGS.has(lang);
  const negativeWords = NEGATIVE_WORDS[lang];
  if (negativeWords && matchesAnyWord(normalized, negativeWords, wholeWord)) return false;
  const words = AFFIRMATIVE_WORDS[lang] ?? AFFIRMATIVE_WORDS.en;
  return matchesAnyWord(normalized, words, wholeWord);
}
