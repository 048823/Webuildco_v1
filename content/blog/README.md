# Blog publishing pipeline — article contract

Drop a markdown file in this folder, run the build, commit, open a PR. Merge = live.

```
content/blog/my-post.md  →  npm run build  →  blog/my-post/index.html
                                              blog/index.html (listing)
                                              sitemap.xml (regenerated)
```

## Frontmatter contract (for the content engine / CMO)

Flat `key: value` pairs only — no YAML nesting.

```markdown
---
title: How AI agents cut admin hours          # required
description: Meta description, max 165 chars. # required
date: 2026-07-14                              # required, YYYY-MM-DD
slug: how-ai-agents-cut-admin-hours           # optional, defaults to filename; lowercase-kebab-case
updated: 2026-07-15                           # optional, defaults to date
author: WeBuild Agency                        # optional
tags: ai-agents, roi, automation              # optional, comma-separated
image: /assets/blog/my-post.jpg               # optional OG image; commit the file under assets/blog/
draft: true                                   # optional; excluded from build while true
---

Article body in standard markdown...
```

## Rules the build enforces (build fails otherwise)

- `title`, `description`, `date` present; description ≤ 165 chars; date is `YYYY-MM-DD`.
- Slug is lowercase kebab-case.
- Every root-relative internal link (`/blog/...`, `/tools/...`) resolves to a real file.

## Images

Put image files in `assets/blog/` and reference them root-relative
(`![alt](/assets/blog/pic.jpg)`). `image:` frontmatter sets the OG/social card.

## Publishing steps (agent-run, zero manual file edits)

1. `npm install` (first time only)
2. Write `content/blog/<slug>.md`
3. `npm run build`
4. Commit source + generated files, push branch, open PR
5. Human approval gate: merge PR → Cloudflare Pages deploys in ~1–2 min
