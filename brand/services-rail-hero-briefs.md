# Services rail — hero art direction (Stage 2/3 generation brief)

For `#services` in `index.html`. Three heroes need generated art: cards 1, 3, 8. Cards 2/4/5 are real product UI (no generation, see index.html). Cards 6/7 are pure CSS, no hero.

Card frame constraints for every hero below:
- Portrait, 3:4 crop, delivered at minimum 900×1200px (renders at 300×400 CSS px).
- **No text, no logos, no UI chrome baked into the image** — title and pills are live DOM text laid over the image with a bottom scrim gradient.
- **Safe zone:** bottom 30% of the frame must stay dark/low-contrast enough that white DM Sans text at ~20px passes ≥4.5:1 contrast without help. The site adds its own `bg-gradient-to-t from-obsidian/90` scrim on top, but the source image shouldn't fight it — avoid bright highlights, faces, or busy detail in that bottom band.
- One lime (`#c8e636`) accent maximum, used as a highlight not a fill. Never lime as the dominant hue.
- Palette otherwise pulls from: obsidian `#09090b`, ink `#18181b`, graphite `#3f3f46`, slate `#52525b`, pebble `#d4d4d8`, mist `#f4f4f5`, snow `#fff`.
- Avoid: stock-photo people-in-suits-shaking-hands clichés, generic "AI brain/circuit" imagery, lens flare, any readable text or UI mockup (that's what cards 2/4/5 are for — don't duplicate their job).

---

## Card 1 — Multi-agent orchestration

**Subject:** A sense of several independent workers coordinating on one thread of work — not a single robot, not a crowd. Suggest orchestration through composition, not literal robots: e.g. converging light trails, a small cluster of distinct abstract forms (3–4) each doing a different "job" but connected by one thin line/thread that runs through all of them.

**Composition:** Subject cluster sits upper-two-thirds of frame, off-center (rule-of-thirds), leaving the bottom third genuinely empty/dark for the safe zone. Vertical 3:4 crop, not a cropped-down landscape shot.

**Camera/lighting:** Macro/studio product-photography feel — shallow depth of field, one dominant light source from upper-left, soft falloff into shadow at the bottom of frame (this does double duty as the safe zone).

**Mood:** Precise, quietly confident, systems-thinking — not sci-fi, not corporate-stock.

**Colour behaviour:** Base in graphite/ink tones; the one lime accent should mark the "connector" element (the thread linking the forms), nowhere else.

**Avoid:** literal robots/androids, more than 4 distinct elements (reads as clutter), motion blur that would fight the pill chips.

---

## Card 2 — Command center (reference only, no generation this stage)

Real product UI card — not part of this brief. If Stage 2/3 ever revisits this card, treat it as photography of an actual monitor/dashboard, never a rendered-from-scratch illustration (per the brief's "use the real thing" rule).

---

## Card 3 — Company brain

**Subject:** Knowledge coalescing into one accessible point — a library/archive feeling made abstract: layered translucent planes or sheets (documents, sources) converging toward a single glowing point of retrieval. Should read as "many sources, one answer," not "generic neural network."

**Composition:** Converging point sits in the upper-middle of the frame; layers recede toward the bottom in shadow (safe zone falls naturally into the darkest, most receded part of the composition).

**Camera/lighting:** Top-down or ¾ angle over the layered planes, soft rim light on layer edges, deep falloff to near-black at the base.

**Mood:** Calm, archival, trustworthy — a library at night, not a data center.

**Colour behaviour:** Ink/obsidian base; lime marks only the single retrieval point, small and precise (a single small glow, not a wash).

**Avoid:** literal brain/neuron imagery (too on-the-nose for "Company brain"), circuit-board clichés, stacks of paper (too literal/dated).

---

## Card 8 — Agents at work (motion, Stage 3)

**Subject:** This is a video card with a play affordance already in the static frame (CSS-drawn), so the poster frame should read as a stopped moment of real activity — agents (abstracted, per card 1's language) mid-task across a shared surface. Suggest a "day in the life" — multiple small actions happening in parallel across a workspace-like plane.

**Composition:** Wide-ish mid-shot so there's room for implied motion across the frame; keep the exact bottom-30% clear for the title, same as other cards. The centered play-button UI is CSS, not part of the image — don't compose around a fake button.

**Camera/lighting:** Slightly elevated angle, as if looking down over a desk/workspace at dusk — practical light sources (screen glow, desk lamp) rather than flat studio light, to sell "this is footage" over "this is a render."

**Mood:** Busy but calm — competence, not chaos.

**Colour behaviour:** Obsidian base with warm practical highlights (screen-glow whites/ambers); lime appears once as a single accent light or indicator, not a wash.

**Avoid:** literal humanoid robots at desks (undercuts "software, not staff" positioning), any readable on-screen text (would compete with real UI cards), frantic/glitch effects.
