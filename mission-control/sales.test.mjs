// WEB-537 — the Sales/Outbound views sum board.json by hand, so a bad row there
// is a wrong number on the dashboard, not a crash. Guard the data contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const board = JSON.parse(readFileSync(new URL('./data/board.json', import.meta.url), 'utf8'));
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const stages = JSON.parse(app.match(/const SALES_STAGES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

test('every deal has a known stage and usable numbers', () => {
  const deals = board.sales?.deals || [];
  assert.ok(deals.length, 'no deals in board.json');
  for (const d of deals) {
    assert.ok(stages.includes(d.stage) || d.stage === 'Lost', `unknown stage "${d.stage}" on ${d.title}`);
    assert.equal(typeof d.value, 'number', `${d.title} value is not a number`);
    assert.ok(d.probability >= 0 && d.probability <= 100, `${d.title} probability out of range`);
  }
});

test('pipeline totals only ever sum one currency', () => {
  assert.equal(typeof board.sales?.currency, 'string');
  assert.equal(board.sales.deals.some((d) => d.currency && d.currency !== board.sales.currency), false,
    'a deal is priced in another currency — the totals would be wrong');
});

test('outbound rows carry the fields the tables render', () => {
  for (const p of board.outbound?.prospects || []) assert.ok(p.company, 'prospect without a company');
  for (const l of board.outbound?.leads || []) assert.ok(l.name && l.status, 'lead without a name/status');
  for (const c of board.outbound?.campaigns || []) {
    assert.ok(c.name, 'campaign without a name');
    assert.ok(c.opened <= c.sent && c.replied <= c.sent, `${c.name}: opened/replied exceed sent`);
  }
});
