// Build mission-control/data/briefs.json from the existing WEB-138 report flow.
// Source of truth stays Multica: Board Reports issues + Daily Log comments.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BRIEFS_PATH = join(HERE, "..", "data", "briefs.json");
export const BOARD_REPORTS_PROJECT = "0977c05e-a80a-44e8-8993-d54da1ca9637";
export const DAILY_LOGS_PROJECT = "c3f08609-8138-4af2-983e-f5ce54896df9";

const DAILY_TYPES = new Set(["morning", "eod"]);
const PERIODIC_TYPES = new Set(["weekly", "monthly", "quarterly", "yearly"]);
const DEFAULT_NEXT = ["Review current blockers", "Pick the highest-leverage next action", "Update Mission Control after execution"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const uniq = (items) => {
  const seen = new Set();
  return items.map(clean).filter(Boolean).filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function clean(value) {
  const s = String(value || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*|__|\*/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,-]+|[\s:;.,-]+$/g, "");
  return s.length > 260 ? s.slice(0, 257).replace(/\s+\S*$/, "") + "..." : s;
}

const norm = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function section(md, wanted) {
  const want = norm(wanted);
  const lines = String(md || "").split(/\r?\n/);
  let start = -1, level = 0;
  for (let i = 0; i < lines.length; i++) {
    const hit = /^(#{2,4})\s+(.+?)\s*$/.exec(lines[i]);
    if (!hit) continue;
    const title = norm(hit[2]);
    if (start < 0 && (title.includes(want) || want.includes(title))) {
      start = i + 1;
      level = hit[1].length;
      continue;
    }
    if (start >= 0 && hit[1].length <= level) return lines.slice(start, i).join("\n").trim();
  }
  return start >= 0 ? lines.slice(start).join("\n").trim() : "";
}

export function listItems(md) {
  return uniq(String(md || "").split(/\r?\n/).map((line) => {
    const hit = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
    return hit ? hit[1] : "";
  }));
}

function paragraphs(md, n = 3) {
  return uniq(String(md || "").split(/\n{2,}/).map((p) => clean(p)).filter((p) => p && !p.startsWith("|")).slice(0, n));
}

function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(clean);
}

function isSeparatorRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()).every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function tableRows(md) {
  const rows = String(md || "").split(/\r?\n/).filter((line) => /^\s*\|.*\|\s*$/.test(line));
  if (rows.length < 2) return [];
  const headers = splitRow(rows[0]).map(norm);
  return rows.slice(1).filter((row) => !isSeparatorRow(row)).map((row) => {
    const cells = splitRow(row);
    return headers.reduce((out, header, i) => ({ ...out, [header]: cells[i] || "" }), {});
  });
}

function findDate(text) {
  const hit = /(20\d{2}-\d{2}-\d{2})/.exec(text || "");
  return hit ? hit[1] : "";
}

function headingDate(text) {
  const hit = /^#{2,4}[^\n]*(20\d{2}-\d{2}-\d{2})/m.exec(text || "");
  return hit ? hit[1] : "";
}

function dateFrom(content, title, fallbackIso) {
  const found = headingDate(content) || findDate(title) || findDate(content);
  if (found) return found;
  const d = new Date(fallbackIso || Date.now());
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function labelDate(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[d.getUTCDay()]}, ${String(day).padStart(2, "0")} ${MONTHS[month - 1]}`;
}

function finishBrief({ type, date, generated_at, wins, next3, industry_pulse = [] }) {
  const safeWins = uniq(wins).slice(0, 8);
  const safeNext = uniq(next3).slice(0, 3);
  for (const item of [...safeWins, ...DEFAULT_NEXT]) {
    if (safeNext.length >= 3) break;
    if (!safeNext.some((next) => next.toLowerCase() === item.toLowerCase())) safeNext.push(item);
  }
  const brief = {
    id: `${type}-${date}`,
    type,
    period_label: labelDate(date),
    generated_at,
    wins: safeWins,
    next3: safeNext,
  };
  const pulse = uniq(industry_pulse).slice(0, 4);
  if (type === "morning" && pulse.length) brief.industry_pulse = pulse;
  return brief;
}

export function makeMorningBrief({ title, content, generated_at }) {
  const date = dateFrom(content, title, generated_at);
  const keyFindings = section(content, "Key findings from the night");
  const progress = section(content, "Progress Since Yesterday");
  const priorityRows = tableRows(section(content, "Today's Priorities"));
  const wins = listItems(keyFindings).length ? listItems(keyFindings) : [...listItems(progress), ...paragraphs(progress, 2)];
  const suggested = section(content, "Suggested priorities") || section(content, "Questions requiring human decisions");
  const next3 = priorityRows.map((row) => row.priority || Object.values(row)[1]).filter(Boolean).concat(listItems(suggested));
  const pulse = listItems(section(content, "Industry Pulse") || section(content, "Risks discovered overnight") || section(content, "Risks discovered"));
  return finishBrief({ type: "morning", date, generated_at, wins, next3, industry_pulse: pulse });
}

export function makeEodBrief({ title, content, generated_at }) {
  const date = dateFrom(content, title, generated_at);
  const outcomes = tableRows(section(content, "Outcomes Completed"));
  const incomplete = tableRows(section(content, "Incomplete Work"));
  const overnight = tableRows(section(content, "Overnight Research Requests"));
  const wins = outcomes.map((row) => [row.outcome, row.result].filter(Boolean).join(": ")).concat(listItems(section(content, "Outcomes Completed")));
  const next3 = incomplete.map((row) => [row.task, row["next action"]].filter(Boolean).join(": "))
    .concat(overnight.map((row) => row["research question"] || row["desired output"]))
    .concat(listItems(section(content, "Must continue tomorrow")));
  return finishBrief({ type: "eod", date, generated_at, wins, next3 });
}

function multicaJson(args) {
  return JSON.parse(execFileSync("multica", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
}

function issueList(projectId) {
  return multicaJson(["issue", "list", "--project", projectId, "--sort", "created_at", "--direction", "desc", "--limit", "60", "--output", "json"]).issues || [];
}

function comments(issueId) {
  return multicaJson(["issue", "comment", "list", issueId, "--recent", "50", "--output", "json"]);
}

function firstReportComment(issue, pattern) {
  return comments(issue.id).find((c) => pattern.test(c.content || ""));
}

export function mergeBriefs(existing, incoming) {
  const byId = new Map((existing || []).map((b) => [b.id, b]));
  incoming.forEach((brief) => byId.set(brief.id, brief));
  return [...byId.values()].sort((a, b) => String(b.generated_at || "").localeCompare(String(a.generated_at || "")));
}

function buildDailyBriefs() {
  const picked = new Map();
  const add = (brief, priority) => {
    const current = picked.get(brief.id);
    if (!current || priority >= current.priority) picked.set(brief.id, { brief, priority });
  };

  for (const issue of issueList(BOARD_REPORTS_PROJECT)) {
    if (issue.status === "cancelled") continue;
    if (/Morning Standup/i.test(issue.title || "")) {
      const c = firstReportComment(issue, /##\s+Morning Standup/i);
      if (c) add(makeMorningBrief({ title: issue.title, content: c.content, generated_at: c.created_at }), 2);
    } else if (/End of Day/i.test(issue.title || "")) {
      const c = firstReportComment(issue, /##\s+End-of-Day Report/i);
      if (c) add(makeEodBrief({ title: issue.title, content: c.content, generated_at: c.created_at }), 3);
    }
  }

  for (const issue of issueList(DAILY_LOGS_PROJECT)) {
    for (const c of comments(issue.id)) {
      if (/Morning Intelligence Brief/i.test(c.content || "")) {
        add(makeMorningBrief({ title: issue.title, content: c.content, generated_at: c.created_at }), 4);
      } else if (/##\s+Day Close/i.test(c.content || "")) {
        add(makeEodBrief({ title: issue.title, content: c.content, generated_at: c.created_at }), 1);
      }
    }
  }
  return [...picked.values()].map((x) => x.brief);
}

function sydYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function periodFor(type, now = new Date(), mode = "current") {
  const today = sydYmd(now);
  const [y, m, d] = today.split("-").map(Number);
  if (type === "weekly") {
    const date = new Date(Date.UTC(y, m - 1, d));
    const day = date.getUTCDay() || 7;
    const start = addDays(today, (mode === "previous" ? -6 : 1) - day);
    return { start, end: addDays(start, 6), label: `Week of ${labelDate(start)}` };
  }
  if (type === "monthly") {
    const first = new Date(Date.UTC(y, m - (mode === "previous" ? 2 : 1), 1));
    const start = first.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { start, end, label: new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric" }).format(first) };
  }
  if (type === "quarterly") {
    const q = Math.floor((m - 1) / 3) + 1;
    const currentStartMonth = (q - 1) * 3 + 1;
    const first = new Date(Date.UTC(y, currentStartMonth - (mode === "previous" ? 4 : 1), 1));
    const start = first.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 3, 0)).toISOString().slice(0, 10);
    return { start, end, label: `Q${Math.floor(first.getUTCMonth() / 3) + 1} ${first.getUTCFullYear()}` };
  }
  const year = mode === "previous" ? y - 1 : y;
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
}

function briefDate(brief) {
  return (/\d{4}-\d{2}-\d{2}/.exec(brief.id || "") || [String(brief.generated_at || "").slice(0, 10)])[0];
}

export function makeAggregateBrief(type, briefs, now = new Date()) {
  const period = periodFor(type, now, process.env.BRIEF_PERIOD || "current");
  const source = briefs.filter((b) => DAILY_TYPES.has(b.type) && briefDate(b) >= period.start && briefDate(b) <= period.end);
  const date = type === "weekly" ? period.start : period.end;
  return {
    id: `${type}-${date}`,
    type,
    period_label: period.label,
    generated_at: now.toISOString(),
    wins: uniq(source.flatMap((b) => b.wins || [])).slice(0, 10),
    next3: uniq(source.flatMap((b) => b.next3 || [])).slice(0, 3).concat(DEFAULT_NEXT).slice(0, 3),
  };
}

function readBriefs() {
  if (!existsSync(BRIEFS_PATH)) return [];
  const parsed = JSON.parse(readFileSync(BRIEFS_PATH, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}

function git(...args) {
  return execFileSync("git", args, { cwd: join(HERE, "..", ".."), encoding: "utf8", stdio: "pipe" }).trim();
}

function maybeCommit() {
  git("add", BRIEFS_PATH);
  try {
    git("diff", "--cached", "--quiet", "--", BRIEFS_PATH);
    console.log("briefs.json unchanged");
    return;
  } catch {
    git("commit", "-m", "chore(mission-control): update briefs [skip ci]");
    if (process.env.GIT_PUSH === "1") git("push", "origin", "HEAD:main");
    console.log(process.env.GIT_PUSH === "1" ? "briefs.json committed and pushed" : "briefs.json committed; GIT_PUSH!=1 so not pushed");
  }
}

function selectedType() {
  const idx = process.argv.indexOf("--type");
  return (idx >= 0 ? process.argv[idx + 1] : process.env.BRIEF_TYPE || "all").toLowerCase();
}

export function buildBriefs(type = "all", now = new Date()) {
  const types = type === "all" ? [...DAILY_TYPES, ...PERIODIC_TYPES] : [type];
  const current = readBriefs();
  const daily = types.some((t) => DAILY_TYPES.has(t)) ? buildDailyBriefs().filter((b) => types.includes(b.type) || type === "all") : [];
  let merged = mergeBriefs(current, daily);
  const periodic = types.filter((t) => PERIODIC_TYPES.has(t)).map((t) => makeAggregateBrief(t, merged, now));
  merged = mergeBriefs(merged, periodic);
  writeFileSync(BRIEFS_PATH, JSON.stringify(merged, null, 2) + "\n");
  return { count: merged.length, generated: [...daily, ...periodic].length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const type = selectedType();
  if (type !== "all" && !DAILY_TYPES.has(type) && !PERIODIC_TYPES.has(type)) {
    console.error(`unknown --type ${type}; expected all, morning, eod, weekly, monthly, quarterly, yearly`);
    process.exit(1);
  }
  try {
    const out = buildBriefs(type);
    console.log(`wrote ${out.count} briefs (${out.generated} generated this run)`);
    if (process.env.GIT_COMMIT === "1" || process.env.GIT_PUSH === "1") maybeCommit();
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
