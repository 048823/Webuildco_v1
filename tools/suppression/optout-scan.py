#!/usr/bin/env python3
"""Reconcile the suppression store against Instantly. Read-only.

WEB-404 / WEB-497. Never sends, never writes to a campaign, never writes to the
Instantly blocklist — that call lives in lib/blocklist-write.mjs and is off.

Ground truth is `GET /api/v2/emails` (WEB-497 ruling 4): our internal counts were
wrong by 26 people, so the store is rebuilt from the API on every run rather than
appended to. Output is the store file the pre-send gate reads:

    {"generated_at": ..., "entries": [...], "pending": [...], "bulk_create_payload": {...}}

Entries come from three sources, unioned: the Instantly blocklist, opt-out
replies classified out of `/emails`, and two local lists — `domain-blocklist.txt`
(repo-tracked, domains) and `$SUPPRESSION_SEED` (off-repo, addresses).

Usage:
    python3 tools/suppression/optout-scan.py    # rebuild the store
    python3 tools/suppression/optout-scan.py --selftest

Env:
    SUPPRESSION_STORE  store path (default runs/suppression/suppression-list.json)
    SUPPRESSION_SEED   optional file of addresses to fold in. Keep it out of the
                       repo: it is personal data and this repo is served publicly.
                       Optional because it holds only addresses — anything that
                       must survive a rebuild belongs in domain-blocklist.txt,
                       which is repo-tracked and required (WEB-605).
"""

import argparse
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

API = "https://api.instantly.ai/api/v2"
AEST = datetime.timezone(datetime.timedelta(hours=10))
OP_VAULT = "Claude Code"
OP_ITEM = "Instantly Read Only API 3"
STORE = os.environ.get("SUPPRESSION_STORE", "runs/suppression/suppression-list.json")
SEED = os.environ.get("SUPPRESSION_SEED")
# Repo-tracked, so it survives a rebuild on any machine and is reviewable.
# Not an env var: a path you can point elsewhere is a path that can go missing.
DOMAIN_BLOCKLIST = pathlib.Path(__file__).with_name("domain-blocklist.txt")

# Free-text opt-out intent. The live sequence's opt-out line is "Prefer I stop?
# Just reply and let me know." — it names no keyword, so requests arrive as
# ordinary human sentences and there is no single token to match on.
OPT_OUT_PATTERNS = [
    r"\bunsubscribe\b",
    r"\bopt(?:ing)?[- ]?out\b",
    r"\b(?:please\s+)?(?:remove|take)\s+me\s+(?:off|from|out)\b",
    r"\btake\s+us\s+off\b",
    r"\bremove\s+(?:me|us|this|my|our)\b",
    r"\b(?:do\s*n[o']?t|please\s+don'?t|stop)\s+(?:contact|email|emailing|messaging)",
    r"\bno\s+(?:further|more)\s+(?:emails?|contact|messages?)\b",
    r"\bstop\s+(?:emailing|sending|contacting)\b",
    r"^\s*stop\b",
    r"\byes\s*,?\s*(?:please\s+)?stop\b",
    r"\bprefer\s+(?:you|that\s+you)\s+stop\b",
    r"\btake\s+me\s+off\s+your\s+list\b",
]

# Vendor auto-responders. These are not opt-outs and must not be suppressed —
# doing so would silently blocklist a live prospect who was merely on leave.
AUTO_REPLY_SUBJECT = re.compile(
    r"(auto(?:matic)?[\s-]?reply|out of (?:the )?office|on (?:extended )?leave"
    r"|away from|autoresponse|auto[\s-]?response|\[auto)",
    re.I,
)
AUTO_REPLY_BODY = re.compile(
    r"(out of (?:the )?office|currently (?:travel|on leave|away)"
    r"|limited access to my emails|acknowledge the receipt|i am on extended leave)",
    re.I,
)

EMAIL_IN_TEXT = re.compile(r"[^\s,;<>\"']+@[^\s,;<>\"']+\.[a-z]{2,}", re.I)

# A seed line holding a bare domain, with or without a leading '@'. Anything
# else on the line (a name, a CSV header) is not a domain and is skipped.
SEED_DOMAIN = re.compile(r"^\s*@?([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\s*$", re.I)


def read_key():
    """Env first, then 1Password. The env copy has gone stale before (06-Aug)."""
    for src, key in (("env", os.environ.get("INSTANTLY_API_KEY")), ("op", _op_key())):
        if key and _key_works(key):
            return src, key
    sys.exit("no working Instantly read key in env or 1Password")


def _op_key():
    try:
        raw = subprocess.run(
            ["op", "item", "get", OP_ITEM, "--vault", OP_VAULT, "--format", "json"],
            capture_output=True, text=True, timeout=30,
        ).stdout
        fields = json.loads(raw)["fields"]
        return next(f["value"] for f in fields if f.get("label") == "credential")
    except Exception:
        return None


def _key_works(key):
    try:
        get("/campaigns?limit=1", key)
        return True
    except Exception:
        return False


def get(path, key):
    req = urllib.request.Request(
        API + path,
        # ponytail: urllib's default User-Agent gets a 403 from Instantly's edge.
        headers={"Authorization": "Bearer " + key, "User-Agent": "curl/8.7.1"},
    )
    return json.load(urllib.request.urlopen(req, timeout=60))


def paginate(path, key, cap=50):
    items, after, sep = [], None, "&" if "?" in path else "?"
    for _ in range(cap):
        page = get(path + (f"{sep}starting_after={after}" if after else ""), key)
        batch = page.get("items", [])
        items += batch
        after = page.get("next_starting_after")
        if not after or not batch:
            break
    return items


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


def classify(subject, body):
    """-> 'auto_reply' | 'opt_out' | 'other'.

    Auto-reply wins over opt-out: a vendor bounce saying "I am out of the office,
    do not contact me until August" is not a request to be removed, and
    suppressing it would burn a live prospect.
    """
    text = f"{subject or ''}\n{strip_html(body)}"
    if AUTO_REPLY_SUBJECT.search(subject or "") or AUTO_REPLY_BODY.search(text):
        return "auto_reply"
    for pat in OPT_OUT_PATTERNS:
        if re.search(pat, text, re.I | re.M):
            return "opt_out"
    return "other"


def due_date(requested, business_days=5):
    """Spam Act s 16(9): the request must be honoured within 5 business days.

    ponytail: weekends only, public holidays ignored. That makes the computed
    deadline earlier than the statutory one, never later, so the error is always
    in the direction of compliance. Add a holiday calendar if the margin ever
    gets tight.
    """
    d = requested.astimezone(AEST).date()
    left = business_days
    while left:
        d += datetime.timedelta(days=1)
        if d.weekday() < 5:
            left -= 1
    return d


def seed_entries():
    """Addresses suppressed by board ruling rather than by a reply — WEB-468's
    571 Migration Agents set. Held outside the repo; absent is not an error, but
    an unreadable seed is, because a silently empty seed is a silent breach.

    A line that is a bare domain suppresses everyone at that domain: the gate
    already treats a domain entry as account-wide (lib/address.mjs), and an
    opt-out from one person at a firm has to stop the colleague who arrives as
    a fresh lead next month (WEB-603)."""
    if not SEED:
        return []
    found = set()
    for line in pathlib.Path(SEED).read_text().splitlines():
        addresses = {m.group(0).lower() for m in EMAIL_IN_TEXT.finditer(line)}
        if addresses:
            found |= addresses
            continue
        domain = SEED_DOMAIN.match(line)
        if domain:
            found.add(domain.group(1).lower())
    return sorted(found)


def domain_entries(path=None):
    """Domains suppressed account-wide — repo-tracked, so they survive a rebuild
    on any machine and get review and history for free (WEB-605).

    Fails closed twice over: a missing file raises, and a line that is not a
    bare domain stops the rebuild rather than being skipped. A typo'd domain
    that got silently dropped would read as "suppressed" while sending.
    """
    path = pathlib.Path(path or DOMAIN_BLOCKLIST)
    found = set()
    for number, raw in enumerate(path.read_text().splitlines(), 1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        domain = SEED_DOMAIN.match(line)
        if not domain:
            raise SystemExit(f"{path}:{number}: not a bare domain: {line!r} — refusing to rebuild the store")
        found.add(domain.group(1).lower())
    return sorted(found)


def scan():
    src, key = read_key()
    now = datetime.datetime.now(AEST)
    print(f"key source: {src} | scan at {now:%Y-%m-%d %H:%M} AEST\n")

    blocked = {e["bl_value"].lower(): e for e in paginate("/block-lists-entries?limit=100", key)}
    print(f"INSTANTLY BLOCKLIST  {len(blocked)} entries")

    emails = paginate("/emails?limit=100", key)
    inbound = [e for e in emails if e.get("ue_type") != 1]
    outbound = [e for e in emails if e.get("ue_type") == 1]
    print(f"SENDS                {len(outbound)} messages to {len({e['lead'] for e in outbound})} people")
    print(f"INBOUND              {len(inbound)} replies\n")

    pending, buckets = [], {"auto_reply": 0, "opt_out": 0, "other": 0}
    for e in inbound:
        body = e.get("body") or {}
        verdict = classify(e.get("subject"), body.get("text") or body.get("html"))
        buckets[verdict] += 1
        if verdict != "opt_out":
            continue
        addr = (e.get("lead") or "").lower()
        requested = datetime.datetime.fromisoformat(e["timestamp_email"].replace("Z", "+00:00"))
        entry = blocked.get(addr)
        pending.append({
            "address": addr,
            "requested_at": e["timestamp_email"],
            "due": str(due_date(requested)),
            "suppressed_at": entry["timestamp_created"] if entry else None,
            "state": "suppressed" if entry else "PENDING",
            "overdue": not entry and datetime.date.today() > due_date(requested),
        })

    print(f"CLASSIFIED           {buckets}\n")
    if not pending:
        print("No opt-out requests found. Backfill is empty — verified, not assumed.")
    for p in pending:
        flag = " ** OVERDUE **" if p["overdue"] else ""
        print(f"  {p['state']:10} {p['address']:40} requested {p['requested_at'][:10]} due {p['due']}{flag}")

    # The store the gate reads. Pending opt-outs are in it from this moment —
    # suppression does not wait on the Instantly write landing (WEB-497 ruling 2).
    seed = seed_entries()
    domains = domain_entries()
    entries = sorted(set(blocked) | {p["address"] for p in pending} | set(seed) | set(domains))
    unsuppressed = [p["address"] for p in pending if p["state"] == "PENDING"]

    path = pathlib.Path(STORE)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "generated_at": now.isoformat(),
        "entries": entries,
        "pending": pending,
        # POST /api/v2/block-lists-entries/bulk-create — body field is `bl_values`
        # (plural, array of strings). The singular `bl_value` belongs to the
        # single-entry endpoint; an earlier staged payload mixed the two.
        "bulk_create_payload": {"bl_values": unsuppressed},
    }, indent=2))

    # Read back what was written, not what we meant to write: this is the check
    # that a rebuild cannot silently drop a suppressed domain (WEB-605).
    written = set(json.loads(path.read_text())["entries"])
    dropped = [d for d in domains if d not in written]
    if dropped:
        raise SystemExit(f"REBUILD FAILED — suppressed domain(s) absent from {path}: {', '.join(dropped)}")

    print(f"\nSTORE  {len(entries)} entries -> {path}"
          f"  (instantly {len(blocked)}, opt-outs {len(pending)}, seed {len(seed)}, domains {len(domains)})")
    print(f"STAGED {len(unsuppressed)} address(es) for block_list_entries:create — write stays off (WEB-468)")
    return pending


def selftest():
    cases = [
        ("Automatic reply: About your intake", "I am currently out of office", "auto_reply"),
        ("Re: About your intake", "I am on extended leave. My inbox is being monitored", "auto_reply"),
        ("Auto-Reply from Zeolla", "WE ACKNOWLEDGE THE RECEIPT OF YOUR EMAIL", "auto_reply"),
        ("Re: Quick question", "Please remove me from your list.", "opt_out"),
        ("Re: Quick question", "not interested, take me off", "opt_out"),
        ("Re: Quick question", "stop", "opt_out"),
        ("Re: Quick question", "Yes please stop.", "opt_out"),
        ("Re: Quick question", "Do not contact me again.", "opt_out"),
        ("Re: Quick question", "unsubscribe", "opt_out"),
        ("Re: Quick question", "<p>No further emails thanks</p>", "opt_out"),
        ("Re: Quick question", "Sure, happy to chat. Thursday work?", "other"),
        ("Re: Quick question", "What does this cost?", "other"),
        # The trap: leave notice that also says "do not email" is NOT an opt-out.
        ("Out of office", "Please do not email me until 10 August.", "auto_reply"),
    ]
    for subject, body, want in cases:
        got = classify(subject, body)
        assert got == want, f"{subject!r}/{body!r}: got {got}, want {want}"

    mon = datetime.datetime(2026, 8, 3, 10, 0, tzinfo=AEST)
    assert due_date(mon) == datetime.date(2026, 8, 10), due_date(mon)   # Mon -> next Mon
    fri = datetime.datetime(2026, 8, 7, 10, 0, tzinfo=AEST)
    assert due_date(fri) == datetime.date(2026, 8, 14), due_date(fri)   # Fri -> next Fri

    found = {m.group(0) for m in EMAIL_IN_TEXT.finditer("a@b.com.au,X\n<c.d+tag@e.com>")}
    assert found == {"a@b.com.au", "c.d+tag@e.com"}, found

    global SEED
    seed_file = pathlib.Path(__file__).parent / ".selftest-seed.txt"
    seed_file.write_text("A@B.com.au\n@Blocked-Domain.com\nother.com\nemail,first name\n\n")
    was, SEED = SEED, str(seed_file)
    try:
        got = seed_entries()
    finally:
        SEED = was
        seed_file.unlink()
    assert got == ["a@b.com.au", "blocked-domain.com", "other.com"], got

    blocklist = pathlib.Path(__file__).parent / ".selftest-domains.txt"
    blocklist.write_text("# comment\n\nVanuatuAdvance.com  # trailing note\nother.com\n")
    try:
        assert domain_entries(blocklist) == ["other.com", "vanuatuadvance.com"], domain_entries(blocklist)
        # A line that is not a bare domain stops the rebuild instead of vanishing.
        blocklist.write_text("dean@vanuatuadvance.com\n")
        try:
            domain_entries(blocklist)
            raise AssertionError("an address in domain-blocklist.txt must stop the rebuild")
        except SystemExit:
            pass
    finally:
        blocklist.unlink()

    # The live file the rebuild reads — the durability the whole exercise is for.
    assert "vanuatuadvance.com" in domain_entries(), "WEB-605: the domain must be repo-tracked"
    print(f"selftest OK — {len(cases)} classifier cases, 2 clock cases, 2 seed-parse cases, 3 domain-blocklist cases")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    selftest() if args.selftest else scan()
