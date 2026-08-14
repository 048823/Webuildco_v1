import test from "node:test";
import assert from "node:assert/strict";
import mm from "./marketing-metrics.js";

const CH = [
  { key: "meta", label: "Meta", campaigns: [
    { name: "a", status: "active", spend: 1000, revenue: 4000, conversions: 20, impressions: 10000, clicks: 200 },
    { name: "b", status: "paused", spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 },
  ] },
  { key: "google", label: "Google", campaigns: [
    { name: "c", status: "active", spend: 500, revenue: 1500, conversions: 5, impressions: 4000, clicks: 120 },
  ] },
];

test("campaign rates come off its own figures", () => {
  const r = mm.campaignMetrics(CH[0].campaigns[0]);
  assert.equal(r.ctr, 2);      // 200 / 10000
  assert.equal(r.cpa, 50);     // 1000 / 20
  assert.equal(r.roas, 4);     // 4000 / 1000
  assert.equal(r.name, "a");   // original row survives
});

test("empty campaign returns zeros, never NaN or Infinity", () => {
  const r = mm.campaignMetrics(CH[0].campaigns[1]);
  assert.deepEqual([r.ctr, r.cpa, r.roas], [0, 0, 0]);
});

test("channel rates are derived from the totals, not averaged", () => {
  const r = mm.channelRollup(CH[0].campaigns);
  assert.equal(r.spend, 1000);
  assert.equal(r.active, 1);
  assert.equal(r.roas, 4);
  assert.equal(r.ctr, 2);
});

test("blended rollup sums every channel", () => {
  const b = mm.blendedRollup(CH);
  assert.equal(b.spend, 1500);
  assert.equal(b.revenue, 5500);
  assert.equal(b.conversions, 25);
  assert.equal(b.roas, 5500 / 1500);
  assert.equal(b.cpa, 60);
  assert.equal(b.channels.length, 2);
});

test("snapshots keep the newest row per source+metric and the move since the last", () => {
  const out = mm.latestSnapshots([
    { date: "2026-08-01", source: "Website", metric: "visitors_7d", value: 100 },
    { date: "2026-08-08", source: "Website", metric: "visitors_7d", value: 125 },
    { date: "2026-08-08", source: "LinkedIn", metric: "followers", value: 900 },
  ]);
  const site = out.find((r) => r.source === "Website");
  assert.equal(site.value, 125);
  assert.equal(site.delta, 25);
  assert.equal(out.find((r) => r.source === "LinkedIn").delta, null); // nothing to compare
});
