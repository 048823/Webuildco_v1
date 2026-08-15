import test from "node:test";
import assert from "node:assert/strict";
import { findSchemaProblems } from "./check.mjs";

const VALID = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "WeBuild Co",
  url: "https://www.webuildco.com.au/",
});

const page = (head) => `<!doctype html><html><head>${head}</head><body><h1>WeBuild Co</h1></body></html>`;
const block = (json) => `<script type="application/ld+json">${json}</script>`;

test("passes on the shape the homepage ships today", () => {
  assert.deepEqual(findSchemaProblems(page(block(VALID))), []);
});

test("passes when the block is an array or a @graph wrapper", () => {
  assert.deepEqual(findSchemaProblems(page(block(`[${VALID}]`))), []);
  assert.deepEqual(findSchemaProblems(page(block(JSON.stringify({ "@graph": [JSON.parse(VALID)] })))), []);
});

// The regression this monitor exists to catch: a deploy that still returns 200
// with the page looking fine, but the schema block gone.
test("fails when a deploy strips the JSON-LD block", () => {
  const problems = findSchemaProblems(page("<title>WeBuild Co</title>"));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no <script type="application\/ld\+json">/);
});

test("fails when the JSON-LD block is present but malformed", () => {
  const problems = findSchemaProblems(page(block('{"@context": "https://schema.org",,}')));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /does not parse as JSON/);
});

test("fails when the block parses but carries no usable schema.org node", () => {
  const problems = findSchemaProblems(page(block(JSON.stringify({ "@type": "ProfessionalService", name: "WeBuild Co" }))));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no node carries a schema.org @context/);
});
