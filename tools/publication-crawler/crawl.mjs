#!/usr/bin/env node
import { appendFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { classifyAddress, stemInContext } from './lib/classify.mjs';
import { readCsv, writeCsv } from './lib/csv.mjs';
import { emailDomain, hashRecord, normalizeDomain, normalizeUrlForFetch, safeFileKey, sameDomain } from './lib/domain.mjs';
import {
  buildCl42eToGMapping,
  EVIDENCE_RECORD_VERSION,
  normalizeInputSourceClass,
  resolvePublicationSourceClass,
} from './lib/evidence.mjs';
import { extractLinks, extractPublishedEmails, hasRestrictionText, htmlToVisibleText, looksUnrendered } from './lib/html.mjs';
import { writeCrawlerOutputs } from './lib/output.mjs';
import { RobotsCache } from './lib/robots.mjs';

const USER_AGENT = 'WeBuildCo-PublicationCrawler/1.0 (+https://webuildco.com.au)';
const VERSION = EVIDENCE_RECORD_VERSION;
const OUTPUT_COLUMNS = [
  'domain',
  'company_name',
  'email',
  'address_class',
  'source_class',
  'source_class_basis',
  'input_source_class',
  'publication_url',
  'source_url',
  'source_capture_timestamp',
  'publication_evidence',
  'published_context',
  'evidence_context',
  'evidence_method',
  'evidence_visibility',
  'anti_spam_statement_present',
  'anti_spam_statement_basis',
  'cl_4_2_e_to_g_mapping',
  'evidence_screenshot_ref',
  'evidence_screenshot_sha256',
  'evidence_record_version',
  'stem_in_context',
  'cl_4_2_d_verdict',
  'cl_4_2_d_basis',
  'crawled_at',
  'name_source',
  'source_row_id',
];
const DROPPED_COLUMNS = [
  'domain',
  'company_name',
  'email',
  'address_class',
  'source_class',
  'source_class_basis',
  'input_source_class',
  'publication_url',
  'source_url',
  'source_capture_timestamp',
  'publication_evidence',
  'published_context',
  'evidence_context',
  'evidence_method',
  'evidence_visibility',
  'anti_spam_statement_present',
  'anti_spam_statement_basis',
  'cl_4_2_e_to_g_mapping',
  'evidence_screenshot_ref',
  'evidence_screenshot_sha256',
  'evidence_record_version',
  'drop_reason',
  'cl_4_2_d_verdict',
  'cl_4_2_d_basis',
  'crawled_at',
  'source_row_id',
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.input) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const startedAt = new Date();
  const checkpointDir = options.checkpointDir ?? path.join(path.dirname(options.output ?? options.input), 'checkpoints');
  const output = options.output ?? path.join(path.dirname(options.input), 'published-addresses.csv');
  const droppedOutput = options.droppedOutput ?? path.join(path.dirname(output), 'dropped-addresses.csv');
  const summaryOutput = options.summaryOutput ?? path.join(path.dirname(output), 'summary.json');
  const manifest = options.manifest ?? path.join(path.dirname(output), 'manifest.jsonl');
  const robots = new RobotsCache({ userAgent: USER_AGENT });

  await mkdir(checkpointDir, { recursive: true });
  await mkdir(path.dirname(output), { recursive: true });

  const inputRows = normalizeInputRows(await readCsv(options.input));
  const checkpoints = await loadCheckpoints(checkpointDir);
  const pending = [];
  const skipped = [];

  for (const inputRow of inputRows) {
    const checkpoint = checkpoints.get(inputRow.domain);
    if (!options.force && checkpoint?.status === 'completed' && checkpoint.input_hash === inputRow.input_hash && checkpoint.version === VERSION) {
      skipped.push(inputRow.domain);
    } else {
      pending.push(inputRow);
    }
  }

  const runState = {
    completedThisRun: 0,
    stopRequested: false,
    stoppedBySignal: null,
  };

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      runState.stopRequested = true;
      runState.stoppedBySignal = signal;
      await appendManifest(manifest, {
        event: 'stopping',
        signal,
        stopped_at: new Date().toISOString(),
        completed_this_run: runState.completedThisRun,
      });
      setTimeout(() => process.exit(130), 200).unref();
    });
  }

  const fetcher = createPageFetcher({
    robots,
    timeoutMs: Number(options.timeoutMs ?? 12000),
    maxBytes: Number(options.maxBytes ?? 2_000_000),
  });

  await runQueue(pending, Number(options.concurrency ?? 8), async (inputRow) => {
    if (runState.stopRequested) return;
    const checkpoint = await crawlDomain(inputRow, {
      checkpointDir,
      fetcher,
      maxLinkedPages: Number(options.maxLinkedPages ?? 22),
      maxTermsPages: Number(options.maxTermsPages ?? 8),
      delayDomainMs: Number(options.delayDomainMs ?? 0),
    });
    runState.completedThisRun += 1;
    await appendManifest(manifest, toManifestRecord(checkpoint));

    if (options.stopAfterCompleted && runState.completedThisRun >= Number(options.stopAfterCompleted)) {
      await appendManifest(manifest, {
        event: 'stop_after_completed',
        stopped_at: new Date().toISOString(),
        completed_this_run: runState.completedThisRun,
      });
      process.exit(Number(options.exitCode ?? 130));
    }
  });

  const finalCheckpoints = await loadCheckpoints(checkpointDir);
  const summary = await writeCrawlerOutputs({
    inputRows,
    checkpoints: finalCheckpoints,
    output,
    droppedOutput,
    summaryOutput,
    startedAt,
    skipped,
    completedThisRun: runState.completedThisRun,
    version: VERSION,
    outputColumns: OUTPUT_COLUMNS,
    droppedColumns: DROPPED_COLUMNS,
  });

  console.log(JSON.stringify(summary, null, 2));
  if (summary.stale_checkpoint_count > 0) {
    console.error(`Refused ${summary.stale_checkpoint_count} stale checkpoint(s); rerun without interruption so every output row is ${VERSION}.`);
    process.exitCode = 2;
  }
}

async function crawlDomain(inputRow, context) {
  const { checkpointDir, fetcher, maxLinkedPages, maxTermsPages, delayDomainMs } = context;
  const startedAt = new Date();
  const fetches = [];
  const pages = [];
  const droppedRows = [];
  const allPublishedRows = [];
  const candidateUrls = buildCandidateUrls(inputRow);
  const fetchedUrls = new Set();
  let homepageHtml = '';
  let observedUnrendered = false;
  let observedBotBlocked = false;
  let observedRobotsDisallowed = false;
  let observedTimeout = false;
  let observedUnreachable = false;

  for (const url of candidateUrls) {
    const page = await fetchAndRecord(fetcher, url, fetches);
    if (!page.ok) {
      observedBotBlocked ||= page.failure_reason === 'bot_blocked';
      observedRobotsDisallowed ||= page.failure_reason === 'robots_disallowed';
      observedTimeout ||= page.failure_reason === 'timeout';
      observedUnreachable ||= page.failure_reason === 'unreachable';
      continue;
    }
    homepageHtml ||= page.html;
    pages.push(page);
    if (looksUnrendered(page.html)) observedUnrendered = true;
    break;
  }

  if (pages.length > 0) {
    const discovered = [
      ...buildCommonContentUrls(inputRow.domain),
      ...chooseDiscoveryLinks({
      inputDomain: inputRow.domain,
      links: pages.flatMap((page) => extractLinks(page.html, page.final_url)),
      maxLinkedPages,
      }),
    ];
    for (const url of discovered) {
      if (fetchedUrls.has(url) || pages.some((page) => page.final_url === url)) continue;
      fetchedUrls.add(url);
      const page = await fetchAndRecord(fetcher, url, fetches);
      if (!page.ok) {
        observedBotBlocked ||= page.failure_reason === 'bot_blocked';
        observedRobotsDisallowed ||= page.failure_reason === 'robots_disallowed';
        observedTimeout ||= page.failure_reason === 'timeout';
        observedUnreachable ||= page.failure_reason === 'unreachable';
        continue;
      }
      if (looksUnrendered(page.html)) observedUnrendered = true;
      pages.push(page);
    }
  }

  for (const page of pages) {
    const antiSpamStatementPresent = hasRestrictionText(htmlToVisibleText(page.html));
    for (const found of extractPublishedEmails(page.html, page.final_url)) {
      if (!sameDomain(emailDomain(found.email), inputRow.domain)) continue;
      const addressClass = classifyAddress(found.email);
      const stemInContextValue = stemInContext(found.email, found.evidence_context);
      const sourceClass = resolvePublicationSourceClass(inputRow, found.publication_url);
      const row = {
        domain: inputRow.domain,
        company_name: inputRow.company_name,
        email: found.email,
        address_class: addressClass,
        source_class: sourceClass.source_class,
        source_class_basis: sourceClass.source_class_basis,
        input_source_class: normalizeInputSourceClass(inputRow),
        publication_url: found.publication_url,
        source_url: found.publication_url,
        source_capture_timestamp: page.fetched_at,
        publication_evidence: found.publication_evidence,
        published_context: found.evidence_context,
        evidence_context: found.evidence_context,
        evidence_method: found.evidence_method,
        evidence_visibility: found.evidence_visibility,
        anti_spam_statement_present: antiSpamStatementPresent ? 'yes' : 'no',
        anti_spam_statement_basis: antiSpamStatementPresent
          ? `restriction text detected on publication page: ${page.final_url}`
          : 'no restriction text detected on publication page',
        cl_4_2_e_to_g_mapping: buildCl42eToGMapping({ addressClass, stemInContextValue }),
        evidence_screenshot_ref: '',
        evidence_screenshot_sha256: '',
        evidence_record_version: EVIDENCE_RECORD_VERSION,
        stem_in_context: stemInContextValue,
        cl_4_2_d_verdict: '',
        cl_4_2_d_basis: '',
        crawled_at: new Date().toISOString(),
        name_source: inputRow.first_name || inputRow.last_name ? 'aleads' : 'needs_enrichment',
        source_row_id: inputRow.source_row_id,
      };
      allPublishedRows.push(row);
    }
  }

  const uniqueRows = dedupeRows(allPublishedRows);
  const termsVerdict = uniqueRows.length
    ? await checkCl42d({
        domain: inputRow.domain,
        pages,
        homepageHtml,
        fetcher,
        fetches,
        maxTermsPages,
      })
    : { verdict: '', basis: '' };

  const rows = [];
  for (const row of uniqueRows) {
    const withVerdict = {
      ...row,
      cl_4_2_d_verdict: termsVerdict.verdict,
      cl_4_2_d_basis: termsVerdict.basis,
    };
    if (withVerdict.address_class === 'junk') {
      droppedRows.push(toDroppedRow(withVerdict, 'artifact address, not a usable publication target'));
    } else if (withVerdict.source_class === 'unclassified') {
      droppedRows.push(toDroppedRow(withVerdict, 'publication source class unclassified'));
    } else if (withVerdict.cl_4_2_d_verdict === 'restricted') {
      droppedRows.push(toDroppedRow(withVerdict, 'cl 4(2)(d) restricted'));
    } else if (withVerdict.cl_4_2_d_verdict === 'unchecked') {
      droppedRows.push(toDroppedRow(withVerdict, 'cl 4(2)(d) unchecked'));
    } else {
      rows.push(withVerdict);
    }
  }

  let status = 'completed';
  let failureReason = '';
  if (pages.length === 0) {
    if (observedBotBlocked) failureReason = 'bot_blocked';
    else if (observedRobotsDisallowed) failureReason = 'robots_disallowed';
    else if (observedTimeout) failureReason = 'timeout';
    else failureReason = observedUnreachable ? 'unreachable' : 'unreachable';
    status = 'completed';
  } else if (uniqueRows.length === 0) {
    failureReason = observedUnrendered ? 'unrendered' : 'no_published_address';
  }

  const checkpoint = {
    version: VERSION,
    status,
    domain: inputRow.domain,
    input_hash: inputRow.input_hash,
    input: inputRow,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    elapsed_ms: Date.now() - startedAt.getTime(),
    failure_reason: failureReason,
    fetch_count: fetches.length,
    pages_crawled: pages.length,
    rows,
    dropped_rows: droppedRows,
    all_published_rows: uniqueRows.map((row) => ({
      ...row,
      cl_4_2_d_verdict: termsVerdict.verdict,
      cl_4_2_d_basis: termsVerdict.basis,
    })),
    fetches,
  };

  await writeCheckpoint(checkpointDir, checkpoint);
  if (delayDomainMs > 0) await new Promise((resolve) => setTimeout(resolve, delayDomainMs));
  return checkpoint;
}

async function checkCl42d({ domain, pages, homepageHtml, fetcher, fetches, maxTermsPages }) {
  for (const page of pages) {
    if (hasRestrictionText(htmlToVisibleText(page.html))) {
      return { verdict: 'restricted', basis: `restriction text on publication page: ${page.final_url}` };
    }
  }

  const candidates = chooseTermsLinks({ domain, pages, homepageHtml, maxTermsPages });
  let unreadable = 0;
  let readable = 0;
  for (const url of candidates) {
    const page = await fetchAndRecord(fetcher, url, fetches);
    if (!page.ok) {
      unreadable += 1;
      continue;
    }
    readable += 1;
    if (hasRestrictionText(htmlToVisibleText(page.html))) {
      return { verdict: 'restricted', basis: `restriction text in terms/privacy document: ${page.final_url}` };
    }
  }

  if (unreadable > 0 && readable === 0) {
    return { verdict: 'unchecked', basis: `${unreadable} terms/privacy candidate(s) found but unreadable` };
  }
  if (readable > 0) {
    return { verdict: 'clear', basis: `no restriction on publication page; ${readable} terms/privacy doc(s) read clean` };
  }
  return { verdict: 'clear', basis: 'no restriction on publication page; no privacy/terms document findable on this domain' };
}

function buildCandidateUrls(inputRow) {
  const base = normalizeDomain(inputRow.domain);
  const urls = [
    `https://${base}/`,
    `https://www.${base}/`,
    `http://${base}/`,
    `http://www.${base}/`,
  ];
  return inputRow.start_url ? [inputRow.start_url, ...urls] : urls;
}

function buildCommonContentUrls(domain) {
  const base = normalizeDomain(domain);
  return [
    `https://${base}/contact`,
    `https://${base}/contact-us`,
    `https://${base}/about`,
    `https://${base}/about-us`,
    `https://${base}/team`,
    `https://${base}/people`,
    `https://${base}/staff`,
    `https://${base}/our-team`,
  ];
}

function chooseDiscoveryLinks({ inputDomain, links, maxLinkedPages }) {
  const scored = [];
  for (const url of links) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (!sameDomain(parsed.hostname, inputDomain)) continue;
    if (/\.(pdf|zip|jpg|jpeg|png|gif|webp|svg|doc|docx|xls|xlsx)$/i.test(parsed.pathname)) continue;
    const score = scorePath(parsed.pathname);
    if (score > 0) scored.push({ url, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, maxLinkedPages)
    .map((entry) => entry.url);
}

function chooseTermsLinks({ domain, pages, homepageHtml, maxTermsPages }) {
  const links = new Set();
  for (const page of pages) {
    for (const link of extractLinks(page.html, page.final_url)) {
      if (sameDomain(new URL(link).hostname, domain) && scoreTermsPath(new URL(link).pathname) > 0) {
        links.add(link);
      }
    }
  }
  if (homepageHtml) {
    for (const link of extractLinks(homepageHtml, `https://${domain}/`)) {
      if (sameDomain(new URL(link).hostname, domain) && scoreTermsPath(new URL(link).pathname) > 0) {
        links.add(link);
      }
    }
  }
  for (const common of ['/privacy', '/privacy-policy', '/terms', '/terms-and-conditions', '/legal', '/acceptable-use-policy']) {
    links.add(`https://${domain}${common}`);
  }
  return [...links].slice(0, maxTermsPages);
}

function scorePath(pathname) {
  const path = pathname.toLowerCase();
  if (/contact|about|team|staff|people|lawyer|agent|consultant|advisor|adviser|office|location/.test(path)) return 10;
  if (/service|practice|migration|visa|recruit|education|ndis|property/.test(path)) return 4;
  if (/privacy|terms|legal|cookie|blog|news/.test(path)) return 0;
  return path === '/' ? 0 : 1;
}

function scoreTermsPath(pathname) {
  return /privacy|terms|legal|conditions|acceptable|disclaimer|policy/i.test(pathname) ? 10 : 0;
}

async function fetchAndRecord(fetcher, url, fetches) {
  const result = await fetcher(url);
  const fetchedAt = new Date().toISOString();
  const page = { ...result, fetched_at: fetchedAt };
  fetches.push({
    url,
    final_url: result.final_url,
    status: result.status,
    ok: result.ok,
    failure_reason: result.failure_reason,
    bytes: result.bytes,
    fetched_at: fetchedAt,
  });
  return page;
}

function createPageFetcher({ robots, timeoutMs, maxBytes }) {
  return async (url) => {
    const startedAt = Date.now();
    const target = normalizeUrlForFetch(url);
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return failure(target, 'unreachable', 0, target);
    }

    if (!(await robots.canFetch(parsed.toString()))) {
      return failure(parsed.toString(), 'robots_disallowed', 0, parsed.toString());
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(parsed.toString(), {
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'user-agent': USER_AGENT,
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') ?? '';
      const status = response.status;
      if (status === 401 || status === 403 || status === 429) {
        return failure(parsed.toString(), 'bot_blocked', status, response.url);
      }
      if (!response.ok) {
        return failure(parsed.toString(), 'unreachable', status, response.url);
      }
      if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
        return failure(parsed.toString(), 'non_html', status, response.url);
      }
      const html = await readLimitedText(response, maxBytes);
      return {
        ok: true,
        status,
        requested_url: parsed.toString(),
        final_url: response.url,
        html,
        bytes: Buffer.byteLength(html),
        elapsed_ms: Date.now() - startedAt,
      };
    } catch (error) {
      const reason = error?.name === 'AbortError' ? 'timeout' : 'unreachable';
      return failure(parsed.toString(), reason, 0, parsed.toString());
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function readLimitedText(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) break;
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function failure(requestedUrl, failureReason, status, finalUrl) {
  return {
    ok: false,
    status,
    requested_url: requestedUrl,
    final_url: finalUrl,
    html: '',
    bytes: 0,
    failure_reason: failureReason,
  };
}

function normalizeInputRows(rows) {
  return rows
    .map((row, index) => {
      const domain = normalizeDomain(row.domain ?? row.company_domain ?? row.website ?? row.url ?? row.email);
      if (!domain) return null;
      const normalized = {
        ...row,
        source_row_id: row.source_row_id || String(index + 1),
        domain,
        start_url: row.start_url || row.url || '',
        company_name: row.company_name || row.company || row['Institution Name'] || row.name || '',
        first_name: row.first_name || '',
        last_name: row.last_name || '',
      };
      normalized.input_hash = hashRecord(normalized);
      return normalized;
    })
    .filter(Boolean);
}

function dedupeRows(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.domain}|${row.email}|${row.publication_url}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.email.localeCompare(b.email));
}

function toDroppedRow(row, dropReason) {
  return {
    domain: row.domain,
    company_name: row.company_name,
    email: row.email,
    address_class: row.address_class,
    source_class: row.source_class,
    source_class_basis: row.source_class_basis,
    input_source_class: row.input_source_class,
    publication_url: row.publication_url,
    source_url: row.source_url,
    source_capture_timestamp: row.source_capture_timestamp,
    publication_evidence: row.publication_evidence,
    published_context: row.published_context,
    evidence_context: row.evidence_context,
    evidence_method: row.evidence_method,
    evidence_visibility: row.evidence_visibility,
    anti_spam_statement_present: row.anti_spam_statement_present,
    anti_spam_statement_basis: row.anti_spam_statement_basis,
    cl_4_2_e_to_g_mapping: row.cl_4_2_e_to_g_mapping,
    evidence_screenshot_ref: row.evidence_screenshot_ref,
    evidence_screenshot_sha256: row.evidence_screenshot_sha256,
    evidence_record_version: row.evidence_record_version,
    drop_reason: dropReason,
    cl_4_2_d_verdict: row.cl_4_2_d_verdict,
    cl_4_2_d_basis: row.cl_4_2_d_basis,
    crawled_at: row.crawled_at,
    source_row_id: row.source_row_id,
  };
}

async function writeCheckpoint(checkpointDir, checkpoint) {
  const filePath = path.join(checkpointDir, `${safeFileKey(checkpoint.domain)}.json`);
  await writeFile(`${filePath}.tmp`, JSON.stringify(checkpoint, null, 2), 'utf8');
  await rename(`${filePath}.tmp`, filePath);
}

async function loadCheckpoints(checkpointDir) {
  const checkpoints = new Map();
  let entries = [];
  try {
    entries = await readdir(checkpointDir);
  } catch {
    return checkpoints;
  }
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    try {
      const checkpoint = JSON.parse(await readFile(path.join(checkpointDir, entry), 'utf8'));
      if (checkpoint.domain) checkpoints.set(checkpoint.domain, checkpoint);
    } catch {
      // A half-written or hand-edited checkpoint should not poison resume.
    }
  }
  return checkpoints;
}

async function appendManifest(manifest, record) {
  await mkdir(path.dirname(manifest), { recursive: true });
  await appendFile(manifest, `${JSON.stringify(record)}\n`, 'utf8');
}

function toManifestRecord(checkpoint) {
  return {
    event: 'domain_completed',
    domain: checkpoint.domain,
    status: checkpoint.status,
    failure_reason: checkpoint.failure_reason,
    rows: checkpoint.rows.length,
    dropped_rows: checkpoint.dropped_rows.length,
    fetch_count: checkpoint.fetch_count,
    started_at: checkpoint.started_at,
    completed_at: checkpoint.completed_at,
    checkpoint: `${safeFileKey(checkpoint.domain)}.json`,
  };
}

async function runQueue(items, concurrency, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === 'force' || key === 'help') {
      options[key] = true;
    } else {
      options[key] = args[index + 1];
      index += 1;
    }
  }
  return options;
}

function printHelp() {
  console.log(`
Usage:
  node tools/publication-crawler/crawl.mjs --input domains.csv --output runs/published-addresses.csv [options]

Options:
  --checkpoint-dir <dir>      Per-domain JSON checkpoints. Default: output dir/checkpoints
  --manifest <file>           Append-only JSONL run manifest. Default: output dir/manifest.jsonl
  --dropped-output <file>     CSV for restricted/unchecked/junk rows.
  --summary-output <file>     JSON summary with throughput and failure breakdown.
  --concurrency <n>           Concurrent domains. Default: 8
  --max-linked-pages <n>      Same-domain links to fetch beyond homepage/common pages. Default: 22
  --timeout-ms <n>            Per-request timeout. Default: 12000
  --force                     Ignore existing checkpoints and re-fetch.
  --stop-after-completed <n>  Test hook: exit after n new domain checkpoints.
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
