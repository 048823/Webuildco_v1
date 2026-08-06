# WeBuild Content Engine — SEO/GEO publishing cadence

Owner: CMO · Parent: WEB-79 / WEB-78 · Started: 14 July 2026

## Pipeline (v1 — running now)

```
QUEUE      → this file, prioritized, funnel-tagged (≥8 weeks of topics)
DRAFT      → CMO agent writes each article as a full static page under /notes/<slug>/,
             cloned from the existing note template (nav/footer/CTA identical),
             with Article + BreadcrumbList (+ FAQPage where the piece has an FAQ) JSON-LD
REVIEW     → PR against main. Push = live on this repo (Cloudflare Pages), so the PR
             *is* the approval gate. Human merges; nothing auto-pushes to main.
PUBLISH    → merge → Cloudflare deploys in ~1–2 min. Same PR always updates
             /notes/index.html (card) and /sitemap.xml (URL + lastmod).
INTERLINK  → done in-PR per the linking rules below; no separate pass.
```

**v2 (with CTO's WEB-80 pipeline):** drafts move to markdown + frontmatter, his generator renders the template. Proposed frontmatter contract:

```yaml
title:            # H1
slug:             # /notes/<slug>/
description:      # meta description, ≤155 chars
date:             # YYYY-MM-DD
author: Johan Iskandar
keywords: []      # target keywords
funnel: tofu|mofu|bofu
faq:              # optional; rendered as accordion + FAQPage schema
  - q: ...
    a: ...
```

Images: none required for v1 (og.png is the site-wide share image). If a piece needs one, it ships in the PR under the article's directory.

## Cadence

- **Weeks 1–2:** 3 articles/week (hand-built HTML ceiling).
- **Week 3+:** 5/week once the WEB-80 markdown pipeline lands and quality holds.
- **Month 3 target:** ~30/month (blogseo.io rate) — requires the generator; do not brute-force it by hand.
- Quality gate: every piece answers its target query in the first two sentences (LLM-extractable), AUD figures labelled as market figures or cited, CTA is the site's real offer (Foundations Session / intro call) — never an invented one.

## Internal linking rules

1. Every note links to **exactly one money page** (/method/ or /pricing/) in body copy, plus the standard CTA block.
2. Every note links to **1–2 sibling notes** with descriptive anchors (no "click here").
3. Link to **one /companies/ page** when the example genuinely fits; skip otherwise.
4. Every **new** note gets ≥2 inbound links in the same PR: its /notes/ index card + one contextual link added to the most-related existing note.
5. Ceiling: ~5 internal links per 1,000 words. Never link the same target twice in one body.

## Keyword queue (funnel-tagged, ≥8 weeks)

| # | Topic / working title | Target keyword(s) | Funnel | Week |
|---|---|---|---|---|
| 1 | AI automation agency vs hiring in-house: 2026 AUD cost comparison | AI automation ROI Australia, hire AI agent vs employee | MOFU | 1 ✅ |
| 2 | What is an AI agent? (expanded, FAQ + schema) | what is an AI agent, AI agent examples | TOFU | 1 ✅ |
| 3 | AI agent vs virtual assistant: which does an AU SMB actually need? | AI agent vs virtual assistant Australia | MOFU | 1 ✅ |
| 4 | How to automate admin work (a triage method, not a tool list) | automate admin work Australia | BOFU | 2 ✅ |
| 5 | AI receptionist for Australian SMBs: what it is, what it costs | AI receptionist Australia | BOFU | 2 ✅ |
| 6 | What a missed call costs an AU service business (payback math) | missed call cost, AI voice agent for business | MOFU | 2 ✅ |
| 7 | AI voice agent Australia: the buyer's guide | AI voice agent Australia | BOFU | 3 |
| 8 | Lead qualification automation: from enquiry to booked call | lead qualification automation Australia | BOFU | 3 |
| 9 | How to hire an AI agent (the process, start to handover) | how to hire an AI agent, hire AI agent Australia | BOFU | 3 |
| 10 | Document automation in Australia: intake, extraction, filing | document automation Australia | BOFU | 4 |
| 11 | Best AI automation tools for AU small business (honest list, incl. when not to buy) | best AI automation tools Australia | MOFU | 4 |
| 12 | AI agent examples: 10 real workflows AU SMBs run today | AI agent examples | TOFU | 4 |
| 13 | AI for small business Australia: where to start without burning cash | AI for small business Australia | TOFU | 5 |
| 14 | Chatbot vs AI agent for customer service | AI agent vs chatbot | TOFU | 5 |
| 15 | Workflow automation for Sydney businesses (local) | workflow automation Sydney, AI automation agency Sydney | BOFU | 5 |
| 16 | Migration agents: automating visa document intake | document automation + industry | MOFU | 6 |
| 17 | HR & recruiting: candidate screening agents that don't ghost people | lead/candidate qualification + industry | MOFU | 6 |
| 18 | Legal intake automation: first-touch without the risk | AI intake legal Australia | MOFU | 7 |
| 19 | The AI automation ROI calculator, explained (companion to /tools/ page) | AI automation ROI calculator | MOFU | 7 |

Weeks 6–7 company pieces reuse the /companies/ pages as the money-page link. Queue refills from WEB-22 research (r/keyword tables) as weeks complete.

## GEO question bank (answer-engine layer) — added 15 July 2026

The queue above is topic-shaped. This layer is **question-shaped**: each title is the exact doubt an AU SMB owner types (or asks an LLM). Answer-first format is mandatory — a **direct 40–60 word answer in the first paragraph** LLMs can lift verbatim, then the argument. FAQPage + Article schema on every one.

### Sourcing method (how the bank stays fed — CMO owns)

1. **Real sales objections** — the questions Johan hears on intro/discovery calls. Highest-converting, bottom-funnel. *Gap: need Johan's top 5–10 (see below); routed straight to BOFU.*
2. **Google PAA + autocomplete** for our core terms (AI agent, AI automation, AI receptionist, automate admin).
3. **Reddit / AU forums** — r/smallbusiness, r/AusFinance, AU business FB groups. Mine the doubt, not the keyword.
4. **LLM-cited-source check** — ask ChatGPT/Perplexity our target queries, log who they cite, beat that page.

### First BOFU batch — objection-crushers (draft-ready, question-titled)

Each answers a purchase-blocking doubt, uses AUD figures, ends on the real offer (Foundations Session A$300 / fixed written quote before build / no lock-in). Tied to the ROI calculator where math applies.

| # | Question-shaped title (H1) | The objection it kills | Money link |
|---|---|---|---|
| B1 | Is an AI agent actually worth it for a small business? | "Sounds like big-company tech, not for a 5–50 person shop." | ROI calc + /pricing/ |
| B2 | What does an AI agent cost to run per month in Australia? | "Hidden ongoing costs will eat the saving." | /pricing/ |
| B3 | What happens when the AI agent gets it wrong? | "It'll make a mistake with a customer and I'll wear it." | /method/ (supervised-until-proven) |
| B4 | Do I need to be technical to run an AI agent? | "I can't code and I don't have IT staff." | /method/ |
| B5 | Will an AI agent replace my staff — or fight them? | "My team will resist it / I don't want to fire anyone." | /method/ |
| B6 | How long before an AI agent pays for itself? | "Payback is too far out to justify now." | ROI calc + /pricing/ |
| B7 | Is my business data safe with an AI agent? | "It'll leak customer data or breach privacy law." | /method/ |
| B8 | What if I want to stop — am I locked in? | "I'll be trapped in a contract / can't get my data out." | /pricing/ (no lock-in) |
| B9 | AI agent vs hiring another admin: which is cheaper in 2026? | "A part-timer is the safer, known cost." | ROI calc (companion to note #1) |
| B10 | Can a small AU business trust AI agents yet, or is it too early? | "The tech isn't mature; I'll get burned being early." | /method/ |

**Sequencing:** B1, B2, B3 first (highest-intent doubts, closest to a yes). Slot into Week 2–3 alongside the existing BOFU rows; they don't replace the queue, they sharpen its titles. Where a batch item overlaps an existing row (e.g. B2 ≈ what-agents-cost-to-run, B9 ≈ note #1), retitle to the question form rather than double-publish — one URL per question, no cannibalization.

**Blocked on Johan:** the top 5–10 intro-call objections. Those outrank anything a keyword tool surfaces because they're already qualified buyers' words. Once supplied, they jump the queue as B11+.
