#!/usr/bin/env node
// Pre-send gate CLI. Run this against a candidate send list before it is
// uploaded to any sending system. Exit 0 = clear, exit 1 = do not send.
//
//   node tools/suppression/check.mjs <candidates.csv|txt>
//
// Store path: $SUPPRESSION_STORE, default runs/suppression/suppression-list.json
// (runs/ is gitignored and .assetsignore'd — the list holds personal data and
// must never be committed or served).
import { readFileSync } from 'node:fs';
import { assertSendable, loadStore } from './lib/gate.mjs';

export const DEFAULT_STORE = 'runs/suppression/suppression-list.json';

// Any email-shaped token, wherever it sits in the file. Deliberately greedy:
// a candidate this misses is a candidate the gate never checks.
const EMAIL = /[^\s,;<>"']+@[^\s,;<>"']+\.[a-z]{2,}/gi;

export function readCandidates(path) {
  return [...new Set(readFileSync(path, 'utf8').match(EMAIL) ?? [])];
}

const [file] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!file) throw new Error('usage: node tools/suppression/check.mjs <candidates.csv|txt>');
  const storePath = process.env.SUPPRESSION_STORE || DEFAULT_STORE;
  const store = loadStore(storePath);
  const candidates = readCandidates(file);
  if (!candidates.length) throw new Error(`no addresses found in ${file} — refusing to report a send list as clear`);
  const checked = assertSendable(candidates, store);
  console.log(`clear to send: ${checked} address(es) checked against ${store.size} suppression entries (store generated ${store.generatedAt})`);
}
