import json, csv, sys
from datetime import date, datetime

out = sys.argv[1]
W = "https://www.wentzvillemo.gov/wp-content/uploads/2025/10/PZ-2026-Schedule-Website.pdf"
C = "https://www.cityofcottleville.com/wp-content/uploads/2025/12/PZ-Schedule-2026-1.pdf"

# Wentzville: submittal, P&Z, BOA1, BOA2
went = """12/01/2025 01/12/2026 01/28/2026 02/11/2026
01/01/2026 02/09/2026 02/25/2026 03/11/2026
02/01/2026 03/09/2026 03/25/2026 04/08/2026
03/01/2026 04/13/2026 04/22/2026 05/13/2026
04/01/2026 05/11/2026 05/27/2026 06/10/2026
05/01/2026 06/08/2026 06/24/2026 07/08/2026
06/01/2026 07/06/2026 07/22/2026 08/12/2026
07/01/2026 08/10/2026 08/26/2026 09/09/2026
08/01/2026 09/14/2026 09/23/2026 10/14/2026
09/01/2026 10/05/2026 10/28/2026 11/04/2026
10/01/2026 11/09/2026 11/18/2026 12/09/2026
11/01/2026 12/07/2026 01/13/2027 01/27/2027
12/01/2026 01/11/2027 01/27/2027 02/10/2027"""
# Cottleville: meeting, deadline
cott = """1-5-26 12-8-25
2-2-26 1-5-26
3-2-26 2-2-26
4-6-26 3-9-26
5-4-26 4-6-26
6-1-26 5-4-26
7-13-26 6-15-26
8-3-26 7-6-26
9-14-26 8-17-26
10-5-26 9-7-26
11-2-26 10-5-26
12-7-26 11-9-26"""

d1 = lambda s: datetime.strptime(s, "%m/%d/%Y").date()
d2 = lambda s: datetime.strptime(s, "%m-%d-%y").date()
rows = []
def add(j, body, typ, dt, tm, loc, src, note=""):
    rows.append(dict(jurisdiction_id=j, body=body, event_type=typ, event_date=dt.isoformat(),
                     event_time=tm, location=loc, status="published", source_url=src,
                     verified_on="2026-10-09", note=note))

WLOC = "Wentzville City Hall, 1001 Schroeder Creek Blvd"
seen = set()
for line in went.splitlines():
    s, pz, b1, b2 = [d1(x) for x in line.split()]
    add("wentzville","planning_zoning","submittal_deadline",s,"17:00",WLOC,W,f"Feeds P&Z {pz.isoformat()}. If weekend/holiday, Friday before or Monday after.")
    add("wentzville","planning_zoning","meeting",pz,"18:00",WLOC,W)
    for b in (b1, b2):
        if b not in seen:
            seen.add(b); add("wentzville","governing_body","meeting",b,None,WLOC,W,"Board of Aldermen (rezoning readings)")

CLOC = "Cottleville City Hall Board Room, 5490 Fifth St"
for line in cott.splitlines():
    m, d = [d2(x) for x in line.split()]
    add("cottleville","planning_zoning","submittal_deadline",d,"12:00",CLOC,C,f"Feeds P&Z {m.isoformat()}. Public-notice items may need more lead time.")
    add("cottleville","planning_zoning","meeting",m,"19:00",CLOC,C)

rows.sort(key=lambda r:(r["event_date"], r["jurisdiction_id"]))
json.dump(rows, open(f"{out}/meetings.json","w"), indent=1)
with open(f"{out}/meetings.csv","w",newline="") as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)

# ICS, upcoming only (today forward)
today = date(2026,10,9)
names = {"wentzville":"Wentzville","cottleville":"Cottleville"}
lab = {("planning_zoning","meeting"):"P&Z Meeting",("planning_zoning","submittal_deadline"):"P&Z SUBMITTAL DUE",("governing_body","meeting"):"Board of Aldermen"}
L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Entitlement Tracker//STC//EN","X-WR-CALNAME:St. Charles Co. Entitlement Dates","X-WR-TIMEZONE:America/Chicago"]
n=0
for i,r in enumerate(rows):
    dt = date.fromisoformat(r["event_date"])
    if dt < today: continue
    n+=1
    L += ["BEGIN:VEVENT", f"UID:{r['jurisdiction_id']}-{r['event_type']}-{r['body']}-{r['event_date']}@entitlement-tracker",
          "DTSTAMP:20261009T000000Z", f"DTSTART;VALUE=DATE:{dt:%Y%m%d}",
          f"SUMMARY:{names[r['jurisdiction_id']]} - {lab[(r['body'],r['event_type'])]}" + (f" ({r['event_time']})" if r['event_time'] else ""),
          f"LOCATION:{r['location'].replace(',', chr(92)+',')}",
          f"DESCRIPTION:{(r['note']+' ') if r['note'] else ''}Source: {r['source_url']}".replace(",", "\\,"),
          "END:VEVENT"]
L.append("END:VCALENDAR")
open(f"{out}/upcoming_dates.ics","w").write("\r\n".join(L)+"\r\n")
print(len(rows), "rows;", n, "upcoming ICS events")
for r in rows:
    if r["event_date"] >= "2026-10-09": print(r["event_date"], r["jurisdiction_id"], r["body"], r["event_type"])
