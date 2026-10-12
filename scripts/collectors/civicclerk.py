"""Collector for CivicClerk sites (CivicPlus's newer agenda system; many AgendaCenter cities have moved to it).

CivicClerk has a public OData API per city ("tenant"), e.g. https://stpetersmo.api.civicclerk.com/v1/Events.
Unlike AgendaCenter it lists scheduled future meetings too, with times and locations.

  python scripts/collectors/civicclerk.py tenant https://www.stpetersmo.net
  python scripts/collectors/civicclerk.py categories stpetersmo
  python scripts/collectors/civicclerk.py meetings stpeters stpetersmo [--year 2026] [--out file.json]
  python scripts/collectors/civicclerk.py check stpeters stpetersmo data/meetings.json [--year 2026]

Times in the API carry a "Z" but are the city's local time (St. Peters P&Z at 6:30 PM shows 18:30Z).
"""
import json
import re
import sys
import urllib.parse
from datetime import date

from agendacenter import Blocked, body_for, fetch, not_hearing


def api(tenant, path, **query):
    q = urllib.parse.urlencode(query, safe="$ ")
    return f"https://{tenant}.api.civicclerk.com/v1/{path}" + (f"?{q}" if q else "")


def get_json(url):
    return json.loads(fetch(url))


def tenant_for(site):
    """Find a city's CivicClerk tenant name from links on its website."""
    pages = [site.rstrip("/")]
    try:
        landed, page = fetch(pages[0], final=True)
    except Blocked:
        return None
    hit = re.search(r"https?://([a-z0-9-]+)\.(?:portal|api)\.civicclerk\.com", page, re.I)
    if hit:
        return hit.group(1).lower()
    # Agenda links are often one click away.
    for href in re.findall(r'href="([^"#]+)"[^>]*>[^<]{0,60}(?:agenda|meeting|minutes)', page, re.I)[:8]:
        try:
            sub = fetch(urllib.parse.urljoin(landed, href))
        except Exception:
            continue
        hit = re.search(r"https?://([a-z0-9-]+)\.(?:portal|api)\.civicclerk\.com", sub, re.I)
        if hit:
            return hit.group(1).lower()
    return None


def categories(tenant):
    rows = get_json(api(tenant, "EventCategories"))["value"]
    return [{"cat_id": r["id"], "name": r["categoryDesc"], "body": body_for(r["categoryDesc"])} for r in rows if r.get("isPublic")]


def events(tenant, year):
    """All events in a calendar year. The API returns at most 15 per page whatever $top says, so page with $skip."""
    flt = f"startDateTime ge {year}-01-01T00:00:00Z and startDateTime lt {year + 1}-01-01T00:00:00Z"
    out = []
    while True:
        page = get_json(api(tenant, "Events", **{"$filter": flt, "$orderby": "startDateTime", "$skip": len(out)}))["value"]
        if not page:
            return out
        out += page


def meetings(jurisdiction_id, tenant, year):
    """P&Z and governing-body meetings (past and scheduled), one row per meeting date and board."""
    rows = {}
    for e in events(tenant, year):
        body = body_for(e.get("categoryName") or e.get("eventCategoryName") or "")
        if not body or not_hearing(e["eventName"]) or e.get("isDeleted"):
            continue
        local = e["startDateTime"][:16]  # "YYYY-MM-DDTHH:MM", already local time
        files = {f["type"]: f["fileId"] for f in e.get("publishedFiles") or []}
        file_url = lambda fid: api(tenant, f"Meetings/GetMeetingFileStream(fileId={fid},plainText=false)") if fid else None
        loc = e.get("eventLocation") or {}
        key = (body, local[:10])
        if key in rows:
            continue
        rows[key] = {
            "jurisdiction_id": jurisdiction_id, "body": body, "event_type": "meeting",
            "board": e.get("categoryName"), "title": e["eventName"],
            "event_date": local[:10], "event_time": local[11:16] if local[11:16] != "00:00" else None,
            "location": ", ".join(x for x in [loc.get("address1"), loc.get("address2")] if x) or None,
            "agenda_url": file_url(files.get("Agenda")),
            "packet_url": file_url(files.get("Agenda Packet")),
            "minutes_url": file_url(files.get("Minutes")),
            "portal_url": f"https://{tenant}.portal.civicclerk.com/event/{e['id']}/files",
        }
    return sorted(rows.values(), key=lambda r: (r["event_date"], r["body"]))


def check(jurisdiction_id, tenant, known_file, year):
    """Compare with hand-researched meetings: dates in both directions, and meeting times where both have one."""
    known = [m for m in json.load(open(known_file))
             if m["jurisdiction_id"] == jurisdiction_id and m["event_type"] == "meeting"
             and m["event_date"].startswith(str(year))]
    got = meetings(jurisdiction_id, tenant, year)
    kmap = {(m["body"], m["event_date"]): m for m in known}
    gmap = {(m["body"], m["event_date"]): m for m in got}
    both = kmap.keys() & gmap.keys()
    print(f"{jurisdiction_id} {year}: collected {len(gmap)}, hand-researched {len(kmap)}, matched {len(both)}")
    for k in sorted(kmap.keys() - gmap.keys()):
        print(f"  missing from CivicClerk: {k[1]} {k[0]} ({kmap[k].get('status')})")
    for k in sorted(gmap.keys() - kmap.keys()):
        print(f"  not in our data: {k[1]} {k[0]} {gmap[k]['title']}")
    for k in sorted(both):
        kt, gt = (kmap[k].get("event_time") or "")[:5], gmap[k]["event_time"] or ""
        if kt and gt and kt != gt:
            print(f"  time differs: {k[1]} {k[0]} ours {kt}, CivicClerk {gt}")
    return got


def main(argv):
    year = date.today().year
    if "--year" in argv:
        year = int(argv[argv.index("--year") + 1])
    out = argv[argv.index("--out") + 1] if "--out" in argv else None
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "tenant":
        print(tenant_for(argv[2]) or "no CivicClerk link found")
        return
    if cmd == "categories":
        for c in categories(argv[2]):
            print(f'{c["cat_id"]:>4}  {c["body"] or "-":16} {c["name"]}')
        return
    if cmd == "meetings":
        rows = meetings(argv[2], argv[3], year)
    elif cmd == "check":
        rows = check(argv[2], argv[3], argv[4], year)
    else:
        print(__doc__)
        sys.exit(1)
    if out:
        json.dump(rows, open(out, "w"), indent=1)
    elif cmd == "meetings":
        print(json.dumps(rows, indent=1))


if __name__ == "__main__":
    main(sys.argv)
