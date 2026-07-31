# Webuildco_v1 — Project Context for Claude Code

## What this is
Live website for webuildco.com.au.
Static site hosted on GitHub (repo: Webuildco_v1) -> auto-deployed to Cloudflare Pages on push to main.

## Deploy pipeline
GitHub main branch -> Cloudflare Pages (Git integration).
Any commit pushed to main triggers an automatic production deploy. Push = live. There is no manual deploy step.

## Your job
When I ask for edits:
1. Make the changes to the relevant HTML/CSS/JS files.
2. Show me a short summary of what changed.
3. Stage, commit with a clear message, and push to main.
4. Confirm the push succeeded and remind me Cloudflare deploys in ~1-2 min.

## Rules
- ALWAYS show me the diff/summary and ask for confirmation BEFORE pushing to main, since push = live production.
- Use clear conventional commit messages (e.g. "fix: correct contact email", "feat: add services section").
- Never force-push. Never rewrite history on main.
- Flag structurally risky changes (deleting files, big rewrites) before committing.
- Keep changes minimal and scoped to what I asked.

## Useful commands
- Check status: git status
- See what changed: git diff
- Deploy: git add -A && git commit -m "msg" && git push origin main
