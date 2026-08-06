# Website Build + Handover Pipeline (WEB-145)

**Goal:** cold-sell $2,000 spec sites. Site is *already built* on a preview URL before the call. After payment, hand over cleanly with the lowest possible ongoing burden.

```
SPEC BUILD ──▶ PREVIEW URL ──▶ SALE ($2k) ──▶ TRANSFER ──▶ CLIENT EDITS
 (30 min)      (.pages.dev)     (deposit)      (custom domain)  (care plan)
```

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Template | `client-sites-starter/` — single `index.html`, `{{TOKENS}}` | Copy = new site. No build to break. |
| Styling | Tailwind Play CDN (spec) → compiled CSS (on sale) | Designed look instantly; static + fast on handover. |
| Host | **Cloudflare Pages** | Free hosting, free `.pages.dev` preview, instant custom-domain, free SSL, global CDN. Same platform as the main site. |
| Deploy | Git push **or** drag-drop folder in Pages dashboard | Push = live. Drag-drop for one-off spec sites without a repo. |
| Domain | Client keeps/buys their own; we point DNS | Client owns the asset → clean, no riba-style lock-in. |

Hostinger stays available for clients who insist on WordPress or already have Hostinger hosting — but Pages is the default (faster, cheaper, $0 while unsold).

## 2. Spec build (before the call) — target 3–5/day

1. Fill `content-<client>.json` from their Google listing + Facebook (name, phone, 3 services, 3 reviews, a photo, brand colour). ~10 min.
2. Fill the template (Claude Code or find-replace). ~5 min.
3. Create a Cloudflare Pages project → **drag the folder in** → get `webuild-<client>.pages.dev`. **$0, no domain needed.** ~2 min.
4. That URL is the hook: *"I built your new site already — here's the link."*

One Cloudflare account holds unlimited unsold spec sites at zero cost. Delete the ones that don't convert.

## 3. Sale

- Take payment (deposit or full $2k) **before** transfer. Preview URL stays live but branded WeBuild until paid.
- Optional: keep the `.pages.dev` live but add a `noindex` header (`_headers`) so unsold spec sites never rank or leak.
- Islamic-finance clean: flat build fee + optional flat monthly care fee. No interest, no financing.

## 4. Transfer — pick ONE per client

**A. We-host (default, recommended).** We keep the Pages project in the WeBuild Cloudflare account; attach the client's domain as a custom domain.
- Client action: at their registrar, add the CNAME/records Cloudflare shows (or delegate nameservers). We send exact copy-paste values.
- Result: live on their domain in ~1–2 min. We retain deploy control → we do their edits (care plan = recurring revenue).
- **Checklist:**
  - [ ] Compile CSS, swap in real images/reviews, add `_headers` (see starter README "Before final handover").
  - [ ] Pages → custom domain → add `theirdomain.com.au`.
  - [ ] Send client the DNS records to add at their registrar.
  - [ ] Confirm SSL active (green) + site loads on their domain.
  - [ ] Set up 1 uptime check (e.g. UptimeRobot) — production support baked in.

**B. Client-owns (they asked to fully own it).** Hand over the code + hosting.
- Give them the client's own GitHub repo (or a zip) + connect their own Cloudflare Pages account to it.
- We can no longer push edits → only choose this if they want full independence.
- **Checklist:**
  - [ ] Create repo under client's GitHub (or transfer ownership of a per-client repo).
  - [ ] They connect their Cloudflare account → Pages → their repo.
  - [ ] Verify their deploy works, domain attached, SSL green.
  - [ ] Hand over a 1-page "how to edit + redeploy" note.

> Cloudflare **Pages projects don't transfer between accounts** — so "client-owns" = give them the *repo* and let them connect their *own* Cloudflare. Don't promise a project transfer.

**Who owns what (state it in the invoice):** client owns the domain and (in option B) the code + hosting. In option A, WeBuild hosts and maintains under a care plan; client can request an export any time.

## 5. Client editing — lowest-burden default

**Default: managed edits (care plan).** Non-technical owner emails/WhatsApps the change ("new hours", "swap this photo"); we edit the file and push. Turnaround same-day.
- Why: a static one-pager changes maybe monthly. A CMS is more surface to maintain than it's worth. Recurring $ + we keep the relationship.
- Price it as a flat monthly care fee (hosting + edits + uptime). Flat fee = Islamic-finance clean.

**Only if the client demands self-serve:** add a lightweight CMS layer *after* the sale — e.g. [Pages CMS](https://pagescms.org) or Cloudflare's editing, editing markdown/JSON in the repo through a simple UI. Adds setup + support burden → don't offer by default; upsell only on request.

---

## Deliverables (this issue)
- **This doc** — the one-page pipeline.
- **`client-sites-starter/`** — reusable template (`index.html`), token map (`content.example.json`), build/deploy/handover guide (`README.md`). Lives in this repo; copy it per client.
