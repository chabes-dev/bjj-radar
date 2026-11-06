// Spoiler-safe video titles.

const SEP = /\s+(?:vs\.?|x)\s+/i;
const SPOILER = /\s+(?:submits?|beats?|defeats?|wins?(?:\s+against|\s+over)?|taps(?:\s+out)?|chokes(?:\s+out)?|finishes|stuns|upsets)\s+/i;

// A plausible athlete name: 1–4 words, each starting with an uppercase letter.
function looksLikeName(s) {
  const words = s.trim().split(/\s+/);
  return words.length >= 1 && words.length <= 4 && words.every((w) => /^\p{Lu}/u.test(w));
}

function firstSegment(title) {
  return String(title ?? '').split('|')[0].trim();
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
  return splitBy(firstSegment(title), SEP);
}

export function hasSpoiler(title) {
  return SPOILER.test(firstSegment(title)) || /\bwins?\b/i.test(firstSegment(title));
}

export function safeTitle(raw) {
  const seg = firstSegment(raw);
  if (!hasSpoiler(raw)) return raw;
  const pair = splitBy(seg, SPOILER);
  return pair ? `${pair[0]} vs ${pair[1]}` : 'Full match';
}
