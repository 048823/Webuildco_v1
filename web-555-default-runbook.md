# WEB-555 default runbook

What each of the six WEB-555 defaults actually does when they fire at **Sat 15-Aug 2026, 21:00 AEST**.

Written 15-Aug 09:30 AEST (WEB-713). **This document executes nothing.** Every command below is
written down to be read and approved, not run by the author of this file.

Repo: `048823/Webuildco_v1` · `main` **is** production (Cloudflare Worker `webuild`, origin
`https://webuildco.com.au`). There is no separate deploy step — a merge to `main` *is* the deploy.

---

## Headline: four of the six defaults have already run

Defaults **#3, #4, #5 and #6** were executed between 14-Aug and 15-Aug by WEB-680, WEB-660, WEB-687,
WEB-694 and WEB-704, and are baked into the branch stack. At 21:00 they are **no-ops** — there is
nothing left for them to do, and each one is verifiable in one command (below).

Default **#1** as written is **stale**: it says "WEB-544 closes as blocked", but WEB-544
(`cf4b5b29-c1ae-4487-bb67-f39aa8e95fb6`) was already closed `done` in the 14-Aug 12:00 `in_review`
sweep. Firing it literally would be a *re-open then re-close*. Needs a board ruling on which it is.

Default **#2** is the only one with real work attached, and `main` has moved 4 commits since the
stack was built, so the rebase it calls for is no longer a formality.

**No default in this set merges anything, deploys anything, or sends anything external.
No step is irreversible.** See "Irreversibility" at the end — that is the short answer to
"should these fire at all".

---

## The six at a glance

| # | Request | Default action at 21:00 | Exact commands / PRs | Reversible? | If it fails, what breaks |
|---|---------|------------------------|----------------------|-------------|--------------------------|
| 1 | NoonOS repo URL? | Stop chasing the URL; WEB-544 is recorded closed. **Already `done` — no status change to make.** | `multica issue get WEB-544` (verify only) + one comment | Yes — reopen with `multica issue status WEB-544 todo` | Nothing breaks in code. The tested 8-defect patch stays parked as an attachment on WEB-544 and the 8 defects stay live in NoonOS |
| 2 | Merge the five as one rebased stack? | **Nothing merges.** Rebase the 8-PR chain onto current `main` (`4a47358`), prove `npm test` green, freeze | `git rebase --onto` ×8, `git push --force-with-lease` ×8. No `gh pr merge` anywhere | Yes — pre-rebase tips recorded below; force-push back | If the rebase conflicts: stop, push nothing, stack stays where it is. Production is untouched either way |
| 3 | Sidebar taxonomy — #68's or #66's? | #68's `Company / Marketing / System`. **Already applied** in the stack | none — verify with `grep -c 'grp: "Company"'` | Yes — one commit to change | Nothing. Guarded by `sections.test.mjs` |
| 4 | Zero #66's invented pipeline deals? | Zeroed. **Already applied** — `sales.deals/proposals/activities` are all `[]` | none — verify with the `board.json` check below | Yes — `git revert` the WEB-660 commit | Nothing. Guarded by `sales.test.mjs` |
| 5 | #65 CRM — shell now or wait for D1? | Ships as a shell, sample rows only, **CSV export disabled**. **Already applied** | none — verify the `disabled` attribute below | Yes — re-enable is one HTML attribute | Nothing. Guarded by an assertion in `app.crm.test.mjs` |
| 6 | Anything split out? | Everything stays on WEB-555 | none | n/a | Nothing |

---

## Stack as it stands right now

Eight PRs, one linear chain. #65's base is `main`; every other PR's base is the PR above it.

| PR | Issue | Branch | Base | Current tip |
|----|-------|--------|------|-------------|
| #65 CRM | WEB-538 | `agent/cto/29b503f3` | `main` | `e8be895` |
| #66 Sales + Outbound | WEB-537 | `agent/cto/674da7b1` | #65 | `9d149f8` |
| #67 Deliverables | WEB-539 | `agent/cto/2ffdbc9a` | #66 | `9e56ffa` |
| #68 Sidebar + Marketing | WEB-541 | `agent/cto/c88779f9` | #67 | `739e42d` |
| #69 Settings | WEB-543 | `agent/cto/web-543-settings` | #68 | `ed90636` |
| #73 Kill fabricated reply rate | WEB-687 | `agent/cto/f3bf561a` | #69 | `25d0a9b` |
| #74 Kill 12 invented project % | WEB-694 | `agent/cto/8f3b2fe0` | #73 | `472b2f4` |
| #76 Kill 7 invented Deliverables % | WEB-704 | `agent/cto/90953de5` | #74 | `d077c4b` |

`main` tip: `4a47358`. **PR #75 (`agent/cto/8f3b2fe0-push` → `main`) is NOT part of this stack** —
it is the standalone git-push guard from WEB-694. No default in this runbook touches it.

Two notes the board should see:

- The card recommended merge order **#68 → #66 → #65 → #67 → #69**. The stack that actually exists
  is **#65 → #66 → #67 → #68 → #69 → #73 → #74 → #76**. That is not a contradiction — the card's
  ordering existed to settle the sidebar taxonomy first, and WEB-680 settled it *inside* the stack
  instead (#68's `grp` won, #66's `group` was dropped). Physical order no longer decides taxonomy.
- The card and the release comment both say "five PRs". It is eight now. Three honesty fixes
  (#73, #74, #76) were folded in after the card was written.

### Why every PR shows a red check, and what to do about it at 21:00

`Workers Builds: webuild` reports **fail** on all eight. This is not a broken build.

`package.json`:

```
"guard:branch": "[ -z \"$WORKERS_CI\" ] || [ \"$WORKERS_CI_BRANCH\" = main ] || { echo \"WEB-515 guard: branch '$WORKERS_CI_BRANCH' is not main - refusing to build, so no deploy runs.\" >&2; exit 1; }"
```

`wrangler.jsonc` runs `npm run guard:branch` as its build command, so it fires before every deploy
and every `versions upload`. A red Workers Builds check on a non-`main` branch **is the no-deploy
protection working**, and it is also the proof that no branch has reached production.

**Stated behaviour if a check is red at 21:00:**

- `Workers Builds: webuild` red on a branch PR → **expected. Proceed.** Merged PR #63 shows the
  same red.
- `Workers Builds: webuild` red on `main` → **stop everything and escalate.** That one is real.
- `npm test` red anywhere → **stop. Push nothing.** `npm test` is the only green signal that means
  anything here. Restore from the recorded tips below and comment on WEB-555.

---

## Default #1 — NoonOS repo URL unanswered

**What the card says happens:** "WEB-544 closes blocked; the 8 defects stay live in NoonOS and we
stop chasing."

**What is actually true:** WEB-544 `[BOARD-GATED] Look into Dashboard section` is already `done`
(closed in the 14-Aug 12:00 sweep). The tested 8-defect patch is an attachment on that issue. The
NoonOS repo is not in this workspace, not under `048823` on GitHub, and `noonos-app` is not in the
`webuildco` Vercel team, so there is nowhere to apply it.

**Commands, in order:**

```bash
# 1. Confirm current state before touching anything
multica issue get WEB-544 --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['identifier'], d['status'])"
# expected: WEB-544 done

# 2. If it reads `done` — do NOT reopen. Record the outcome only:
multica issue comment add cf4b5b29-c1ae-4487-bb67-f39aa8e95fb6 --content-file ./web544-default.md

# 3. If it somehow reads anything other than `done`, then and only then:
multica issue status WEB-544 blocked
```

**Verification:** `multica issue get WEB-544 --output json` shows the expected status, and
`multica issue comment list WEB-544 --roots-only --summary --compact --output json` shows the new
comment.

**Rollback:** `multica issue status WEB-544 todo`. Restores it to open in one command, no board
involvement. Production is not involved at all.

**Irreversible:** nothing. The patch attachment persists on WEB-544 regardless of status. What is
lost is *attention*, not data — this is the only default where the board's silence costs real work
already paid for.

---

## Default #2 — merge question unanswered

**What it does:** nothing merges. The stack is rebased onto current `main`, proved green, and
frozen. No further build work on these PRs until the board answers.

`main` has moved 4 commits since the stack was built (`da5605a`, `0242817`, `e8509df`, `4a47358` —
suppression tooling from WEB-603/WEB-605 plus a briefs chore). The overlap check:

- `main`'s new commits touch: `mission-control/data/briefs.json`, `tools/suppression/*`
- the stack touches 16 files, of which **none** is in that list

so the rebase is expected to be clean. Expected, not guaranteed — the commands below assume it may
not be.

**Record the recovery anchors first. Do not skip this step.**

```bash
git fetch origin
for b in 29b503f3 674da7b1 2ffdbc9a c88779f9 web-543-settings f3bf561a 8f3b2fe0 90953de5; do
  echo "$b $(git rev-parse origin/agent/cto/$b)"
done | tee ./pre-rebase-tips.txt
```

Expected content (short form): `29b503f3 e8be895` · `674da7b1 9d149f8` · `2ffdbc9a 9e56ffa` ·
`c88779f9 739e42d` · `web-543-settings ed90636` · `f3bf561a 25d0a9b` · `8f3b2fe0 472b2f4` ·
`90953de5 d077c4b`.

**Commands, in order.** Rebase bottom-up; each branch is replayed onto the new tip of the one below
it. `OLD` is that branch's base *before* this step ran, taken from `pre-rebase-tips.txt`.

```bash
git fetch origin
git checkout -B agent/cto/29b503f3        origin/agent/cto/29b503f3
git rebase --onto origin/main cf793ea agent/cto/29b503f3    # #65 onto main; cf793ea = current merge-base
npm test && git push --force-with-lease origin agent/cto/29b503f3

git checkout -B agent/cto/674da7b1        origin/agent/cto/674da7b1
git rebase --onto agent/cto/29b503f3 e8be895 agent/cto/674da7b1                      # #66 onto new #65
npm test && git push --force-with-lease origin agent/cto/674da7b1

git checkout -B agent/cto/2ffdbc9a        origin/agent/cto/2ffdbc9a
git rebase --onto agent/cto/674da7b1 9d149f8 agent/cto/2ffdbc9a                      # #67 onto new #66
npm test && git push --force-with-lease origin agent/cto/2ffdbc9a

git checkout -B agent/cto/c88779f9        origin/agent/cto/c88779f9
git rebase --onto agent/cto/2ffdbc9a 9e56ffa agent/cto/c88779f9                      # #68 onto new #67
npm test && git push --force-with-lease origin agent/cto/c88779f9

git checkout -B agent/cto/web-543-settings origin/agent/cto/web-543-settings
git rebase --onto agent/cto/c88779f9 739e42d agent/cto/web-543-settings              # #69 onto new #68
npm test && git push --force-with-lease origin agent/cto/web-543-settings

git checkout -B agent/cto/f3bf561a        origin/agent/cto/f3bf561a
git rebase --onto agent/cto/web-543-settings ed90636 agent/cto/f3bf561a              # #73 onto new #69
npm test && git push --force-with-lease origin agent/cto/f3bf561a

git checkout -B agent/cto/8f3b2fe0        origin/agent/cto/8f3b2fe0
git rebase --onto agent/cto/f3bf561a 25d0a9b agent/cto/8f3b2fe0                      # #74 onto new #73
npm test && git push --force-with-lease origin agent/cto/8f3b2fe0

git checkout -B agent/cto/90953de5        origin/agent/cto/90953de5
git rebase --onto agent/cto/8f3b2fe0 472b2f4 agent/cto/90953de5                      # #76 onto new #74
npm test && git push --force-with-lease origin agent/cto/90953de5
```

The `&&` is load-bearing: **if `npm test` fails, the push does not run.** Leave the branch
unpushed, restore it from `pre-rebase-tips.txt`, and stop.

`npm test` reaches the network (`testimonials:verify` fetches `https://webuildco.com.au`). A
network failure there is not a code failure — re-run once before treating it as red.

**Verification — three checks, all of which must pass:**

```bash
# 1. Nothing merged. All eight still open, mergedAt null.
for n in 65 66 67 68 69 73 74 76; do
  gh pr view $n --repo 048823/Webuildco_v1 --json number,state,mergedAt,baseRefName \
    --jq '"#\(.number) \(.state) merged=\(.mergedAt) base=\(.baseRefName)"'
done
# expected: eight lines, all `OPEN merged=null`, bases chaining #65←main and each PR on the one below

# 2. Production untouched — main unchanged, and the deployed asset still matches main.
git rev-parse origin/main    # must equal 4a47358... (or whatever it was at 21:00, unchanged)
diff <(curl -s https://webuildco.com.au/app.css | shasum -a 256 | cut -d' ' -f1) \
     <(git show origin/main:app.css | shasum -a 256 | cut -d' ' -f1) && echo "production == main"

# 3. The stack is now actually on top of main.
git merge-base --is-ancestor origin/main origin/agent/cto/29b503f3 && echo "stack is current"
```

Do **not** SHA-compare `/mission-control/*` against the repo — that path is password-gated by
`worker.js` (`run_worker_first`), so an unauthenticated `curl` returns the sign-in page, not the
asset. `app.css` is ungated and is the correct probe. Verified 15-Aug 09:30 AEST: deployed `app.css`
matches `origin/main:app.css`.

**Rollback:** for any branch, restore its recorded tip. No board involvement, production untouched
throughout because nothing was ever merged:

```bash
git push --force-with-lease origin <recorded-sha>:refs/heads/agent/cto/<branch>
```

**Irreversible:** nothing — *provided `pre-rebase-tips.txt` was written first*. A force-push
without recorded SHAs is the one way to make this step hard to undo (GitHub keeps the objects, but
finding them means the reflog on whichever machine did the rebase, and this host is awake ~13% of
the time). **Record the tips or do not start.**

---

## Default #3 — sidebar taxonomy → #68's

**Already applied.** WEB-680 resolved it inside the stack: `Company / Marketing / System` wins,
#66's `Sales` and `Outbound` top-level groups are gone (Sales folded into Company, Outbound into
Marketing), and #66's `group` key was dropped for #68's `grp`. `sections.test.mjs` fails the build
on drift away from this.

**Commands at 21:00:** none.

**Verification:**

```bash
git show origin/agent/cto/90953de5:mission-control/app.js | grep -o 'grp: "[A-Za-z]*"' | sort | uniq -c
# expected: only Company / Marketing / System, and no `group:` key anywhere
```

**Rollback:** one commit re-tagging `grp` values. **Irreversible:** nothing.

---

## Default #4 — zero #66's invented pipeline deals

**Already applied** (WEB-660, `done`). The CEO ruled on 13-Aug that this fires regardless of the
board's answer. `sales.deals`, `sales.proposals` and `sales.activities` in `board.json` are all
empty arrays; the "Trades group NSW, A$21,000" line and its siblings are gone, and with them the
fake open-pipeline tile on Overview. `sales.test.mjs` fails on any deal without a `ref`.

**Commands at 21:00:** none.

**Verification:**

```bash
git show origin/agent/cto/90953de5:mission-control/data/board.json \
  | python3 -c "import json,sys; s=json.load(sys.stdin)['sales']; print({k: len(s[k]) for k in ('deals','proposals','activities')})"
# expected: {'deals': 0, 'proposals': 0, 'activities': 0}
```

**Rollback:** `git revert` the WEB-660 commit. Not recommended — restoring it puts fabricated
revenue back in front of the operator, which is the WEB-489 / WEB-544 failure mode.
**Irreversible:** nothing.

---

## Default #5 — #65 CRM ships as a shell, CSV export disabled

**Already applied.** Contacts are sample rows only (every address `@example.com`), and the Export
CSV button carries a literal `disabled` attribute with the reason in its `title`. `crmCsv()` and its
tests are intact, so re-enabling is one attribute once the suppression filter lands. An assertion in
`app.crm.test.mjs` stops a later rebase quietly switching it back on.

This is the compliance-relevant one: an enabled export is the most likely accidental re-import path
for a suppressed contact. It stays off until the suppression filter exists.

**Commands at 21:00:** none.

**Verification:**

```bash
git show origin/agent/cto/90953de5:mission-control/app.js | grep -n 'data-export=' 
# expected: the button line carries `disabled` and the WEB-680 title text
```

**Rollback:** remove the `disabled` attribute — *only after* the suppression filter ships.
**Irreversible:** nothing.

---

## Default #6 — nothing split out

Everything stays on WEB-555. **Commands:** none. **Verification:** no new issues parented to
WEB-555 (`multica issue children e56077f0-91b2-41db-b86e-69f6a666bf79`). **Rollback:** n/a.
**Irreversible:** nothing.

---

## Irreversibility — the plain answer

**No default in this set is irreversible, and none of them touches production.** Nothing merges, so
nothing deploys; `main` stays at `4a47358` through all six.

Three things are worth the board's eye anyway:

1. **Default #2's force-pushes are only reversible because the pre-rebase SHAs are recorded.**
   Recording them is step one of that default and is not optional.
2. **Default #1 is the only one that loses value** — a tested 8-defect patch stops being chased.
   The artifact survives on WEB-544; the momentum does not. It is also the only default whose
   stated action no longer matches reality, so it should not fire as written.
3. **Defaults #3, #4 and #5 already fired.** They cannot be "held" at 21:00 by not answering —
   that ship sailed on 14-Aug. Answering #3/#4/#5 differently now is a new change request against
   the stack, not a decision about a default.

On that basis: **#2 through #6 are safe to fire as written. #1 is not — it should be re-worded or
dropped**, because a literal reading reopens a `done` issue in order to close it again.
