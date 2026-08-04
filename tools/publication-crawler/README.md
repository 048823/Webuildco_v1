# Publication Provenance Crawler

Durable rebuild for WEB-442, updated for WEB-452. It turns a domain list into per-address publication-provenance rows for Spam Act Sch 2 cl 4(2) workflows.

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

The crawler writes one JSON checkpoint per domain and appends a JSONL manifest as it goes. Re-running the same command resumes from checkpoints and skips completed domains unless `--force` is passed.

Output rows always carry `publication_url`; no URL means no row. Rows are tagged with `address_class` (`named_individual`, `role`, `branch`, `junk`) before filtering. `restricted`, `unchecked`, and `junk` rows go to `dropped-addresses.csv`; clear published rows go to the main output so the legal branch is a downstream `WHERE address_class ...` filter.

## Evidence schema

Each accepted or dropped address row carries the evidence needed to defend that row individually, not just the list:

| Column | Meaning |
|---|---|
| `publication_url` / `source_url` | The exact page where the address was observed. |
| `source_capture_timestamp` | Timestamp for the page fetch that produced the address. |
| `publication_evidence` | The address string as extracted from the visible page or rendered Cloudflare email. |
| `published_context` | The surrounding role/context text visible on the page at capture time. |
| `anti_spam_statement_present` | `yes` if the publication page itself contains detected anti-spam/restriction text; otherwise `no`. |
| `anti_spam_statement_basis` | The page-level basis for that flag. Terms/privacy restrictions still flow through `cl_4_2_d_verdict` and `cl_4_2_d_basis`. |
| `cl_4_2_e_to_g_mapping` | JSON envelope saying which of cl 4(2)(e), (f) or (g) is a candidate for this `address_class`, plus the fact that campaign-message relevance is not assessed by the crawler. |
| `source_class` | Where the address was published: `organisation_own_site`, `public_register`, `third_party_directory`, `aggregated_list`, or `unclassified`. Same-domain pages default to `organisation_own_site`; off-domain starts must supply `publication_source_class` or `address_source_class` in the input. |
| `input_source_class` | Optional separate provenance for how the domain entered the manifest. Register harvesters set this, but it is not a substitute for `source_class`. |
| `evidence_screenshot_ref` / `evidence_screenshot_sha256` | Blank placeholders so screenshots can be attached later without a schema migration. |
| `evidence_record_version` | Evidence schema version. Current value: `2026-08-04.web452.2`. |

`source_class` deliberately keeps organisation-owned pages, public registers, third-party directories, aggregated lists and unclassified sources separate. Do not collapse them into a generic "published online" bucket at export time. `unclassified` rows are dropped from the accepted CSV until the publication source has been classified.

## s 22 factual position for counsel

Primary source checked: Spam Act 2003 on the Federal Register of Legislation, current compilation C2016C00614 at <https://www.legislation.gov.au/C2004A01214/latest/text>.

This is a factual description of the tool, not a legal conclusion:

1. The crawler is internal software designed to read public internet pages, extract electronic addresses visible to a reader, and compile rows for later outbound-consent review.
2. The crawler operates automatically once given an input manifest. It is not a manual page-by-page review. Human review happens downstream, before export or sending.
3. It fetches public HTML/plain text only, checks robots.txt, does not authenticate, does not bypass bot challenges, and does not use a headless browser for JavaScript-rendered pages.
4. It excludes JSON-LD, `<script>` blocks, hidden attributes and `aria-label` evidence. It includes plain visible text, `mailto:` links and Cloudflare-protected addresses because those are rendered to a reader.
5. It writes per-domain JSON checkpoints, a manifest and CSV outputs. It does not send messages, write to Instantly/A-Leads, spend credits, or contact any organisation.
6. The register harvester is also automated. It reads public CRICOS data and the FTA member directory, records CAV/NDIA blocks, and does not touch Customs Brokers Hub.
7. The downstream consent architecture is outside this tool. The tool now records the facts needed for a later `source_class`, `address_class`, `cl_4_2_d_verdict` and message-relevance filter, but it does not decide that any row is sendable.

Operational gate: do not run production crawls from older checkpoints or older crawler versions. Production evidence rows must be generated by `evidence_record_version = 2026-08-04.web452.2` or later so every row has per-address provenance. If stale checkpoints are present, the crawler writes only current-version rows, records `stale_checkpoint_count`, `stale_checkpoint_rows_dropped` and `stale_checkpoint_versions` in the summary, and exits non-zero.

The extraction deliberately excludes `<script>` blocks, JSON-LD, hidden attributes, and `aria-label`. Cloudflare `data-cfemail` and `/cdn-cgi/l/email-protection` are deobfuscated and counted because Cloudflare renders those to readers.

## Registers

```bash
node tools/publication-crawler/harvest-registers.mjs --out-dir runs/web442-registers
```

Outputs one CSV per ICP with `icp`, `input_source_class`, `source`, `domain`, `source_name`, `source_url`, `record_id`, `fetched_at`, and `notes`.

Current source behavior:

- RTO / education: CRICOS Institutions CSV via `data.gov.au` CKAN.
- Freight / customs: FTA freight-forwarding/customs-broker member directory.
- Property management: CAV is recorded as blocked for automated harvesting when the register host disallows or fails; provide a manual export if access terms change.
- NDIS / allied health: NDIA Provider Finder is recorded as bot-blocked when this runtime receives a challenge; the tool does not bypass Cloudflare.

The harvester never scrapes Customs Brokers Hub.
