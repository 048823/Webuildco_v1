# WeBuild Co — Brand Guidelines v1

**The single source of truth for the WeBuild brand.** Anyone on the Creative Studio can open this file and make an on-brand decision without asking. If an asset conflicts with this document, this document wins — or escalate to the ExecutiveCreativeDirector.

- **Owner:** BrandGuardian (Creative Studio)
- **Version:** 1.0 · 2026-07-14
- **Source of truth:** consolidated verbatim from the live production site (`Webuildco_v1` repo — `src/app.css` design tokens, `favicon.svg`, `index.html`, `llms.txt`). Not invented. When the live site and this doc diverge, reconcile here.

> **Correction to the original brief:** the brief guessed *Space Grotesk + Inter* and an ember/orchid accent. The live product does **not** use those. WeBuild ships on **DM Sans** with a **lime (#c8e636)** accent. This document reflects what actually ships. Do not use Space Grotesk, Inter, ember, or orchid on WeBuild work.

---

## 1. Positioning & essence

WeBuild Co is an Australian AI engineering studio (founder: Johan Iskandar, computer engineer; Sydney, AU). We build AI agents that run the repetitive work inside small and mid-sized businesses — scoped with payback math up front, built at a fixed price, run under human supervision until proven, then handed over completely. **Owned, not employed. No lock-in, ever.**

- **One-liner:** *Hire agents, not headcount.*
- **Positioning line:** *Owned, not employed.*
- **Proof line:** *Supervised until proven.*
- **Feeling:** premium, modern, timeless, precise. Engineering studio, not a hype startup.

**North star for every asset:** award-winning agency caliber (Pentagram / Collins). Restraint over decoration. If a choice makes it look like a generic AI/SaaS template, it's wrong.

---

## 2. Color

Two roles only: a **neutral greyscale** carries everything, and **one lime accent** does the pointing. No third color. This restraint *is* the brand.

### Neutrals (the whole system)
| Token | Hex | Use |
|---|---|---|
| `obsidian` | `#09090b` | Primary ink; dark surfaces; logo mark bg; headlines on light |
| `ink` | `#18181b` | Near-black surfaces, secondary dark |
| `graphite` | `#3f3f46` | Body text on light, strong borders |
| `slate` | `#52525b` | Secondary text, the "Co" in the wordmark |
| `steel` | `#71717a` | Muted labels, captions, monospace UI text |
| `ash` | `#a1a1aa` | Disabled, faint meta |
| `pebble` | `#d4d4d8` | Borders, dividers, hairlines |
| `fog` | `#ececee` | Light dividers |
| `mist` | `#f4f4f5` | Page background (default light surface) |
| `snow` | `#ffffff` | Cards, primary light surface, text on dark |

### Accent
| Token | Hex | Use |
|---|---|---|
| `lime` | `#c8e636` | **The** brand accent. Logo inner square, one highlight per view, key CTAs/wash, "live" dot. |
| `lime-deep` | `#aacb1f` | Hover/pressed state of lime; lime text needing contrast on light. |

**Accent discipline:** lime is a *single decorative wash* per composition — one hero moment, not sprinkled. Overusing lime cheapens it. Default to obsidian/snow; add lime once.

### Reserved / do-not-use
`ember #ff5a00` and `orchid-flash #fe45e2` exist in the underlying token spec but are **not part of the WeBuild palette**. Do not use them on WeBuild assets. (Reserved for future sibling brands.)

### Contrast & accessibility (WCAG AA)
- **Body text:** `graphite #3f3f46` (or darker) on `snow`/`mist`. `steel #71717a` only for large/secondary text — it fails AA for small body on white, so never use `steel` or lighter for primary reading copy on light backgrounds.
- **On obsidian/ink surfaces:** use `snow`, `pebble`, or `lime` for text. `lime #c8e636` on `obsidian` is a strong, accessible pairing — the signature "terminal" look.
- **Lime is a background/accent, not a text color on white.** `lime` on `snow` fails contrast — never set body or CTA label text in lime on a light surface; put dark text on a lime fill instead.
- **CTA (primary):** obsidian fill, snow text, full radius. **CTA (secondary):** snow fill, graphite text, graphite border.
- Every asset must pass AA (4.5:1 body, 3:1 large/UI) — this is a QA gate, not a suggestion.

---

## 3. Typography

**One family: DM Sans.** Variable, optical-size aware. Load weights 300–700.

```
https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap
```
CSS var: `--font-cosmica: 'DM Sans', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;`

- **Monospace** (only for agent/terminal/data UI motifs — logs, "agent › …" lines, metrics): system mono (`ui-monospace, SFMono-Regular, Menlo, Monaco`). Signals "software doing real work." Never for prose.
- **No display/script/serif fonts.** DM Sans does everything.

### Type scale (px / line-height)
| Token | Size | LH | Use |
|---|---|---|---|
| `display` | 64 | 1.0 | Hero statement (one per page) |
| `display-sm` | 56 | 1.12 | Section hero |
| `heading-lg` | 40 | 1.25 | Major section title |
| `heading` | 32 | 1.28 | Section title |
| `heading-sm` | 20 | 1.35 | Card / block title |
| `subheading` | 18 | 1.45 | Lead-in, wordmark size |
| `body-lg` | 16 | 1.5 | Emphasised body |
| `body` | 14 | 1.56 | Default body |
| `caption` | 10 | 1.8 | Labels, meta, uppercase tags |

### Weight & usage rules
- Headlines: 600–700, `obsidian`, tight tracking. Big type is the design — let it breathe, don't decorate it.
- Body: 400 `graphite`; 300 (light) allowed only on dark surfaces at `body`+ size (e.g. `pebble`/`slate` on obsidian).
- Emphasis inside text: weight, not italic. Avoid all-italic blocks.
- Captions/labels: uppercase, `steel`, generous letter-spacing, small.
- Never justify. Left-align body. Keep measure ~60–75 characters.

---

## 4. Logo

### The lockup
Mark + wordmark, horizontally, `8px` gap, weight 700, `subheading` (18px) size:
- **Mark:** obsidian rounded square (≈26px, corner radius `xl`/12px) containing a lime rounded square (≈11px, radius 3px), centered. The mark scales; keep the inner square ≈42% of the outer and centered.
- **Wordmark:** `WeBuild` in **obsidian, weight 700**, immediately followed by `Co` in **slate `#52525b`, weight 400** (no space). Case: `WeBuildCo` as one token visually; "WeBuild Co" with a space is correct in running prose and legal/site-name contexts.

Reference (favicon mark): obsidian `#09090b` rounded square, lime `#c8e636` inner square.

### Variants
- **Full lockup** (mark + wordmark) — default, headers, decks, docs.
- **Mark only** (obsidian square + lime square) — favicon, avatars, app icons, watermark, tight spaces.
- **Reversed** — on dark (obsidian/ink) surfaces: wordmark becomes `snow` "WeBuild" + `pebble`/`slate` "Co"; mark stays obsidian square with lime inner (or, on obsidian, a hairline `graphite` outline so the square reads).

### Clear space & size
- **Clear space:** minimum the width of the mark's inner lime square on all sides. Nothing intrudes.
- **Min size:** mark ≥ 20px; full lockup ≥ 90px wide. Below that, use mark only.

### Do / Don't
- ✅ Keep obsidian + lime only. ✅ Keep the two-weight wordmark (bold WeBuild + light Co). ✅ Place on `snow`, `mist`, or `obsidian`.
- ❌ Recolor the mark or wordmark (no gradients, no ember/orchid, no non-brand color). ❌ Change the "Co" to match "WeBuild" weight/color. ❌ Add effects (shadow, glow, outline — except the reversed hairline). ❌ Stretch, rotate, or re-space the lockup. ❌ Place on busy photography or low-contrast color. ❌ Recreate the wordmark in any font but DM Sans.

---

## 5. Spacing, radius, shadow

**Pixel spacing scale** (Tailwind tokens map 1:1 to px — `p-24` = 24px). Compose layouts from these; don't invent in-between values:
`4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 36 · 40 · 48 · 64 · 68 · 80 · 120`

- Base rhythm unit: **4px**. Section padding: 64–120px. Card padding: 24–28px. Element gaps: 8–20px.
- Generous whitespace is a brand signal — premium feels uncrowded. When unsure, add space, not elements.

**Radius:** soft, rounded, friendly-but-precise.
`md 6 · xl 12 · 2xl 16 · 20 · 3xl 24 · 28 · 36 · 40 · full 48 · 56 · 64 · 80 · pill 1000`
- Buttons & pills: `full` (pill). Cards: `2xl`–`3xl` (16–36px). Small chips/inputs: `xl`. The pill CTA is a brand signature.

**Shadow:** subtle only. Elevation comes from soft, low shadows and hairline borders (`pebble`), never heavy drops.
- `md`: `rgba(0,0,0,0.04) 0 4px 12px` · `lg`: `rgba(0,0,0,0.10) 0 18px 44px -8px`. Prefer border + `md` over any harder shadow.

---

## 6. Motion

Restrained, physical, purposeful — never decorative jitter.
- Reveal on scroll: fade + 22px rise, ~0.7s, spring ease.
- Signature accents: slow marquee logo rail (~32s), pulsing lime "live" dot, thin orbit ring. One signature motion per view, max.
- Standard transitions ~0.3–0.5s, ease-out. Hover: subtle lift (`-translate-y-px`) + brightness, not scale-up.
- **Always** honor `prefers-reduced-motion` — kill animation, keep content. This is a hard requirement.

---

## 7. Photography & illustration

WeBuild's default is **not photography** — it's clean, functional **product/UI illustration** rendered in the brand tokens. This is the signature look and should lead.

- **Preferred:** minimal vector diagrams of agents at work — nodes/edges, monospace labels, obsidian/ink panels, lime highlights, `graphite` connectors. Show the *system doing real work* (leads scored, calls booked, memory graph), never abstract "AI glow."
- **Mood if photography is used:** real, Australian, understated. Real workspaces, real hands, natural light, muted/desaturated to sit with the neutral palette. Documentary, not staged.
- **Hard avoids (the "generic stock look"):** glowing blue brains, humanoid robots, floating holograms, circuit-board clichés, purple/cyan AI gradients, laughing-around-a-laptop stock, fake dashboards with lorem numbers. If it looks like every other AI company, discard it.
- **Illustration rules:** flat, geometric, token-accurate colors, monospace for any data text, generous space. No skeuomorphism, no 3D chrome, no drop-shadow-heavy "glass."

---

## 8. Iconography

- **Style:** simple line/geometric, consistent ~1.5–2px stroke, rounded joins, matching the radius language. Monoline, not filled-illustrative.
- **Color:** `graphite`/`obsidian` default; `lime` only to mark the one active/highlighted state.
- **Sizing:** align to the spacing scale (16 / 20 / 24). Optical-center inside touch targets (≥44px for interactive).
- Consistency over cleverness — one icon family across a set. Don't mix line and filled, don't mix stroke widths.

---

## 9. Tone of voice

WeBuild sounds like the engineer who built the thing and refuses to oversell it. **Plain, precise, honest, quietly confident.**

- **Plain-language, concrete.** "Reads the incoming work, decides using your rules, acts in your tools, logs what it did." Not "leverages cutting-edge AI to transform your business."
- **Honest & specific.** Real numbers, real payback math, named limits. *"No borrowed logos, no invented numbers."* Never hype, never absolute claims we can't prove.
- **Confident, not loud.** Short declaratives. Australian-direct. Respect the reader's time.
- **Ownership framing.** Emphasize the client *owns* it: "Owned, not employed," "No lock-in, ever," "supervised until proven."
- **Words we use:** agents, own, proven, supervised, payback, handover, guardrails, workflow, fixed price.
- **Words we avoid:** revolutionary, magic, seamless, synergy, unleash, game-changer, cutting-edge, robust, 10x, and empty superlatives generally.
- **Mechanics:** sentence case (not Title Case) for headings; Oxford-light; em-dashes for asides; numerals for numbers; A$ for prices. Contractions are fine — we're human.

---

## 10. Per-platform delivery (Design QA gate)

Every asset ships production-ready, at correct dimensions, with safe zones respected, sRGB, no compression artifacts on the lime or type. Common targets:

| Platform | Asset | Size (px) |
|---|---|---|
| LinkedIn | Feed image / single | 1200×1200 (or 1200×627 link) |
| LinkedIn | Cover | 1128×191 |
| X | Feed image | 1600×900 (16:9) |
| X | Header | 1500×500 |
| Instagram | Feed | 1080×1350 (4:5) |
| Instagram | Story / Reel | 1080×1920 (9:16) |
| YouTube | Thumbnail | 1280×720 |
| Facebook | Feed | 1200×630 |

**QA checklist (must pass before approval):**
1. Correct dimensions & aspect for the platform; key content inside safe zones (no logo/CTA under UI overlays on Story/Reel).
2. Contrast AA on all text; type legible at thumbnail scale.
3. Logo correct (colors, two-weight wordmark, clear space, min size) or intentionally absent.
4. Palette = neutrals + single lime accent only; no ember/orchid, no off-brand color.
5. DM Sans (or system mono for data UI) — no stray fonts.
6. Alignment on the spacing grid; no crushed spacing; generous margins.
7. High-res, sharp, no banding/artifacts on lime fills or gradients; sRGB.
8. Reduced-motion respected for any animated deliverable.

**Verdict format:** *Approved* — or *Rejected* with a numbered list of concrete fixes. Strict but constructive; raise the bar, don't block work.

---

## 11. Future brands

This folder is the shared home for all brand systems. Sibling brands get their own `brand-guidelines-<name>.md` here. The token architecture (neutral scale + single accent, DM Sans, pixel spacing, pill CTAs) is reusable; a sibling brand swaps the accent (e.g. `ember`/`orchid-flash` are pre-reserved) and its wordmark — everything else can inherit.

---

*Questions on brand direction that this doc doesn't settle → escalate to the ExecutiveCreativeDirector. Prompt library lives alongside this file under `/brand/`.*
