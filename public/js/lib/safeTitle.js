// Spoiler-safe video titles. Allow-list: the output is only ever "A vs B" or "Full match".
// The raw title is never passed through, so unknown spoiler phrasings can't leak.

const SEP = /\s+(?:vs\.?|x|versus)\s+/i;
// Phrasings that put a winner between two names. Used only to recover the pair.
const RESULT = /\s+(?:gets\s+submitted\s+by|submits?|subs|def\.?|defeats?|beats?|wins?(?:\s+against|\s+over)?|taps(?:\s+out)?|chokes(?:\s+out)?|finishes|stuns|upsets|finaliza|vence|venceu|derrota|bate)\s+/i;

// A plausible athlete name: 1–4 words, each starting with an uppercase letter.
function looksLikeName(s) {
  const words = s.trim().split(/\s+/);
  return words.length >= 1 && words.length <= 4 && words.every((w) => /^\p{Lu}/u.test(w));
}

// Title segments split on "|", " - ", and ":".
function segments(title) {
  return String(title ?? '').split(/\s*\|\s*|\s+[-–—]\s+|:\s+/).map((s) => s.replace(/\bfull\s+match\b|\bluta\s+completa\b/ig, '').trim()).filter(Boolean);
}

function splitBy(seg, re) {
  const m = seg.match(re);
  if (!m) return null;
  const a = seg.slice(0, m.index).trim();
  const b = seg.slice(m.index + m[0].length).trim();
  return looksLikeName(a) && looksLikeName(b) ? [a, b] : null;
}

// Returns the two names in "A vs B" / "A x B" / "A VS. B" titles, else null.
export function parsePair(title) {
  for (const seg of segments(title)) {
    const p = splitBy(seg, SEP);
    if (p) return p;
  }
  return null;
}

export function safeTitle(raw) {
  const pair = parsePair(raw);
  if (pair) return `${pair[0]} vs ${pair[1]}`;
  for (const seg of segments(raw)) {
    const p = splitBy(seg, RESULT);
    // Sort so the winner/loser order doesn't leak.
    if (p) return p.sort((x, y) => x.localeCompare(y)).join(' vs ');
  }
  return 'Full match';
}
