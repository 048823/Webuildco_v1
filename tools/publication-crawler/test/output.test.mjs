import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseCsv } from '../lib/csv.mjs';
import { EVIDENCE_RECORD_VERSION } from '../lib/evidence.mjs';
import { writeCrawlerOutputs } from '../lib/output.mjs';

test('output path excludes stale-version checkpoint rows and counts them in summary', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'web452-output-'));
  const output = path.join(tempDir, 'published.csv');
  const droppedOutput = path.join(tempDir, 'dropped.csv');
  const summaryOutput = path.join(tempDir, 'summary.json');
  const outputColumns = ['domain', 'email', 'evidence_record_version'];
  const droppedColumns = ['domain', 'email', 'evidence_record_version', 'drop_reason'];
  const inputRows = [
    { domain: 'old.example' },
    { domain: 'current.example' },
  ];
  const checkpoints = new Map([
    ['old.example', {
      version: '2026-08-03.web442',
      domain: 'old.example',
      rows: [{ domain: 'old.example', email: 'old@old.example', evidence_record_version: '2026-08-03.web442' }],
      dropped_rows: [],
      fetch_count: 1,
    }],
    ['current.example', {
      version: EVIDENCE_RECORD_VERSION,
      domain: 'current.example',
      rows: [{ domain: 'current.example', email: 'current@current.example', evidence_record_version: EVIDENCE_RECORD_VERSION }],
      dropped_rows: [],
      fetch_count: 1,
    }],
  ]);

  const summary = await writeCrawlerOutputs({
    inputRows,
    checkpoints,
    output,
    droppedOutput,
    summaryOutput,
    startedAt: new Date(),
    skipped: [],
    completedThisRun: 0,
    version: EVIDENCE_RECORD_VERSION,
    outputColumns,
    droppedColumns,
  });

  const rows = parseCsv(await readFile(output, 'utf8'));
  const summaryFromDisk = JSON.parse(await readFile(summaryOutput, 'utf8'));
  assert.deepEqual(rows.map((row) => row.email), ['current@current.example']);
  assert.equal(summary.stale_checkpoint_count, 1);
  assert.equal(summary.stale_checkpoint_rows_dropped, 1);
  assert.equal(summary.stale_checkpoint_versions['2026-08-03.web442'], 1);
  assert.equal(summaryFromDisk.stale_checkpoint_count, 1);
});
