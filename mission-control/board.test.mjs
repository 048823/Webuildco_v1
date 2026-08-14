// WEB-687 — the Overview "Briefs" card said "reply rate ~4%" while the measured
// rate was 0 replies from 69 contacted (WEB-281, 14-Aug-2026). The board was
// deciding whether to pause that exact campaign at the time, so the one metric
// the decision turned on was the one the dashboard overstated.
//
// Fourth occurrence of the class: WEB-489 fake testimonials, WEB-544 stale demo
// data, WEB-660 invented deals, this. The rule that stops the fifth: a number in
// the briefs block ships only with a `ref` naming where it was measured.
// Anything else fails the build instead of reaching the board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const board = JSON.parse(readFileSync(new URL('./data/board.json', import.meta.url), 'utf8'));
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

// Digits and the word "percent" catch every metric that has actually shipped
// here — rates, counts, percentages — "about four percent" included. What still
// slips past is a number spelled out with no unit word ("one in twenty"). Add a
// word-number list if that ever ships, not before.
const METRIC = /\d|percent/i;

test('briefs is still a list of {title, body} the Overview card can render', () => {
  assert.ok(Array.isArray(board.briefs), 'board.briefs is not an array');
  for (const b of board.briefs) {
    assert.equal(typeof b.title, 'string', 'brief without a title');
    assert.equal(typeof b.body, 'string', `brief "${b.title}" without a body`);
  }
});

test('no performance metric in the briefs block without a ref to where it was measured', () => {
  for (const b of board.briefs || []) {
    if (!METRIC.test(`${b.title} ${b.body}`)) continue;
    assert.ok(
      typeof b.ref === 'string' && b.ref.trim().length > 0,
      `brief "${b.title}" states a number with no "ref" naming the source and read date — ` +
        `estimates do not ship to the board (WEB-687). Either cite it or state no data.`,
    );
  }
});

test('a ref names a source and a read date, not just a shrug', () => {
  for (const b of board.briefs || []) {
    if (!b.ref) continue;
    assert.match(b.ref, /WEB-\d+/, `brief "${b.title}" ref does not name the issue the number came from`);
    assert.match(b.ref, /\d{4}/, `brief "${b.title}" ref does not carry the year it was read`);
  }
});

test('the UI renders the ref it promises', () => {
  assert.match(
    app,
    /const briefRef = \(b\) => \(b && b\.ref \? /,
    'briefRef helper missing — a sourced number would render as an unsourced one',
  );
  assert.match(app, /\$\{briefRef\(b\)\}/, 'Overview Briefs card no longer renders the ref');
});
