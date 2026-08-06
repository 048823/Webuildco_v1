import assert from "node:assert";
import { makeAggregateBrief, makeEodBrief, makeMorningBrief, tableRows } from "./build-briefs.mjs";
import { barChartPng, renderEmailHtml, renderTelegramText } from "./renderers.mjs";

const morning = makeMorningBrief({
  title: "Board Report - Morning Standup 2026-07-20",
  generated_at: "2026-07-19T22:07:58Z",
  content: `## Morning Standup

### Progress Since Yesterday
- Runtime root-caused with logs.
- Content chain is running.

### Risks discovered overnight
- Daemon still dies on reboot.

## Today's Priorities
| Rank | Priority | Goal |
|---|---|---|
| 1 | Clear the board decision queue | Sign clients |
| 2 | GO-day prep executes | Sign clients |
| 3 | Post #3 publish package | Content |
`,
});

assert.equal(morning.id, "morning-2026-07-20");
assert.equal(morning.type, "morning");
assert.equal(morning.next3.length, 3);
assert.equal(morning.next3[0], "Clear the board decision queue");
assert.equal(morning.industry_pulse[0], "Daemon still dies on reboot");

const eod = makeEodBrief({
  title: "Board Report - End of Day 2026-07-19",
  generated_at: "2026-07-19T12:20:31Z",
  content: `## End-of-Day Report

### Outcomes Completed
| Outcome | Goal | Project | Result | Evidence |
|---|---|---|---|---|
| Bounce preview URL delivered | Ops | Websites | Working preview posted | WEB-212 |

### Incomplete Work
| Task | Reason | Owner | Next Action | New Deadline |
|---|---|---|---|---|
| Morning Standup | Autopilot failed | CEO | Tomorrow's standup must fire | 2026-07-20 |
`,
});

assert.equal(eod.id, "eod-2026-07-19");
assert.equal(eod.wins[0], "Bounce preview URL delivered: Working preview posted");
assert.equal(eod.next3[0], "Morning Standup: Tomorrow's standup must fire");

const rows = tableRows(`| A | B |
|---|---|
| x | y |`);
assert.deepEqual(rows, [{ a: "x", b: "y" }]);

const weekly = makeAggregateBrief("weekly", [morning, eod], new Date("2026-07-20T00:00:00Z"));
assert.equal(weekly.type, "weekly");
assert.equal(weekly.next3.length, 3);

const png = Buffer.from(barChartPng([1, 3, 2]), "base64");
assert.equal(png.slice(1, 4).toString("ascii"), "PNG");
assert(renderEmailHtml(morning, [morning]).includes("data:image/png;base64,"));
assert(renderTelegramText(eod).includes("End of Day Brief"));

console.log("ok - brief parser and renderers");
