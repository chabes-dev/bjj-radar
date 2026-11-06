import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, nameMatches } from '../public/js/lib/normalize.js';

test('normalizeName trims and lowercases', () => {
  assert.equal(normalizeName('Nicholas Meregali '), 'nicholas meregali');
});
test('normalizeName strips accents', () => {
  assert.equal(normalizeName('Mica Galvão'), 'mica galvao');
});
test('alias hit counts as full', () => {
  assert.equal(nameMatches('Meregalli vs Pena | FULL MATCH', { name: 'Nicholas Meregali', aliases: ['Meregalli'] }), 'full');
});
test('full name hit', () => {
  assert.equal(nameMatches('Gordon Ryan vs Felipe Pena', { name: 'Gordon Ryan', aliases: [] }), 'full');
});
test('surname only is surname (twins)', () => {
  assert.equal(nameMatches('Ruotolo vs Ryan', { name: 'Kade Ruotolo', aliases: [] }), 'surname');
});
test('no match is null and no partial-word hits', () => {
  assert.equal(nameMatches('Ryanne Smith vs X', { name: 'Gordon Ryan', aliases: [] }), null);
});
