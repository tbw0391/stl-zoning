"""Collector for CivicPlus AgendaCenter sites (about half of St. Louis-area governments).

Lists each board ("category") on a site's /AgendaCenter page, pulls its posted agendas for a year,
and maps P&Z and council/aldermen boards onto our meetings.body values.

  python scripts/collectors/agendacenter.py categories https://www.sccmo.org
  python scripts/collectors/agendacenter.py meetings stcharles_county https://www.sccmo.org [--year 2026] [--out file.json]
  python scripts/collectors/agendacenter.py check stcharles_county https://www.sccmo.org data/meetings.json [--year 2026]

AgendaCenter only lists meetings whose agenda has been posted (usually 1-2 weeks ahead), so future
dates and submittal deadlines still come from each city's yearly schedule.
"""
import html
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import date

UA = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
# Some municipal sites serve incomplete certificate chains.
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# Board name -> meetings.body. Order matters: "Board of Zoning Adjustment" must not count as P&Z.
SKIP = re.compile(r"adjustment|appeal|BZA|architectur|historic|landmark|park|library|police|fire|pension|retire|"
                  r"tif|tax increment|incentive|equalization|merit|ethics|youth|senior|arts|tree|beautif|cemetery|"
                  r"traffic|personnel|audit|finance|budget|work ?session|special|port authority|road board|"
                  r"committee|advisory|task force|group|steering|notices|emergency", re.I)
PZ = re.compile(r"planning|zoning|P\s*&\s*Z|plan commission", re.I)
# Sessions that aren't the regular meeting where rezonings are heard.
NOT_HEARING = re.compile(r"work ?session|study session|retreat|orientation|training|closed session|executive session", re.I)
# ...unless it's combined with the regular meeting ("Work Session and Council Meeting").
REGULAR = re.compile(r"regular|(council|board|commission|aldermen) meeting", re.I)


# Postings that aren't a meeting at all ("No regular meeting to be held", "Notice of Public Hearing - Proposed Budget").
NOT_MEETING = re.compile(r"no (regular )?meeting|^notice of", re.I)
CANCELLED = re.compile(r"cancell?ed", re.I)


def not_hearing(title):
    return bool(NOT_MEETING.search(title)) or (bool(NOT_HEARING.search(title)) and not REGULAR.search(title))

GOV = re.compile(r"aldermen|alderm|city council|county council|board of trustees|village board|^council$|"
                 r"\bcouncil\b(?!.*(advisory|youth|arts))", re.I)


class Blocked(Exception):
    """The site answered with a bot-protection page (e.g. Cloudflare) instead of AgendaCenter."""


def fetch(url, data=None, final=False):
    """GET (or POST form data). With final=True also returns the URL after redirects."""
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=UA)
    with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
        text = r.read().decode("utf-8", "ignore")
        landed = r.geturl()
    if "Attention Required! | Cloudflare" in text or "cf-error-details" in text or "Just a moment..." in text:
        raise Blocked(url)
    return (landed, text) if final else text


def body_for(name):
    if SKIP.search(name):
        return None
    if PZ.search(name):
        return "planning_zoning"
    if GOV.search(name):
        return "governing_body"
    return None


def site(base):
    """The site's current address (many cities have moved domains) and its boards, each with the
    latest year it has agendas for. A board whose latest year is old has moved to another system."""
    landed, page = fetch(base.rstrip("/") + "/AgendaCenter", final=True)
    u = urllib.parse.urlparse(landed)
    resolved = f"{u.scheme}://{u.netloc}"
    cats = []
    # Boards are <h2> headings, or <h3> on sites that group boards under section headings (Des Peres).
    for cid, n in re.findall(r'id="cat(\d+)">\s*<h[23][^>]*>([^<]+)</h[23]>', page):
        name = html.unescape(n).strip()
        years = [int(y) for y in re.findall(rf"changeYear\((\d{{4}}), {cid}\b", page)]
        cats.append({"cat_id": int(cid), "name": name, "body": body_for(name), "latest_year": max(years, default=None)})
    return {"base": resolved, "categories": cats}


def categories(base):
    return site(base)["categories"]


ROW = re.compile(r'<tr id="row\w+" class="catAgendaRow">(.*?)</tr>', re.S)


def agendas(base, cat_id, year):
    """Posted agendas for one board and year."""
    base = base.rstrip("/")
    part = fetch(base + "/AgendaCenter/UpdateCategoryList", {"year": year, "catID": cat_id})
    out = []
    for row in ROW.findall(part):
        # The anchor name carries the meeting date and agenda id: _MMDDYYYY-<id>
        m = re.search(r'name="_(\d{2})(\d{2})(\d{4})-(\d+)"', row)
        if not m:
            continue
        mm, dd, yyyy, agenda_id = m.groups()
        title = re.search(r'aria-describedby="h4[^"]*">\s*(.*?)\s*</a>', row, re.S)
        minutes = re.search(r'href="(/AgendaCenter/ViewFile/Minutes/[^"]+)"', row)
        packet = re.search(r'href="(/AgendaCenter/ViewFile/Agenda/[^"?]+\?packet=true)"', row)
        out.append({
            "event_date": f"{yyyy}-{mm}-{dd}",
            "title": html.unescape(re.sub(r"\s+", " ", title.group(1))).strip() if title else "",
            "agenda_url": f"{base}/AgendaCenter/ViewFile/Agenda/_{mm}{dd}{yyyy}-{agenda_id}",
            "minutes_url": base + minutes.group(1) if minutes else None,
            "packet_url": base + packet.group(1) if packet else None,
        })
        out[-1]["cancelled"] = bool(CANCELLED.search(out[-1]["title"]))
    return out


def meetings(jurisdiction_id, base, year):
    """P&Z and governing-body meetings with posted agendas, one row per meeting date and board."""
    rows = {}
    s = site(base)
    base = s["base"]
    for c in s["categories"]:
        if not c["body"] or (c["latest_year"] or 0) < year:
            continue
        for a in agendas(base, c["cat_id"], year):
            if not_hearing(a["title"]):
                continue
            # Some sites post an agenda, a packet and an amended agenda as separate rows: keep the first per date.
            key = (c["body"], a["event_date"])
            # A cancelled posting gives way to a live one on the same date.
            if key not in rows or (rows[key]["cancelled"] and not a["cancelled"]):
                rows[key] = {"jurisdiction_id": jurisdiction_id, "body": c["body"], "event_type": "meeting",
                             "board": c["name"], **a}
            elif not rows[key]["minutes_url"] and a["minutes_url"]:
                rows[key]["minutes_url"] = a["minutes_url"]
    return sorted(rows.values(), key=lambda r: (r["event_date"], r["body"]))


def check(jurisdiction_id, base, known_file, year):
    """Compare collected meetings with hand-researched ones; prints matches and differences."""
    known = [m for m in json.load(open(known_file))
             if m["jurisdiction_id"] == jurisdiction_id and m["event_type"] == "meeting"
             and m["event_date"].startswith(str(year))]
    got = meetings(jurisdiction_id, base, year)
    today = date.today().isoformat()
    kset = {(m["body"], m["event_date"]) for m in known}
    gset = {(m["body"], m["event_date"]) for m in got}
    # Known meetings that have happened (or are posted) should all show up in AgendaCenter.
    due = {k for k in kset if k[1] <= today}
    found = due & gset
    print(f"{jurisdiction_id} {year}: collected {len(gset)}, hand-researched {len(kset)} ({len(due)} on or before today)")
    print(f"  matched {len(found)}/{len(due)} past meetings" + (f" ({100 * len(found) // len(due)}%)" if due else ""))
    for b, d in sorted(due - gset):
        print(f"  missing from AgendaCenter: {d} {b}")
    for b, d in sorted(gset - kset):
        print(f"  not in our data: {d} {b}")
    return got


def main(argv):
    year = date.today().year
    if "--year" in argv:
        year = int(argv[argv.index("--year") + 1])
    out = argv[argv.index("--out") + 1] if "--out" in argv else None
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "categories":
        for c in categories(argv[2]):
            print(f'{c["cat_id"]:>4}  {c["body"] or "-":16} {c["latest_year"] or "":5} {c["name"]}')
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
