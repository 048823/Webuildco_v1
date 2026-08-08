#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseCsv, writeCsv } from './lib/csv.mjs';
import { normalizeDomain } from './lib/domain.mjs';
import { decodeHtmlEntities, htmlToVisibleText } from './lib/html.mjs';

const USER_AGENT = 'WeBuildCo-RegisterHarvester/1.0 (+https://webuildco.com.au)';
const REGISTER_COLUMNS = ['icp', 'input_source_class', 'source', 'domain', 'source_name', 'source_url', 'record_id', 'fetched_at', 'notes'];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const outDir = options.outDir ?? 'runs/registers';
  await mkdir(outDir, { recursive: true });

  const results = [];
  results.push(await runHarvester('rto-cricos', outDir, harvestCricos));
  results.push(await runHarvester('freight-fta', outDir, harvestFta));
  results.push(await runHarvester('property-vic-cav', outDir, harvestVicCav));
  results.push(await runHarvester('ndis-provider-finder', outDir, harvestNdisProviderFinder));

  const summary = {
    fetched_at: new Date().toISOString(),
    out_dir: outDir,
    sources: results.map(({ rows, ...rest }) => ({ ...rest, rows: rows.length })),
  };
  await writeFile(path.join(outDir, 'harvest-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

async function runHarvester(id, outDir, harvester) {
  try {
    const result = await harvester();
    const filePath = path.join(outDir, result.file);
    await writeCsv(filePath, result.rows, REGISTER_COLUMNS);
    return { id, status: result.status, file: filePath, notes: result.notes, rows: result.rows };
  } catch (error) {
    const fallback = {
      icp: sourceIcp(id),
      input_source_class: 'public_register',
      source: id,
      domain: '',
      source_name: '',
      source_url: '',
      record_id: '',
      fetched_at: new Date().toISOString(),
      notes: `harvest_failed: ${error.message}`,
    };
    const filePath = path.join(outDir, `${id}-domains.csv`);
    await writeCsv(filePath, [fallback], REGISTER_COLUMNS);
    return { id, status: 'failed', file: filePath, notes: error.message, rows: [fallback] };
  }
}

async function harvestCricos() {
  const fetchedAt = new Date().toISOString();
  const packageSearchUrl = 'https://data.gov.au/data/api/3/action/package_search?q=CRICOS%20institutions';
  const packageResponse = await fetchJson(packageSearchUrl);
  const packageRecord = packageResponse.result.results.find((entry) => entry.name === 'cricos') ?? packageResponse.result.results[0];
  const resource = packageRecord.resources.find((entry) => /institutions\.csv$/i.test(entry.url) || /CRICOS Institutions/i.test(entry.name));
  if (!resource) throw new Error('CRICOS institutions CSV resource not found');

  const csv = await fetchText(resource.url);
  const rows = parseCsv(csv)
    .map((record) => {
      const domain = normalizeDomain(record.Website);
      if (!domain) return null;
      return {
        icp: 'rto_education',
        input_source_class: 'public_register',
        source: 'CRICOS Institutions.csv',
        domain,
        source_name: record['Trading Name'] || record['Institution Name'] || '',
        source_url: resource.url,
        record_id: record['CRICOS Provider Code'] || '',
        fetched_at: fetchedAt,
        notes: record['Institution Capacity'] ? `institution_capacity=${record['Institution Capacity']}` : '',
      };
    })
    .filter(Boolean);

  return {
    status: 'ok',
    file: 'rto-education-domains.csv',
    rows: dedupeRows(rows),
    notes: `direct public CRICOS CSV via data.gov.au CKAN; ${rows.length} rows before domain dedupe`,
  };
}

async function harvestFta() {
  const fetchedAt = new Date().toISOString();
  const sourceUrl = 'https://ftalliance.com.au/members/freight-forwarding-customs-broker';
  const html = await fetchText(sourceUrl);
  const memberBlocks = html.match(/<div class=['"]mem-holder['"][\s\S]*?<\/div>\s*<\/div>/gi) ?? [];
  const rows = [];

  for (const [index, block] of memberBlocks.entries()) {
    const name = decodeHtmlEntities(block.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? '').trim();
    const website = decodeHtmlEntities(block.match(/title=['"]Website['"][\s\S]*?<a\b[^>]*href=['"]([^'"]+)['"]/i)?.[1] ?? '');
    const domain = normalizeDomain(website);
    if (!domain) continue;
    rows.push({
      icp: 'freight_customs',
      input_source_class: 'third_party_directory',
      source: 'Freight & Trade Alliance member directory',
      domain,
      source_name: htmlToVisibleText(name),
      source_url: sourceUrl,
      record_id: String(index + 1),
      fetched_at: fetchedAt,
      notes: '',
    });
  }

  return {
    status: 'ok',
    file: 'freight-customs-domains.csv',
    rows: dedupeRows(rows),
    notes: `server-rendered FTA freight-forwarding/customs-broker member directory; ${rows.length} rows before domain dedupe`,
  };
}

async function harvestVicCav() {
  const fetchedAt = new Date().toISOString();
  const publicPageUrl = 'https://www.consumer.vic.gov.au/licensing-and-registration/estate-agents/public-register';
  const registerSearchUrl = 'https://registers.consumer.vic.gov.au/EAsearch';
  await fetchText(publicPageUrl);
  const rows = [];

  rows.push({
    icp: 'property_management',
    input_source_class: 'public_register',
    source: 'Consumer Affairs Victoria estate agents public register',
    domain: '',
    source_name: '',
    source_url: registerSearchUrl,
    record_id: '',
    fetched_at: fetchedAt,
    notes: 'blocked: register search host robots.txt disallows automated crawling; provide a manual export/input file if CAV changes access terms',
  });

  return {
    status: 'blocked_by_robots',
    file: 'property-management-domains.csv',
    rows: dedupeRows(rows),
    notes: 'CAV public information page is readable; automated search harvesting is fenced off because the register host disallows crawling',
  };
}

async function harvestNdisProviderFinder() {
  const fetchedAt = new Date().toISOString();
  const sourceUrl = 'https://www.ndis.gov.au/participants/working-providers/finding-providers/provider-finder';
  const response = await fetch(sourceUrl, { headers: { 'user-agent': USER_AGENT, accept: 'text/html' } });
  const status = response.status === 401 || response.status === 403 || response.status === 429 ? 'bot_blocked' : 'unavailable';
  const rows = [{
    icp: 'ndis_allied_health',
    input_source_class: 'public_register',
    source: 'NDIA Provider Finder',
    domain: '',
    source_name: '',
    source_url: sourceUrl,
    record_id: '',
    fetched_at: fetchedAt,
    notes: `${status}: provider finder is public but Cloudflare/challenge-gated from this runtime; do not bypass with spoofing`,
  }];

  return {
    status,
    file: 'ndis-allied-health-domains.csv',
    rows,
    notes: 'NDIA Provider Finder carries website details, but this runtime receives a challenge response; harvester records the block instead of bypassing it',
  };
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/csv,application/json,*/*;q=0.1' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} fetching ${url}`);
  return response.text();
}

function dedupeRows(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = row.domain ? `${row.icp}|${row.domain}` : `${row.icp}|${row.source_url}|${row.notes}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()].sort((a, b) => a.icp.localeCompare(b.icp) || a.domain.localeCompare(b.domain));
}

function sourceIcp(id) {
  if (id.startsWith('rto')) return 'rto_education';
  if (id.startsWith('freight')) return 'freight_customs';
  if (id.startsWith('property')) return 'property_management';
  return 'ndis_allied_health';
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === 'help') {
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
  node tools/publication-crawler/harvest-registers.mjs --out-dir runs/registers

Outputs one CSV per ICP with: icp, input_source_class, source, domain, source_name, source_url, record_id, fetched_at, notes.
The tool refuses Customs Brokers Hub and records robots/bot blocks instead of bypassing them.
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
