import json, csv, sys
from datetime import date, datetime, timedelta

out = sys.argv[1]
W = "https://www.wentzvillemo.gov/wp-content/uploads/2025/10/PZ-2026-Schedule-Website.pdf"
C = "https://www.cityofcottleville.com/wp-content/uploads/2025/12/PZ-Schedule-2026-1.pdf"
# O'Fallon: no 2026 schedule posted (P&Z page still links the 2024 PDF, now a dead Drive link).
# Held meetings come from the AgendaQuick archive; deadlines follow the 2024 schedule's rule
# (Friday 34 days before the meeting, noon) and are marked projected.
O = "https://public.destinyhosted.com/agenda_publish.cfm?id=63255"
O24 = "https://web.archive.org/web/20240627035239/https://drive.google.com/file/d/1MTJgjQ8XAMqMc-tjYuibT2Mfc0ZGXoWd/view"
O_PREVIEW = "https://drive.google.com/file/d/14OrNswUM9fNnRWphp8tWNO1Hexgn_uP6/view"
# St. Peters: Development Guide (rev. 5-29-26), P&Z submittal schedule p.4, Land Use Review p.5.
# Columns used: initial plan submittal, rezoning/SUP applications due, P&Z meeting (first Wednesday).
S = "https://www.stpetersmo.net/DocumentCenter/View/444/Development-Guide-and-Planning--Zoning-SubmittalMeeting-Schedule-PDF"
S_AG = "https://www.stpetersmo.net/AgendaCenter"
S_CAL = "https://www.stpetersmo.net/627/City-Meetings-Calendar"
stp = """12/05/2025 12/12/2025 01/07/2026
01/02/2026 01/09/2026 02/04/2026
01/30/2026 02/06/2026 03/04/2026
02/27/2026 03/06/2026 04/01/2026
04/03/2026 04/10/2026 05/06/2026
05/01/2026 05/08/2026 06/03/2026
05/29/2026 06/05/2026 07/01/2026
07/03/2026 07/10/2026 08/05/2026
07/31/2026 08/07/2026 09/02/2026
09/04/2026 09/11/2026 10/07/2026
10/02/2026 10/09/2026 11/04/2026
10/30/2026 11/06/2026 12/02/2026
12/04/2026 12/11/2026 01/06/2027"""
# Board of Aldermen regular meetings (2nd & 4th Thursday; one in Jun, Jul, Nov, Dec). Past from Agenda Center, future from city calendar.
stp_boa = ["2026-01-08","2026-01-22","2026-02-12","2026-02-26","2026-03-12","2026-03-26","2026-04-09","2026-04-23",
           "2026-05-14","2026-05-28","2026-06-25","2026-07-23","2026-08-13","2026-08-27","2026-09-10","2026-09-24",
           "2026-10-08","2026-10-22","2026-11-12","2026-12-17"]
# City of St. Charles: P&Z 2026 meeting dates and deadlines (deadline = prior meeting date, 5 PM).
SC = "https://www.stcharlescitymo.gov/DocumentCenter/View/14267"
SC_AG = "https://www.stcharlescitymo.gov/1402/Agendas"
SC_CAL = "https://www.stcharlescitymo.gov/Calendar.aspx"
stc = """01/12/2026 12/08/2025
02/09/2026 01/12/2026
03/09/2026 02/09/2026
04/13/2026 03/09/2026
05/11/2026 04/13/2026
06/08/2026 05/11/2026
07/13/2026 06/08/2026
08/10/2026 07/13/2026
09/21/2026 08/10/2026
10/19/2026 09/21/2026
11/09/2026 10/19/2026
12/14/2026 11/09/2026"""
# City Council regular sessions (1st & 3rd Tuesday 7 PM, some shifted). Past from Agenda Center, future from city calendar.
stc_cc = ["2026-01-06","2026-01-20","2026-02-03","2026-02-24","2026-03-03","2026-03-17","2026-04-07","2026-04-21",
          "2026-05-05","2026-05-19","2026-06-02","2026-06-23","2026-07-07","2026-07-21","2026-08-04","2026-08-18",
          "2026-09-01","2026-09-15","2026-10-06","2026-10-20","2026-11-03","2026-11-17","2026-12-01","2026-12-15"]
# St. Charles County (unincorporated): no 2026 schedule posted (P&Z page links the 2025 one).
# Held/cancelled meetings from the Agenda Center; deadlines projected from the 2025 rule
# (Friday 26 days before the third-Wednesday meeting), except Jan 21, which the 2025 schedule lists.
CO25 = "https://www.sccmo.org/DocumentCenter/View/26026/2025-Planning-and-Zoning-Deadlines-and-Meeting-Dates"
CO_AG = "https://www.sccmo.org/AgendaCenter"
CO_CAL = "https://www.sccmo.org/Calendar.aspx"
co_pz = [("2026-01-21","published"),("2026-02-18","published"),("2026-03-18","published"),("2026-04-15","cancelled"),
         ("2026-05-20","published"),("2026-06-17","published"),("2026-07-15","published"),("2026-08-19","cancelled"),
         ("2026-09-16","cancelled"),("2026-10-21","published"),("2026-11-18","projected"),("2026-12-16","projected")]
# County Council (2nd & last Monday 7 PM; Dec 1st & 3rd). Past from Agenda Center, future from county calendar.
co_cc = ["2026-01-12","2026-01-26","2026-02-09","2026-02-23","2026-03-09","2026-03-30","2026-04-13","2026-04-28",
         "2026-05-11","2026-05-26","2026-06-08","2026-06-29","2026-07-13","2026-07-27","2026-08-10","2026-08-31",
         "2026-09-14","2026-09-28","2026-10-13","2026-10-26","2026-11-09","2026-11-23","2026-12-07","2026-12-21"]
# Lake Saint Louis: P&Z page table (deadline 35 days before, P&Z first Thursday 6 PM, Board of Aldermen hearing).
L = "https://www.lakesaintlouis.com/1291/Planning-Zoning-Commission"
L_AG = "https://www.lakesaintlouis.com/AgendaCenter"
L_CAL = "https://www.lakesaintlouis.com/Calendar.aspx"
lsl = """12/04/2025 01/08/2026
01/02/2026 02/05/2026
01/29/2026 03/05/2026
02/26/2026 04/02/2026
04/02/2026 05/07/2026
04/30/2026 06/04/2026
06/04/2026 07/09/2026
07/02/2026 08/06/2026
07/30/2026 09/03/2026
08/27/2026 10/08/2026
10/01/2026 11/05/2026
10/29/2026 12/03/2026
12/03/2026 01/07/2027"""
lsl_cancelled = {"2026-01-08","2026-02-05","2026-03-05","2026-06-04","2026-09-03"}  # Agenda Center cancellation notices
# Board of Aldermen regular (1st & 3rd Monday 6 PM, Tuesday after a Monday holiday). 3rd-Monday ones hear P&Z items.
lsl_boa = ["2026-01-05","2026-01-20","2026-02-02","2026-02-17","2026-03-02","2026-03-16","2026-04-06","2026-04-20",
           "2026-05-04","2026-05-18","2026-06-01","2026-06-15","2026-07-06","2026-07-20","2026-08-03","2026-08-17",
           "2026-09-08","2026-09-21","2026-10-05","2026-10-19","2026-11-02","2026-11-16","2026-12-07","2026-12-21","2027-01-19"]
# Dardenne Prairie: no deadline schedule published. Meetings from the agenda pages; Nov/Dec projected.
DP_PZ = "https://www.dardenneprairie.gov/government/boards_commissions/planning_zoning_commission.php"
DP_BOA = "https://www.dardenneprairie.gov/government/mayor_board_of_aldermen/agendas_minutes.php"
dp_pz = [("2026-01-14","published",""),("2026-02-11","published","Only a work session agenda was posted."),
         ("2026-03-11","published",""),("2026-04-08","published",""),("2026-05-13","published",""),
         ("2026-06-17","cancelled","Cancelled."),("2026-07-08","cancelled","Cancelled."),("2026-08-12","cancelled","Cancelled."),
         ("2026-09-09","published",""),("2026-10-14","published",""),
         ("2026-11-11","projected","Projected (second Wednesday)."),("2026-12-09","projected","Projected (second Wednesday).")]
dp_boa = [("2026-01-07","published"),("2026-01-21","published"),("2026-02-04","published"),("2026-02-18","published"),
          ("2026-03-04","published"),("2026-03-18","published"),("2026-04-22","published"),("2026-05-06","published"),
          ("2026-05-20","published"),("2026-06-03","published"),("2026-06-17","published"),("2026-07-01","published"),
          ("2026-07-15","published"),("2026-08-05","published"),("2026-08-19","cancelled"),("2026-09-02","published"),
          ("2026-09-16","published"),("2026-10-07","published"),("2026-10-21","projected"),("2026-11-04","projected"),
          ("2026-11-18","projected"),("2026-12-02","projected"),("2026-12-16","projected")]
# Weldon Spring: city calendar only (agenda archive keeps just the current agenda; no deadlines published).
# Loaded from Oct 2026 forward. Nov 26 and Dec 24 fall on holidays, so they are marked projected.
WS_CAL = "https://www.weldonspring.gov/calendar"
ws_pz = ["2026-10-05","2026-11-02","2026-12-07"]
ws_boa = [("2026-10-08","published"),("2026-10-22","published"),("2026-11-12","published"),("2026-11-26","projected"),
          ("2026-12-10","published"),("2026-12-24","projected")]
# P&Z (first Thursday): date, status, source
ofal_pz = [("2026-01-08","published",O),("2026-02-05","published",O),("2026-03-05","published",O),
           ("2026-04-02","published",O),("2026-05-07","published",O),("2026-06-04","published",O),
           ("2026-07-02","published",O),("2026-08-06","published",O),("2026-09-03","published",O),
           ("2026-10-01","published",O),("2026-11-05","published",O_PREVIEW),("2026-12-03","projected",O),
           ("2027-01-07","projected",O)]
# City Council regular (2nd & 4th Thursday; Nov/Dec only the 3rd Thursday, per 2024-2025)
ofal_cc = [("2026-01-15","published"),("2026-01-22","published"),("2026-02-12","published"),("2026-02-26","published"),
           ("2026-03-12","published"),("2026-03-26","published"),("2026-04-09","published"),("2026-04-23","published"),
           ("2026-05-14","published"),("2026-05-28","published"),("2026-06-11","published"),("2026-06-25","published"),
           ("2026-07-09","published"),("2026-07-23","published"),("2026-08-13","published"),("2026-08-27","published"),
           ("2026-09-10","published"),("2026-09-24","published"),("2026-10-08","published"),("2026-10-22","projected"),
           ("2026-11-19","projected"),("2026-12-17","projected")]

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
def add(j, body, typ, dt, tm, loc, src, note="", status="published", verified="2026-10-09"):
    rows.append(dict(jurisdiction_id=j, body=body, event_type=typ, event_date=dt.isoformat(),
                     event_time=tm, location=loc, status=status, source_url=src,
                     verified_on=verified, note=note))

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

OLOC = "O'Fallon Municipal Centre, Council Chambers, 100 N Main St"
for d, st, src in ofal_pz:
    m = date.fromisoformat(d)
    add("ofallon","planning_zoning","submittal_deadline",m - timedelta(days=34),"12:00",OLOC,O24,
        f"Feeds P&Z {d}. Projected from the 2024 schedule rule (Friday 34 days before); 2026 schedule not posted. Confirm with recording secretary Tracy Coffman, tcoffman@ofallonmo.gov, 636-379-5544.",
        "projected","2026-10-10")
    add("ofallon","planning_zoning","meeting",m,"19:00",OLOC,src,"Pre-meeting 6:30 PM." + ("" if st=="published" else " Projected (first Thursday)."),st,"2026-10-10")
for d, st in ofal_cc:
    add("ofallon","governing_body","meeting",date.fromisoformat(d),"19:30",OLOC,O,
        "City Council regular meeting" + ("" if st=="published" else " (projected: 2nd & 4th Thursday, Nov/Dec 3rd Thursday only, per 2024-2025)"),st,"2026-10-10")

SLOC = "St. Peters Justice Center, 1020 Grand Teton Dr"
for line in stp.splitlines():
    init, rez, pz = [d1(x) for x in line.split()]
    add("stpeters","planning_zoning","submittal_deadline",init,None,SLOC,S,
        f"Initial plan submittal for P&Z {pz.isoformat()} (Citizenserve portal). Land Use Review Committee applications are due about the same day; rezoning, PUD and SUP need that pre-submittal review.",verified="2026-10-12")
    add("stpeters","planning_zoning","submittal_deadline",rez,None,SLOC,S,
        f"Rezoning and Special Use applications due. Feeds P&Z {pz.isoformat()}.",verified="2026-10-12")
    add("stpeters","planning_zoning","meeting",pz,"18:30",SLOC,S,"Applicant or representative must attend.",verified="2026-10-12")
for d in stp_boa:
    add("stpeters","governing_body","meeting",date.fromisoformat(d),"18:30",SLOC,S_AG if d <= "2026-10-08" else S_CAL,
        "Board of Aldermen regular meeting (work session 5:00 PM)",verified="2026-10-12")

SCLOC = "St. Charles City Hall, Council Chambers (4th floor), 200 N Second St"
for line in stc.splitlines():
    m, d = [d1(x) for x in line.split()]
    add("stcharles_city","planning_zoning","submittal_deadline",d,"17:00",SCLOC,SC,
        f"Feeds P&Z {m.isoformat()}. Minimum deadline; email PZ@stcharlescitymo.gov. Staff confirms the actual meeting date after review.",verified="2026-10-12")
    add("stcharles_city","planning_zoning","meeting",m,"18:00",SCLOC,SC,"Applicants must attend public hearings.",verified="2026-10-12")
for d in stc_cc:
    add("stcharles_city","governing_body","meeting",date.fromisoformat(d),"19:00",SCLOC,SC_AG if d <= "2026-10-06" else SC_CAL,
        "City Council regular session",verified="2026-10-12")

COLOC = "County Executive Building, 3rd Floor Council Chambers, 100 N Third St, St. Charles"
for d, st in co_pz:
    m = date.fromisoformat(d)
    if d == "2026-01-21":
        add("stcharles_county","planning_zoning","submittal_deadline",date(2025,12,19),None,COLOC,CO25,
            f"Rezoning, conditional use and preliminary plat applications. Feeds P&Z {d} (holiday schedule).",verified="2026-10-12")
    else:
        add("stcharles_county","planning_zoning","submittal_deadline",m - timedelta(days=26),None,COLOC,CO25,
            f"Rezoning, conditional use and preliminary plat applications. Feeds P&Z {d}. Projected from the 2025 schedule rule (Friday 26 days before); 2026 schedule not posted.",
            "projected","2026-10-12")
    add("stcharles_county","planning_zoning","meeting",m,"19:00",COLOC,CO_AG if st != "projected" else CO25,
        {"published":"","cancelled":"Cancelled.","projected":"Projected (third Wednesday)."}[st],st,"2026-10-12")
for d in co_cc:
    add("stcharles_county","governing_body","meeting",date.fromisoformat(d),"19:00",COLOC,CO_AG if d <= "2026-10-13" else CO_CAL,
        "County Council regular meeting" + (" (postponed from Apr 27, weather)" if d == "2026-04-28" else ""),verified="2026-10-12")

LLOC = "Lake Saint Louis City Hall, 200 Civic Center Dr"
for line in lsl.splitlines():
    d, m = [d1(x) for x in line.split()]
    add("lake_st_louis","planning_zoning","submittal_deadline",d,None,LLOC,L,f"Feeds P&Z {m.isoformat()}. Deadline is 35 days before the meeting.",verified="2026-10-12")
    st = "cancelled" if m.isoformat() in lsl_cancelled else "published"
    add("lake_st_louis","planning_zoning","meeting",m,"18:00",LLOC,L_AG if st == "cancelled" else L,
        "Cancelled." if st == "cancelled" else "Items go to the Board of Aldermen on the third Monday of the same month.",st,"2026-10-12")
for d in lsl_boa:
    add("lake_st_louis","governing_body","meeting",date.fromisoformat(d),"18:00",LLOC,L_AG if d <= "2026-10-05" else (L if d == "2027-01-19" else L_CAL),
        "Board of Aldermen regular meeting (work session 5:30 PM)",verified="2026-10-12")

DLOC = "Dardenne Prairie City Hall Board Room, 2032 Hanley Rd"
for d, st, note in dp_pz:
    add("dardenne_prairie","planning_zoning","meeting",date.fromisoformat(d),"19:00",DLOC,DP_PZ,
        ("Work session 6 PM. " + note).strip(),st,"2026-10-12")
for d, st in dp_boa:
    add("dardenne_prairie","governing_body","meeting",date.fromisoformat(d),"19:00",DLOC,DP_BOA,
        {"published":"Board of Aldermen regular meeting","cancelled":"Cancelled.","projected":"Projected (1st & 3rd Wednesday)."}[st],st,"2026-10-12")

WLOC2 = "Weldon Spring City Hall, 5401 Independence Rd"
for d in ws_pz:
    add("weldon_spring","planning_zoning","meeting",date.fromisoformat(d),"19:30",WLOC2,WS_CAL,"",verified="2026-10-12")
for d, st in ws_boa:
    add("weldon_spring","governing_body","meeting",date.fromisoformat(d),"19:30",WLOC2,WS_CAL,
        "Board of Aldermen meeting" + ("" if st == "published" else ". On the city calendar but falls on a holiday; confirm."),st,"2026-10-12")

rows.sort(key=lambda r:(r["event_date"], r["jurisdiction_id"]))
json.dump(rows, open(f"{out}/meetings.json","w"), indent=1)
with open(f"{out}/meetings.csv","w",newline="") as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)

# ICS, upcoming only (today forward)
today = date.today()
names = {"wentzville":"Wentzville","cottleville":"Cottleville","ofallon":"O'Fallon","stpeters":"St. Peters","stcharles_city":"St. Charles","stcharles_county":"St. Charles County","lake_st_louis":"Lake Saint Louis","dardenne_prairie":"Dardenne Prairie","weldon_spring":"Weldon Spring"}
lab = {("planning_zoning","meeting"):"P&Z Meeting",("planning_zoning","submittal_deadline"):"P&Z SUBMITTAL DUE",("governing_body","meeting"):"Board of Aldermen"}
L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Entitlement Tracker//STC//EN","X-WR-CALNAME:St. Charles Co. Entitlement Dates","X-WR-TIMEZONE:America/Chicago"]
n=0
for i,r in enumerate(rows):
    dt = date.fromisoformat(r["event_date"])
    if dt < today: continue
    n+=1
    L += ["BEGIN:VEVENT", f"UID:{r['jurisdiction_id']}-{r['event_type']}-{r['body']}-{r['event_date']}@entitlement-tracker",
          f"DTSTAMP:{today:%Y%m%d}T000000Z", f"DTSTART;VALUE=DATE:{dt:%Y%m%d}",
          f"SUMMARY:{names[r['jurisdiction_id']]} - {'City Council' if r['jurisdiction_id'] in ('ofallon','stcharles_city') and r['body']=='governing_body' else 'County Council' if r['jurisdiction_id']=='stcharles_county' and r['body']=='governing_body' else lab[(r['body'],r['event_type'])]}" + (" [projected]" if r['status']=='projected' else " [CANCELLED]" if r['status']=='cancelled' else "") + (f" ({r['event_time']})" if r['event_time'] else ""),
          f"LOCATION:{r['location'].replace(',', chr(92)+',')}",
          f"DESCRIPTION:{(r['note']+' ') if r['note'] else ''}Source: {r['source_url']}".replace(",", "\\,"),
          "END:VEVENT"]
L.append("END:VCALENDAR")
open(f"{out}/upcoming_dates.ics","w").write("\r\n".join(L)+"\r\n")
print(len(rows), "rows;", n, "upcoming ICS events")
for r in rows:
    if r["event_date"] >= today.isoformat(): print(r["event_date"], r["jurisdiction_id"], r["body"], r["event_type"])
