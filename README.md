# Webuildco_v1

Source for the WeBuild Co marketing site, **https://www.webuildco.com.au/**.

Static Tailwind v4 build, served from a Cloudflare **Worker** (`webuild`, environment
`production`) — not Pages. Deploys run through Workers Builds on push to `main`.
Architecture, the deploy pipeline, and the branch guard are documented in `CLAUDE.md`;
read that before pushing.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Branch guard, then compile `src/app.css` → `app.css` |
| `npm test` | Full repo test suite (worker, proof numbers, branch guard, tooling, uptime checker) |
| `npm run serve` | Serve the built site on `localhost:8000` |

## Monitoring

| | |
| --- | --- |
| **What is monitored** | `https://www.webuildco.com.au/` returns HTTP 200 **and** still serves a parseable schema.org JSON-LD block |
| **Monitor** | GitHub Actions workflow `.github/workflows/uptime.yml`, running `tools/uptime/check.mjs` |
| **Schedule** | `*/5 * * * *` (GitHub's shortest interval) |
| **Cost** | Free — Actions minutes are unmetered on public repos. No third-party account, no card |
| **Alert channel** | A failed workflow run. GitHub emails the account that last edited the workflow file; the run is also visible at [Actions → uptime](https://github.com/048823/Webuildco_v1/actions/workflows/uptime.yml). Confirm under GitHub **Settings → Notifications → Actions** that email is ticked |
| **Analytics** | Google Analytics 4, property `G-CML7HQ61XR`, tagged on 34 of 36 public pages |

The check asserts schema, not just reachability, because the failure that actually costs us
is a deploy that still returns 200 with the JSON-LD stripped: the site looks fine to a human
and silently stops being citable by search and AI crawlers. It retries 3× at 5s before
failing, so a single network flap does not raise an alert.

### Run it by hand

```sh
node tools/uptime/check.mjs                          # production homepage
node tools/uptime/check.mjs https://example.com/     # any URL; exits 1 with the reason
```

Or from the Actions tab: **uptime → Run workflow**, optionally with a URL to check.

### Activation (one-time, owner action)

The scheduler is **not live yet**. The agent GitHub token has no `workflow` OAuth scope, so it
cannot write anything under `.github/workflows/` — by push or by API. The workflow therefore
ships parked at `tools/uptime/uptime.workflow.yml`. Either route activates it:

```sh
# Route A — grant the scope once, then any agent run can finish it
gh auth refresh -h github.com -s workflow
```

Route B — no CLI: in the GitHub web UI, **Add file → Create new file**, name it
`.github/workflows/uptime.yml`, paste the contents of `tools/uptime/uptime.workflow.yml`,
commit to a branch and merge. The web UI is not scope-restricted.

Either way the file must reach `main`: GitHub only runs scheduled workflows from the default
branch. Delete the parked copy once the real one is in place.

### Escalation

1. **Alert fires.** Open the failed run. `unreachable` = the site is down; `schema` = the
   site is up but the JSON-LD is missing or malformed.
2. **Confirm it is real**, not a monitor fault: `curl -sI https://www.webuildco.com.au/`.
3. **Site down** → check the Cloudflare dashboard (Workers → `webuild` → production) for a
   bad deploy, and roll back to the last good version.
4. **Schema broken** → find the deploy that removed it (`git log -p index.html`) and revert.
   The site is serving, so this is urgent-but-not-outage.
5. **Cannot resolve within ~30 min** → escalate to the board on the WeBuild project.

### Known limits

- GitHub schedules are best-effort. Runs queue under platform load, so real cadence is
  roughly 5–20 minutes, not a guaranteed 5-minute heartbeat.
- GitHub disables scheduled workflows after 60 days with no repo activity, with a warning
  email first. This repo is active daily; if it ever goes quiet, re-enable from the Actions
  tab.
- The monitor runs on GitHub, which is independent of Cloudflare — but if GitHub Actions is
  down, so is the check.
- It watches the homepage only. Add URLs to the workflow if other pages start mattering.
