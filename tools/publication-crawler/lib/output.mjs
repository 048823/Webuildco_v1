import { writeFile } from 'node:fs/promises';
import { writeCsv } from './csv.mjs';

export async function writeCrawlerOutputs({
  inputRows,
  checkpoints,
  output,
  droppedOutput,
  summaryOutput,
  startedAt,
  skipped,
  completedThisRun,
  version,
  outputColumns,
  droppedColumns,
}) {
  const selected = selectOutputCheckpoints(inputRows, checkpoints, version);
  const rows = dedupeRows(selected.current.flatMap((checkpoint) => checkpoint.rows ?? []));
  const droppedRows = selected.current.flatMap((checkpoint) => checkpoint.dropped_rows ?? []);
  await writeCsv(output, rows, outputColumns);
  await writeCsv(droppedOutput, droppedRows, droppedColumns);

  const elapsedSeconds = Math.max(0.001, (Date.now() - startedAt.getTime()) / 1000);
  const statusBreakdown = countBy(selected.current, (checkpoint) => checkpoint.failure_reason || 'published_address_scan_completed');
  const fetchCount = selected.current.reduce((sum, checkpoint) => sum + Number(checkpoint.fetch_count ?? 0), 0);
  const staleRowsDropped = selected.stale.reduce((sum, checkpoint) => {
    return sum + Number((checkpoint.rows ?? []).length) + Number((checkpoint.dropped_rows ?? []).length);
  }, 0);
  const summary = {
    version,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    elapsed_seconds: Number(elapsedSeconds.toFixed(3)),
    input_domains: inputRows.length,
    completed_domains: selected.current.length,
    completed_this_run: completedThisRun,
    skipped_completed: skipped.length,
    domains_per_hour: Number(((completedThisRun || selected.current.length) / elapsedSeconds * 3600).toFixed(2)),
    fetch_count: fetchCount,
    fetches_per_domain: selected.current.length ? Number((fetchCount / selected.current.length).toFixed(2)) : 0,
    output_rows: rows.length,
    dropped_rows: droppedRows.length,
    stale_checkpoint_count: selected.stale.length,
    stale_checkpoint_rows_dropped: staleRowsDropped,
    stale_checkpoint_versions: countBy(selected.stale, (checkpoint) => checkpoint.version || 'missing_version'),
    failure_rate_breakdown: {
      unreachable: statusBreakdown.unreachable ?? 0,
      unrendered: statusBreakdown.unrendered ?? 0,
      bot_blocked: statusBreakdown.bot_blocked ?? 0,
      robots_disallowed: statusBreakdown.robots_disallowed ?? 0,
      no_published_address: statusBreakdown.no_published_address ?? 0,
    },
    smoke_report: buildSmokeReport(inputRows, selected.current),
    output,
    dropped_output: droppedOutput,
    summary_output: summaryOutput,
  };

  await writeFile(summaryOutput, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return summary;
}

export function selectOutputCheckpoints(inputRows, checkpoints, version) {
  const all = inputRows.map((row) => checkpoints.get(row.domain)).filter(Boolean);
  return {
    current: all.filter((checkpoint) => checkpoint.version === version),
    stale: all.filter((checkpoint) => checkpoint.version !== version),
  };
}

function buildSmokeReport(inputRows, checkpoints) {
  if (!inputRows.some((row) => row.expected_web400_verdict && row.expected_email)) return null;
  const byDomain = new Map(checkpoints.map((checkpoint) => [checkpoint.domain, checkpoint]));
  const rows = inputRows.map((row) => {
    const checkpoint = byDomain.get(row.domain);
    const foundExpectedEmail = (checkpoint?.all_published_rows ?? []).some((published) => published.email === String(row.expected_email).toLowerCase());
    let actual = 'NOT_PUBLISHED';
    if (foundExpectedEmail) {
      actual = 'PUBLISHED';
    } else if (['unreachable', 'timeout', 'bot_blocked', 'robots_disallowed'].includes(checkpoint?.failure_reason)) {
      actual = 'UNVERIFIABLE';
    }
    return {
      domain: row.domain,
      expected_email: row.expected_email,
      expected: row.expected_web400_verdict,
      actual,
      match: actual === row.expected_web400_verdict,
      failure_reason: checkpoint?.failure_reason ?? '',
    };
  });
  return {
    rows,
    total: rows.length,
    matched: rows.filter((row) => row.match).length,
    delta: rows.filter((row) => !row.match).length,
    by_expected: countBy(rows, (row) => row.expected),
    by_actual: countBy(rows, (row) => row.actual),
  };
}

function dedupeRows(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.domain}|${row.email}|${row.publication_url}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.email.localeCompare(b.email));
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
