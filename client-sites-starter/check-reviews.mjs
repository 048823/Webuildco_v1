#!/usr/bin/env node
// Copy gate (WEB-489): the spec-site starter must not be able to manufacture a testimonial.
//
// Two rules, both upstream of any individual draft:
//   1. The template supplies no quote characters around a review token. If a quote
//      renders, the quote characters come from the pasted review text, not the layout.
//   2. Any REVIEW_n_TEXT / REVIEW_n_NAME in a starter JSON must carry a matching
//      REVIEW_n_SOURCE https URL — the live listing the text was copied from verbatim.
//      Unsourced testimonial text on a page about a real named business is misleading
//      conduct under the Australian Consumer Law (ss 18, 29(1)(e)).
//
// Run from repo root: npm run starter:check-reviews   (also runs inside `npm test`)
// Self-check:         node client-sites-starter/check-reviews.mjs --selftest
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const STARTER_DIR = dirname(fileURLToPath(import.meta.url));
const REVIEW_FIELD = /^REVIEW_(\d+)_(TEXT|NAME)$/;
// A quote character touching a review token means the layout is doing the quoting.
const LAYOUT_QUOTED_TOKEN = /["'“”‘’«»]\s*\{\{\s*REVIEW_\d+_(?:TEXT|NAME)\s*\}\}|\{\{\s*REVIEW_\d+_(?:TEXT|NAME)\s*\}\}\s*["'“”‘’«»]/g;

/** Review fields with no matching REVIEW_n_SOURCE https URL. */
export function findUnsourcedReviews(data) {
  return Object.entries(data)
    .filter(([key, value]) => REVIEW_FIELD.test(key) && String(value ?? "").trim() !== "")
    .filter(([key]) => !/^https:\/\/\S+$/.test(String(data[`REVIEW_${REVIEW_FIELD.exec(key)[1]}_SOURCE`] ?? "").trim()))
    .map(([key]) => key);
}

/** Review tokens the markup wraps in quote characters. */
export function findLayoutQuotedTokens(html) {
  return html.match(LAYOUT_QUOTED_TOKEN) ?? [];
}

if (process.argv.includes("--selftest")) {
  assert.deepEqual(findUnsourcedReviews({ REVIEW_1_TEXT: "Fixed our burst pipe at 2am." }), ["REVIEW_1_TEXT"]);
  assert.deepEqual(findUnsourcedReviews({ REVIEW_1_TEXT: "x", REVIEW_1_SOURCE: "not-a-url" }), ["REVIEW_1_TEXT"]);
  assert.deepEqual(findUnsourcedReviews({ REVIEW_1_TEXT: "x", REVIEW_1_SOURCE: "https://maps.app.goo.gl/abc" }), []);
  assert.deepEqual(findUnsourcedReviews({ _reviews_note: "do not write a review" }), []);
  assert.equal(findLayoutQuotedTokens(`<blockquote>"{{REVIEW_1_TEXT}}"</blockquote>`).length, 1);
  assert.equal(findLayoutQuotedTokens(`<figcaption>{{REVIEW_1_NAME}}”</figcaption>`).length, 1);
  assert.equal(findLayoutQuotedTokens(`<blockquote>{{REVIEW_1_TEXT}}</blockquote>`).length, 0);
  console.log("ok - check-reviews selftest");
  process.exit(0);
}

// ponytail: one level of prospect folders is the whole layout today; deepen if it nests.
const jsonFiles = [
  join(STARTER_DIR, "content.example.json"),
  ...readdirSync(join(STARTER_DIR, "prospects"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(join(STARTER_DIR, "prospects", entry.name))
      .filter((file) => file.endsWith(".json"))
      .map((file) => join(STARTER_DIR, "prospects", entry.name, file))),
];

const failures = [];
const show = (file) => relative(process.cwd(), file);

for (const token of findLayoutQuotedTokens(readFileSync(join(STARTER_DIR, "index.html"), "utf8"))) {
  failures.push(`${show(join(STARTER_DIR, "index.html"))}: layout supplies the quote characters around ${token.trim()} — any value substituted in renders as a customer quotation`);
}

for (const file of jsonFiles) {
  for (const field of findUnsourcedReviews(JSON.parse(readFileSync(file, "utf8")))) {
    failures.push(`${show(file)}: ${field} has no REVIEW_n_SOURCE https URL — paste verbatim text from the live listing and cite it, or delete the field`);
  }
}

if (failures.length) {
  console.error(`FAIL - unsourced testimonial risk in client-sites-starter (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`ok - client-sites-starter reviews: template quotes nothing, ${jsonFiles.length} content files carry no unsourced testimonial`);
