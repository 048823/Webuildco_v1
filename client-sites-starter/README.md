# WeBuild Co — Spec Site Starter

One-file, zero-build template for cranking good-looking SMB sites in **minutes**, hosting them free on a preview URL until sold, and handing them over cleanly after payment.

Files:
- `index.html` — the whole site, single file. Tailwind via Play CDN (no build step). Placeholders are `{{TOKENS}}`.
- `content.example.json` — every token in one place. One JSON per prospect.

## Build a spec site (target: 3–5/day, one person)

1. **Gather** (5 min): prospect's name, phone, 3 services, 3 reviews (lift from their Google listing), a hero photo (their Facebook, or an Unsplash stand-in), brand colour.
2. **Fill** (5 min): copy `content.example.json` → `content-<client>.json`, fill it. Then either:
   - hand `index.html` + the JSON to Claude Code: *"fill every `{{TOKEN}}` in index.html from this JSON, save as `<client>.html`"*, or
   - find-replace the tokens by hand.
3. **Eyeball** (2 min): open the file in a browser. Fix obvious gaps. Duplicate/delete service + review cards to fit.
4. **Deploy to preview** (2 min): drag the folder into a Cloudflare Pages project → free `<client>.pages.dev` URL. $0 while unsold. (See PIPELINE.md → "Spec build".)

That's the demo link you put in the cold email / say on the call: *"I already built your new site — here it is."*

## Before final handover (only for SOLD sites, ~10 min)

Play CDN is perfect for spec speed but pulls Tailwind from a CDN at runtime. Before handover, make it fully static + fast:

1. Compile the CSS locally (same toolchain as the main WeBuild site):
   ```
   npx @tailwindcss/cli -i src/app.css -o app.css --minify
   ```
   …then swap the `<script src="cdn.tailwindcss.com">` line for `<link rel="stylesheet" href="app.css">`.
2. Replace stand-in Unsplash images with the client's real photos (self-hosted in the repo).
3. Add their real Google review text + a favicon.
4. Add `_headers` (copy from repo root) for security headers.

> **Lazy default:** for a first sale you can skip step 1 and ship the CDN version — it works and looks identical. Compile only if the client cares about Lighthouse/offline. `<!-- ponytail: CDN ships fine; compile when perf matters -->`

## Why this stack

- **One file** → no framework, no build, no node_modules to break. Copy = new site.
- **Tailwind Play CDN** → looks designed on day one, nothing to compile while iterating.
- **Cloudflare Pages** → free hosting, free `.pages.dev` preview, instant custom-domain attach on sale, global CDN, free SSL. Same platform the main WeBuild site already runs on.
