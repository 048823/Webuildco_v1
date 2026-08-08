# Publication Provenance Crawler

Durable rebuild for WEB-442. It turns a domain list into publication-provenance rows for Spam Act Sch 2 cl 4(2) workflows.

## Crawler

```bash
node tools/publication-crawler/crawl.mjs \
  --input tools/publication-crawler/fixtures/web400-smoke-50.csv \
  --output runs/web442-smoke/published-addresses.csv \
  --dropped-output runs/web442-smoke/dropped-addresses.csv \
  --summary-output runs/web442-smoke/summary.json \
  --manifest runs/web442-smoke/manifest.jsonl \
  --checkpoint-dir runs/web442-smoke/checkpoints \
  --concurrency 8
```

`fixtures/web400-smoke-50.csv` is synthetic (WEB-514). It holds 50 RFC 2606 reserved
`*.example.com` domains, so the smoke run exercises plumbing — argument parsing,
concurrency, checkpointing, output shape — and not crawl accuracy. The reserved domains
do not resolve, so every row is expected to come back unreachable. Real prospect lists
are personal data: keep them in `runs/` (gitignored) and never commit one to this
public repo.

The crawler writes one JSON checkpoint per domain and appends a JSONL manifest as it goes. Re-running the same command resumes from checkpoints and skips completed domains unless `--force` is passed.

Output rows always carry `publication_url`; no URL means no row. Rows are tagged with `address_class` (`named_individual`, `role`, `branch`, `junk`) before filtering. `restricted`, `unchecked`, and `junk` rows go to `dropped-addresses.csv`; clear published rows go to the main output so the legal branch is a downstream `WHERE address_class ...` filter.

The extraction deliberately excludes `<script>` blocks, JSON-LD, hidden attributes, and `aria-label`. Cloudflare `data-cfemail` and `/cdn-cgi/l/email-protection` are deobfuscated and counted because Cloudflare renders those to readers.

## Registers

```bash
node tools/publication-crawler/harvest-registers.mjs --out-dir runs/web442-registers
```

Outputs one CSV per ICP with `icp`, `source`, `domain`, `source_name`, `source_url`, `record_id`, `fetched_at`, and `notes`.

Current source behavior:

- RTO / education: CRICOS Institutions CSV via `data.gov.au` CKAN.
- Freight / customs: FTA freight-forwarding/customs-broker member directory.
- Property management: CAV is recorded as blocked for automated harvesting when the register host disallows or fails; provide a manual export if access terms change.
- NDIS / allied health: NDIA Provider Finder is recorded as bot-blocked when this runtime receives a challenge; the tool does not bypass Cloudflare.

The harvester never scrapes Customs Brokers Hub.
