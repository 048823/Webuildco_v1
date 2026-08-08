// WEB-505 — every proof number must be in the served HTML, not written by JS.
// countUp() still animates over the top of it; it just isn't the only writer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const COUNTER = /<div\b([^>]*\bdata-(?:count|literal)="[^"]*"[^>]*)>([^<]*)<\/div>/g;
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

test('served text of every counter equals its data attributes', () => {
  const seen = [];
  for (const [, tag, text] of html.matchAll(COUNTER)) {
    const literal = attr(tag, 'data-literal');
    const expected = literal ?? (attr(tag, 'data-prefix') ?? '') + attr(tag, 'data-count') + (attr(tag, 'data-suffix') ?? '');
    assert.equal(text, expected, `counter renders "${text}", expected "${expected}"`);
    seen.push(expected);
  }
  assert.equal(seen.length, 12, `expected 12 counters, found ${seen.length}`);
  for (const n of ['5', '10', '12', '30-day', 'wk 3']) assert.ok(seen.includes(n), `missing ${n}`);
});

test('no counter still rests on the literal 0', () => {
  assert.equal(html.match(/data-(?:count|literal)="[^"]*"[^>]*>0</g), null);
});

test('reveal content is visible without JS', () => {
  assert.match(html, /<html[^>]*class="no-js"/);
  assert.match(html, /\.no-js \.reveal\{opacity:1;transform:none\}/);
});
