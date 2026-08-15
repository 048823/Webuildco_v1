# Webuildco_v1 — Project Context for Claude Code

## What this is
Live website for webuildco.com.au.
Static site hosted on GitHub (repo: Webuildco_v1) -> auto-deployed to Cloudflare **Workers**
(not Pages) via Workers Builds, the Cloudflare Git integration.

## Deploy pipeline — read this before you push anything

This is **not** Pages. Deploys run through Workers Builds, the Cloudflare Git integration.

- `webuildco.com.au` and `www.webuildco.com.au` are **Custom Domains bound to the Worker
  `webuild`, environment `production`**. A Custom Domain serves whatever version currently
  holds 100% of traffic.
- `wrangler.jsonc` declares `"name": "webuild"` and has no `routes`, no `env`, no
  `workers_dev`. **One Worker name means one deploy target.** There is no staging environment
  and no separate preview target for a build to land in.

### Why feature branches were taking the apex (WEB-507, corrected WEB-515)

An earlier version of this section said "a build on ANY branch deploys to production" and
blamed Cloudflare. That was wrong, and it is deleted. Cloudflare's default for a
non-production branch is `npx wrangler versions upload` — it uploads a version and shifts
**no** traffic.

The real cause is one overridden field on our account: **Settings > Build > Non-production
branch deploy command**, changed from `versions upload` to a deploy. That single field is why
8 of the last 10 production deployments came from a branch other than `main` (draft PR #46
`agent/cto/8503987e` took the apex at 23:19 UTC 06-Aug; `agent/cdo/proof-grid` at 02:17 UTC
07-Aug while still unmerged). Correcting the field is board-gated and owned by Johan.

### The repo-side guard

`wrangler.jsonc` sets `build.command` to `npm run guard:branch`. Wrangler runs it before every
deploy and every `versions upload`, so it fires no matter how the dashboard build command is
configured. Inside Workers Builds (`$WORKERS_CI` set) any branch other than `main` exits 1 and
the build stops before the deploy step. Outside Workers Builds it is a no-op, so local builds
and `wrangler dev` are unaffected. Covered by `guard-branch.test.mjs`.

**The guard only protects branches that contain it.** A branch cut before it landed, or one
that never rebases onto `main`, still deploys to the apex on push. Rebase onto `main` before
pushing, and until the dashboard field is corrected treat any pre-guard branch as `push =
live`.

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
- Feature branches: confirm first too, unless the branch is rebased onto a `main` that carries
  the `guard:branch` check. Without the guard, a branch push is a production deploy.
- Use clear conventional commit messages (e.g. "fix: correct contact email", "feat: add services section").
- Never force-push. Never rewrite history on main.
- Flag structurally risky changes (deleting files, big rewrites) before committing.
- Keep changes minimal and scoped to what I asked.

## Useful commands
- Check status: git status
- See what changed: git diff
- Deploy: git add -A && git commit -m "msg" && git push origin main
