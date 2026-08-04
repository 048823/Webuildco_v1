#!/usr/bin/env python3
"""Content engine check: every /notes/<slug>/ page is structurally sound.

Asserts: valid JSON-LD with Article + BreadcrumbList (+ FAQPage matching the
rendered accordion), exactly one #pageAcc, canonical matching the directory,
title/description present, an index card, and a sitemap entry.

Run from repo root: python3 check_notes.py
"""
import glob
import json
import os
import re
import sys

SITE = "https://www.webuildco.com.au"
index = open("notes/index.html", encoding="utf-8").read()
sitemap = open("sitemap.xml", encoding="utf-8").read()
fail = []

for path in sorted(glob.glob("notes/*/index.html")):
    slug = os.path.basename(os.path.dirname(path))
    h = open(path, encoding="utf-8").read()

    def bad(msg):
        fail.append("%s: %s" % (slug, msg))

    ld_raw = re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
    if not ld_raw:
        bad("no JSON-LD")
        continue
    try:
        ld = json.loads(ld_raw.group(1))
    except ValueError as e:
        bad("JSON-LD does not parse: %s" % e)
        continue
    types = {x["@type"] for x in ld}
    for t in ("Article", "BreadcrumbList"):
        if t not in types:
            bad("missing %s schema" % t)

    accs = re.findall(r'id="pageAcc"', h)
    if len(accs) > 1:
        bad("%d #pageAcc blocks (duplicate id)" % len(accs))
    if "FAQPage" in types:
        if not accs:
            bad("FAQPage schema but no accordion")
        else:
            ld_qs = [q["name"] for x in ld if x["@type"] == "FAQPage" for q in x["mainEntity"]]
            block = h[h.index('id="pageAcc"'):]
            page_qs = re.findall(r'flex-1">([^<]+)</span>', block)[:len(ld_qs)]
            if page_qs != ld_qs:
                bad("FAQPage schema does not match the rendered accordion")

    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', h)
    want = "%s/notes/%s/" % (SITE, slug)
    if not canonical or canonical.group(1) != want:
        bad("canonical is %s, want %s" % (canonical and canonical.group(1), want))

    if not re.search(r"<title>.+</title>", h):
        bad("no title")
    if not re.search(r'<meta name="description" content=".+">', h):
        bad("no meta description")
    if 'href="/notes/%s/"' % slug not in index:
        bad("no card on /notes/")
    if want not in sitemap:
        bad("not in sitemap.xml")

if fail:
    print("\n".join(fail))
    sys.exit(1)
print("ok: %d notes" % len(glob.glob("notes/*/index.html")))
