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
const deliv = JSON.parse(readFileSync(new URL('./data/deliverables.json', import.meta.url), 'utf8'));
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

// Digits and the word "percent" catch every metric that has actually shipped
// here — rates, counts, percentages — "about four percent" included. What still
// slips past is a number spelled out with no unit word ("one in twenty"). Add a
// word-number list if that ever ships, not before.
const METRIC = /\d|percent/i;

// WEB-694 — the same rule, applied to `projects[].progress`. Twelve hardcoded
// percentages drove the progress bars and the mind-map gauges off a `_projects_note`
// that admitted they were estimates. A bar is worse than a number in a table: it reads
// as measurement, has no room for a caveat, and nobody clicks it to ask where it came
// from. They are deleted; this keeps them out. A row may carry `progress` again only
// with a `ref` in the same shape a brief needs.
const PROJECT_ROWS = (b) => Object.values(b.projects || {}).flat();

// null = the ref is acceptable, string = why it is not. Shared by briefs and projects
// so the two blocks cannot drift apart on what counts as a source.
const refProblem = (ref) => {
  if (typeof ref !== 'string' || !ref.trim()) return 'no "ref" naming the source and read date';
  if (!/WEB-\d+/.test(ref)) return 'ref does not name the issue the number came from';
  if (!/\d{4}/.test(ref)) return 'ref does not carry the year it was read';
  return null;
};

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
    assert.equal(refProblem(b.ref), null, `brief "${b.title}": ${refProblem(b.ref)}`);
  }
});

test('no progress percentage on a project without a ref to where it was measured', () => {
  for (const p of PROJECT_ROWS(board)) {
    if (p.progress == null) continue;
    assert.equal(
      refProblem(p.ref),
      null,
      `project "${p.name}" claims ${p.progress}% complete — ${refProblem(p.ref)}. A bar reads as ` +
        `measurement (WEB-694). Either derive it from closed/total and cite that, or ship no bar.`,
    );
  }
});

// WEB-704 — the same seven-row version of it, one file over. deliverables.json carried 7
// hardcoded `progress` values rendered as bars twice in the Deliverables section, under a
// `_projects_note` that admitted they were manual estimates. Values and note deleted, both
// bars removed. Same rule, same `refProblem`, so the two data files cannot drift on what
// counts as a source: a row may carry `progress` again only with a ref that names the issue
// and the year.
test('no progress percentage on a deliverables project without a ref to where it was measured', () => {
  for (const p of deliv.projects || []) {
    if (p.progress == null) continue;
    assert.equal(
      refProblem(p.ref),
      null,
      `deliverables project "${p.name}" claims ${p.progress}% complete — ${refProblem(p.ref)}. ` +
        `A bar reads as measurement (WEB-704). Either derive it from closed/total and cite that, or ship no bar.`,
    );
  }
});

test('the Deliverables section renders no progress bar', () => {
  assert.doesNotMatch(
    app,
    /dvBar\([a-z]+\.progress\)/,
    'a Deliverables progress bar is back — dvBar has no room for a ref (WEB-704)',
  );
});

test('the ref rule rejects the shapes that actually shipped', () => {
  // Both directions: the live board passes above, these fail here. Every case is a
  // real form the fake numbers took — bare estimate, unsourced note, undated source.
  const bad = [
    { name: 'bare estimate', progress: 40 },
    { name: 'hand-waved', progress: 55, ref: '' },
    { name: 'no issue', progress: 20, ref: 'inferred from the project brief, 2026' },
    { name: 'no year', progress: 10, ref: 'WEB-694' },
  ];
  for (const p of bad) {
    assert.ok(refProblem(p.ref), `"${p.name}" should be refused, the guard accepted it`);
  }
  assert.equal(refProblem('WEB-281 — read-only Instantly API read, 14-Aug-2026 11:45 AEST'), null);
});

test('the table renders a bar only for a row that carries its ref', () => {
  assert.match(
    app,
    /const projProgress = \(p\) => \(p && p\.ref && p\.progress != null/,
    'projProgress helper missing — an unsourced percentage would render as a bar again',
  );
  assert.match(app, /<td>\$\{projProgress\(p\)\}<\/td>/, 'Projects table no longer routes through projProgress');
  assert.doesNotMatch(app, /\$\{pct\}%/, 'the mind-map gauge is back — it has no room for a ref');
});

test('the UI renders the ref it promises', () => {
  assert.match(
    app,
    /const briefRef = \(b\) => \(b && b\.ref \? /,
    'briefRef helper missing — a sourced number would render as an unsourced one',
  );
  assert.match(app, /\$\{briefRef\(b\)\}/, 'Overview Briefs card no longer renders the ref');
});
