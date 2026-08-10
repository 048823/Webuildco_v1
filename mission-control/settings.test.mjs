import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const MCS = createRequire(import.meta.url)("./settings.js");

test("defaults survive a round trip through merge", () => {
  assert.deepEqual(MCS.merge(MCS.DEFAULTS), MCS.DEFAULTS);
  assert.deepEqual(MCS.merge(null), MCS.DEFAULTS);
  assert.deepEqual(MCS.merge("junk"), MCS.DEFAULTS);
});

test("merge rejects out-of-range and hand-edited values", () => {
  const s = MCS.merge({
    theme: "neon", density: "spacious", rows: 9999, base: "XYZ", refresh: 7,
    hidden: ["finance", 42, "settings", "overview"],
    fx: { USD: -1, MYR: "abc", SGD: 1.1, AUD: 500 },
  });
  assert.equal(s.theme, "system");
  assert.equal(s.density, "comfortable");
  assert.equal(s.rows, MCS.DEFAULTS.rows);
  assert.equal(s.base, "AUD");
  assert.equal(s.refresh, 0);
  assert.deepEqual(s.hidden, ["finance"], "pinned sections and non-strings are dropped");
  assert.equal(s.fx.USD, MCS.DEFAULTS.fx.USD, "a negative rate falls back to the default");
  assert.equal(s.fx.MYR, MCS.DEFAULTS.fx.MYR, "a non-numeric rate falls back to the default");
  assert.equal(s.fx.SGD, 1.1, "a valid rate is kept");
  assert.equal(s.fx.AUD, 1, "AUD stays the pivot");
});

test("merge sanitises tags and drops assignments to deleted tags", () => {
  const s = MCS.merge({
    tags: [
      { id: "a", label: "Client", color: "javascript:alert(1)", cat: "Engagement" },
      { id: "b", label: "Website", color: "#2563EB" },
      { label: "no id" },
    ],
    assign: { Everflow: ["a", "b", "gone"], Empty: ["gone"], Bad: "not-an-array" },
  });
  assert.equal(s.tags.length, 2);
  assert.equal(s.tags[0].color, "#52525b", "a non-hex colour never reaches a style attribute");
  assert.equal(s.tags[1].color, "#2563EB");
  assert.equal(s.tags[1].cat, "Type");
  assert.deepEqual(s.assign, { Everflow: ["a", "b"] });
});

test("convert moves money through the AUD pivot", () => {
  const fx = { AUD: 1, USD: 0.5, MYR: 3 };
  assert.equal(MCS.convert(100, "AUD", "USD", fx), 50);
  assert.equal(MCS.convert(50, "USD", "AUD", fx), 100);
  assert.equal(MCS.convert(100, "USD", "MYR", fx), 600);
  assert.equal(MCS.convert(100, "AUD", "AUD", fx), 100);
  assert.equal(MCS.convert(100, "AUD", "JPY", fx), 100, "an unknown rate shows the raw number, never a wrong one");
  assert.equal(MCS.convert(100, "AUD", "USD", { AUD: 1, USD: 0 }), 100, "a zero rate does not wipe the figure");
});

test("visible hides toggled-off modules but never the pinned ones", () => {
  const sections = [{ id: "overview" }, { id: "finance" }, { id: "briefs" }, { id: "settings" }];
  assert.deepEqual(MCS.visible(sections, ["finance"]).map((s) => s.id), ["overview", "briefs", "settings"]);
  assert.deepEqual(MCS.visible(sections, ["overview", "settings"]).map((s) => s.id), ["overview", "finance", "briefs", "settings"]);
  assert.deepEqual(MCS.visible(sections, null).map((s) => s.id), sections.map((s) => s.id));
});

test("load falls back to defaults on unreadable storage", () => {
  const bad = { getItem: () => "{not json", setItem() {} };
  assert.deepEqual(MCS.load(bad), MCS.DEFAULTS);
  const store = new Map();
  const ok = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  MCS.save({ ...MCS.DEFAULTS, base: "MYR" }, ok);
  assert.equal(MCS.load(ok).base, "MYR");
});
