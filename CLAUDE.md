# Webuildco_v1 — Project Context for Claude Code

## What this is
Live website for webuildco.com.au.
Static site hosted on GitHub (repo: Webuildco_v1) -> auto-deployed to Cloudflare **Workers**
(not Pages) via Workers Builds, the Cloudflare Git integration.

## Deploy pipeline — read this before you push anything

This is **not** Pages, and it is **not** main-only. Correcting a wrong line that stood here
until 07-Aug 2026 and misled every agent that read it (WEB-507).

- `webuildco.com.au` and `www.webuildco.com.au` are **Custom Domains bound to the Worker
  `webuild`, environment `production`**. A Custom Domain serves whatever version currently
  holds 100% of traffic.
- `wrangler.jsonc` declares `"name": "webuild"` and has no `routes`, no `env`, no
  `workers_dev`. **One Worker name means one deploy target.** There is no staging environment
  and no separate preview target for a build to land in.
- **A build on ANY branch deploys to production. Last build wins.** Not just `main`. Not just
  merged PRs. A push is enough — an open PR is not required, and a *draft* PR is not exempt.

Evidence, 2026-08-07: 8 of the last 10 production deployments came from a branch other than
`main`. Draft PR #46 (`agent/cto/8503987e`) took the apex at 23:19 UTC on 06-Aug;
`agent/cdo/proof-grid` took it at 02:17 UTC on 07-Aug while still unmerged. Worker versions
152-161 map 1:1 to all 10 deployments, each deployment 0.3-0.5s after its version upload.

**Consequence:** pushing to a feature branch is a production deploy. Treat every push to
every branch as `push = live`, and expect the site to silently revert to whatever built most
recently. Containment is tracked on WEB-507; until it lands, this section is current
behaviour, not history.

## Your job
When I ask for edits:
1. Make the changes to the relevant HTML/CSS/JS files.
2. Show me a short summary of what changed.
3. Stage, commit with a clear message, and push to main.
4. Confirm the push succeeded and remind me Cloudflare deploys in ~1-2 min.

## Acceptance standard — a live curl is NOT proof of merge

A `curl` against the live domain proves only what built most recently, which may be an
unmerged branch. It can pass *before* a merge and regress later with no commit and no
notification.

Acceptance requires **both**, together, in the same check:

1. the `curl` output showing the expected content, **and**
2. the commit SHA on `main` matching what is being served.

```sh
git fetch origin main
curl -s https://www.webuildco.com.au/ > /tmp/live.html
git show origin/main:index.html > /tmp/main.html
cmp /tmp/live.html /tmp/main.html && git rev-parse --short origin/main
```

Quote the SHA in the acceptance comment. "Verified live" on its own is not acceptance and
does not close an issue.

## Rules
- ALWAYS show me the diff/summary and ask for confirmation BEFORE pushing to main, since push = live production.
- The same applies to feature branches: a branch push deploys to production too. Confirm first.
- Use clear conventional commit messages (e.g. "fix: correct contact email", "feat: add services section").
- Never force-push. Never rewrite history on main.
- Flag structurally risky changes (deleting files, big rewrites) before committing.
- Keep changes minimal and scoped to what I asked.

## Useful commands
- Check status: git status
- See what changed: git diff
- Deploy: git add -A && git commit -m "msg" && git push origin main
