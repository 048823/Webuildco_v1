# WeBuild Creative Studio — Workflow (v1)

**One-page pipeline.** Every asset flows: **intake → creative brief → production → BrandGuardian QA → export for Metricool.** Nothing ships without BrandGuardian approval.

Source of truth for brand rules: [`/brand/brand-guidelines.md`](./brand-guidelines.md) and the design system. Read them before producing.

---

## Roles

| Stage | Owner |
|-------|-------|
| Brief | ExecutiveCreativeDirector (ECD) |
| Static production (thumbnails, carousels, quote cards, infographics, portraits) | StudioDesigner |
| Video/motion production (reels, promos, animated cards) | MotionDesigner |
| QA gate (brand + design) | **BrandGuardian** |
| Scheduling/publishing | Content team (Metricool) |

---

## 1. Intake

Three channels feed the studio. Each lands as a **Multica issue assigned to the ECD** (label `creative-request`):

1. **Approved topics from Content team** — ContentStrategist / Copywriter / CreativeDirector hand off a topic already approved for publishing. This is the default, highest-volume channel.
2. **Ad hoc creative requests** — one-off asks from any agent or a human owner (e.g. a single announcement graphic).
3. **Website / product work** — assets for webuildco.com.au or product surfaces.

**What an approved-topic handoff must carry** (Content team fills this on the intake issue; ECD rejects incomplete handoffs back to Content):
- **Platform(s) + format** — e.g. LinkedIn carousel, IG reel, X single image.
- **Copy** — final headline, body/caption, CTA (CTA ties to a real WeBuild offer).
- **Angle / key message** — the one thing the asset must land.
- **Source post** — link to the approved content item.
- **Deadline / publish slot.**
- **Any assets** — logos, screenshots, data, founder photos to include.

Incomplete handoff → ECD comments the missing fields on the issue and blocks until filled. No guessing.

## 2. Creative brief (ECD)

ECD turns the intake into a short brief as a comment on the issue:
- Asset list + exact platform specs (dimensions, safe zones — see design system).
- Art direction: template/layout to use, palette, tone, reference.
- Recommended AI prompt(s) from [`/brand/prompt-library.md`](./prompt-library.md) + tool (gpt-image / fal.ai / kie-ai) + aspect ratio.
- Assigns production sub-issue(s): static → StudioDesigner, motion → MotionDesigner.

## 3. Production (StudioDesigner / MotionDesigner)

Designer produces to the brief using the design system templates and prompt library. Output:
- Correct **per-platform dimensions** and safe zones.
- Export-ready files (see §5).
- Posts assets on the production sub-issue and hands to BrandGuardian for QA.

## 4. QA gate — BrandGuardian (nothing ships unapproved)

BrandGuardian reviews every asset on two axes, then gives a clear verdict:

- **Brand consistency** — logo usage, fonts, spacing, color palette, photography/illustration style, iconography, tone, overall identity.
- **Design QA** — alignment, readability, contrast/accessibility, resolution, compression, correct per-platform dimensions and safe zones.

**Verdict:**
- ✅ **Approved** → moves to export.
- ❌ **Rejected** → numbered list of concrete fixes back to the designer. Re-submit after fixes. Loop until approved.

Genuine brand-direction ambiguity → BrandGuardian escalates to ECD.

## 5. Export for Metricool

Approved assets are exported in Metricool-ready form and handed to the Content team for scheduling:

- **File format** — PNG for static (JPG only if size demands); MP4 (H.264) for video.
- **Dimensions** — final, per platform, no further cropping needed:
  - LinkedIn: 1200×1200 (carousel/feed square), 1200×627 (link).
  - X: 1600×900 (16:9).
  - Instagram: 1080×1080 feed, 1080×1350 portrait, 1080×1920 stories/reels.
  - YouTube: 1280×720 thumbnail; 1920×1080 video.
  - Facebook: 1200×630 feed.
- **Naming** — `platform_topic_variant.ext` (e.g. `linkedin_agents-not-headcount_carousel-01.png`).
- **Caption/CTA** — final copy from the brief travels with the asset (from Content's approved item).
- **Delivery** — files attached to the issue + placed in the shared export location; Content team loads them into Metricool and schedules.

---

## Acceptance walk-through — "carousel for LinkedIn post X"

1. Content team files intake issue: platform=LinkedIn carousel, copy, angle, link to approved post X, deadline. → ECD.
2. ECD writes brief: 1200×1200 slides, template + palette, prompt library entry for carousels, assigns StudioDesigner.
3. StudioDesigner produces slides to spec, hands to BrandGuardian.
4. BrandGuardian QA → approved (or rejects with fixes, loop).
5. Export PNGs at 1200×1200, named, captions attached → Content schedules in Metricool.

No missing step.
