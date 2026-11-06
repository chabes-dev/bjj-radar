import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeTitle, parsePair } from '../public/js/lib/safeTitle.js';

test('winner verb title becomes X vs Y', () => {
  assert.equal(safeTitle('Gordon Ryan SUBMITS Felipe Pena | ADCC'), 'Gordon Ryan vs Felipe Pena');
});
for (const v of ['beats', 'Defeats', 'wins against', 'taps', 'chokes', 'finishes', 'stuns', 'upsets']) {
  test(`verb "${v}" is hidden`, () => {
    assert.equal(safeTitle(`Ana Silva ${v} Bia Costa | FULL MATCH`), 'Ana Silva vs Bia Costa');
  });
}
test('neutral title unchanged', () => {
  const t = 'Rerrison Gabriel vs Diego Pato | FULL MATCH | 2026 IBJJF Brasileiros';
  assert.equal(safeTitle(t), t);
});
test('parsePair handles x and VS.', () => {
  assert.deepEqual(parsePair('A x B | LUTA COMPLETA'), ['A', 'B']);
  assert.deepEqual(parsePair('A VS. B'), ['A', 'B']);
  assert.deepEqual(parsePair('Mica Galvão vs. Tainan Dalpra | FULL MATCH'), ['Mica Galvão', 'Tainan Dalpra']);
});
test('spoiler with no parsable pair falls back', () => {
  assert.equal(safeTitle('INSANE comeback WINS the title!!'), 'Full match');
});
