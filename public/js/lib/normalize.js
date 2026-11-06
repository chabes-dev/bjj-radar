// Name normalization shared by the browser and Node tests.

export function normalizeName(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(haystack, phrase) {
  if (!phrase) return false;
  return (' ' + haystack + ' ').includes(' ' + phrase + ' ');
}

// 'full'    → full name or an alias appears in the title
// 'surname' → only the last name appears (ambiguous: siblings, common names)
// null      → no hit
export function nameMatches(title, athlete) {
  const t = normalizeName(title);
  const full = normalizeName(athlete.name);
  if (containsPhrase(t, full)) return 'full';
  for (const a of athlete.aliases ?? []) {
    if (containsPhrase(t, normalizeName(a))) return 'full';
  }
  const parts = full.split(' ');
  const surname = parts.length > 1 ? parts[parts.length - 1] : null;
  if (surname && containsPhrase(t, surname)) return 'surname';
  return null;
}
