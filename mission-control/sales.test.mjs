// WEB-537 — the Sales/Outbound views sum board.json by hand, so a bad row there
// is a wrong number on the dashboard, not a crash. Guard the data contract.
//
// WEB-660 — and guard the failure mode that got the seeded deals deleted: a
// dollar value with no agreed deal behind it, rendered on the Overview tile as
// if it were revenue. Third time we shipped invented data (WEB-489, WEB-544,
// this). A deal may carry a value ONLY with a `ref` naming where the number was
// agreed; anything else fails the build instead of reaching the board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const board = JSON.parse(readFileSync(new URL('./data/board.json', import.meta.url), 'utf8'));
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const stages = JSON.parse(app.match(/const SALES_STAGES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

const deals = board.sales?.deals || [];
const proposals = board.sales?.proposals || [];

test('no dollar value without a ref to where it was agreed', () => {
  for (const r of [...deals, ...proposals]) {
    if (!r.value) continue;
    assert.ok(r.ref, `"${r.title}" carries ${r.value} with no "ref" — invented values do not ship (WEB-660)`);
  }
});

test('the Overview pipeline tile cannot show a total the deals do not justify', () => {
  const CLOSED = ['Won', 'Lost'];
  const open = deals.filter((d) => !CLOSED.includes(d.stage));
  const total = open.reduce((s, d) => s + (+d.value || 0), 0);
  const backed = open.reduce((s, d) => s + (d.ref ? +d.value || 0 : 0), 0);
  assert.equal(total, backed, 'open pipeline total includes a deal with no ref');
});

test('every deal has a known stage and usable numbers', () => {
  for (const d of deals) {
    assert.ok(stages.includes(d.stage) || d.stage === 'Lost', `unknown stage "${d.stage}" on ${d.title}`);
    assert.equal(typeof d.value, 'number', `${d.title} value is not a number`);
    assert.ok(d.probability >= 0 && d.probability <= 100, `${d.title} probability out of range`);
  }
});

test('pipeline totals only ever sum one currency', () => {
  assert.equal(typeof board.sales?.currency, 'string');
  assert.equal(deals.some((d) => d.currency && d.currency !== board.sales.currency), false,
    'a deal is priced in another currency — the totals would be wrong');
});

test('outbound rows carry the fields the tables render, and are all flagged demo', () => {
  const groups = board.outbound || {};
  for (const key of ['prospects', 'leads', 'campaigns', 'templates']) {
    assert.ok((groups[key] || []).length, `outbound.${key} is missing`);
    for (const r of groups[key]) {
      assert.equal(r.demo, true, `outbound.${key}: "${r.company || r.name}" is seed data and must be flagged demo`);
    }
  }
  for (const p of groups.prospects || []) assert.ok(p.company, 'prospect without a company');
  for (const l of groups.leads || []) assert.ok(l.name && l.status, 'lead without a name/status');
  for (const c of groups.campaigns || []) {
    assert.ok(c.name, 'campaign without a name');
    assert.ok(c.opened <= c.sent && c.replied <= c.sent, `${c.name}: opened/replied exceed sent`);
  }
});

test('the UI renders the demo marker it promises', () => {
  assert.match(app, /demoBadge = \(r\) => \(r && r\.demo \? ' <span class="badge">demo<\/span>' : ""\)/,
    'demo badge helper missing — flagged rows would render indistinguishable from real ones');
});
