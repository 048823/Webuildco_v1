// The one processing path for ALL intake channels (WEB-120). Telegram-drop and
// watch-folder both do the same thing: land a receipt file in INBOX_DIR. This
// runs on a Hermes cron, and for each file: extract → validate/log to
// board.json → move the source OUT of the repo into RECEIPTS_DIR (ATO retention,
// but never committed) → commit + push board.json so Cloudflare Pages goes live.
//
// Env: INBOX_DIR, RECEIPTS_DIR (both outside the repo), ANTHROPIC_API_KEY,
//      GIT_PUSH=1 to push (default: log only, no push — safe dry run).
// ponytail: sequential, one file at a time. Receipts arrive in ones/twos a day;
//           parallel + a queue only if that ever changes.

import { readdirSync, renameSync, mkdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { extractExpense } from "./extract.mjs";
import { logExpense, BOARD_PATH } from "./log-expense.mjs";

const INBOX = process.env.INBOX_DIR;
const RECEIPTS = process.env.RECEIPTS_DIR;
const ACCEPT = /\.(jpe?g|png|webp|gif|pdf)$/i;

if (!INBOX || !RECEIPTS) { console.error("set INBOX_DIR and RECEIPTS_DIR"); process.exit(1); }
mkdirSync(RECEIPTS, { recursive: true });

const git = (...args) => execFileSync("git", args, { cwd: process.cwd(), stdio: "pipe" }).toString().trim();

const files = readdirSync(INBOX).filter((f) => ACCEPT.test(f) && statSync(join(INBOX, f)).isFile());
if (!files.length) { console.log("inbox empty"); process.exit(0); }

let logged = 0;
for (const name of files) {
  const src = join(INBOX, name);
  try {
    const fields = await extractExpense(src, "Hermes");
    const added = logExpense(fields);
    renameSync(src, join(RECEIPTS, name)); // retain off-repo, only after a clean log
    console.log(`✓ ${added.supplier} $${added.amount} (GST $${added.gst}) — ${name}`);
    logged++;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`); // leave in inbox for a retry / manual look
  }
}

if (logged && process.env.GIT_PUSH === "1") {
  git("add", BOARD_PATH);
  git("commit", "-m", `chore(finance): log ${logged} receipt${logged > 1 ? "s" : ""} [skip ci]`);
  git("push");
  console.log(`pushed board.json (${logged} logged)`);
} else if (logged) {
  console.log(`${logged} logged to board.json — GIT_PUSH!=1, not pushed (dry run)`);
}
