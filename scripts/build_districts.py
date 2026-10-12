import json, sys

# Zoning district dimensional standards, one list per jurisdiction. Usage: python3 scripts/build_districts.py data
# Conditional yards (e.g. 0 ft next to like zoning) store the larger value; the rule goes in note.
E = "https://ecode360.com/"

def d(J, code, name, cat, sec, lot=None, width=None, dens=None, front=None, side=None, rear=None, height=None, **other):
    return {"jurisdiction_id": J, "code": code, "name": name, "category": cat,
            "min_lot_sf": lot, "min_lot_width_ft": width, "max_density_du_ac": dens,
            "front_setback_ft": front, "side_setback_ft": side, "rear_setback_ft": rear,
            "max_height_ft": height, "other_requirements": {"code_section": sec[0], **other},
            "source_url": E + str(sec[1])}
R1 = ("§405.090", 27756377)
CL = "Cluster development (5+ acres, 5+ lots) allows smaller lots at the same density, §405.090(I)"
# St. Charles County UDO Ch. 405, Part 2 (ecode360).
J = "stcharles_county"
rows = [
 d(J, "A","Agricultural","agricultural",("§405.080",27756247),lot=217800,width=150,front=50,side=40,rear=50,height=40,
   min_dwelling_sf=800, note="Pre-existing lots of record under 1 acre: 25 ft front, 7 ft side, 25 ft rear. A home existing before Feb 13, 2006 may be split onto a 3-acre tract."),
 d(J, "AT","Agricultural Tourism","agricultural",("§405.085",27756336),lot=1742400,width=150,front=50,side=40,rear=50,height=40),
 d(J, "RR","Single-Family Residential (3 ac)","residential",R1,lot=130680,width=150,dens=0.33,front=50,side=40,rear=50,height=40,min_dwelling_sf=1000,cluster_max_lot_sf=43560,note=CL),
 d(J, "R1A","Single-Family Residential (1 ac)","residential",R1,lot=43560,width=125,dens=1,front=35,side=20,rear=35,height=40,min_dwelling_sf=1000,cluster_max_lot_sf=14500,note=CL),
 d(J, "R1B","Single-Family Residential (20,000 sf)","residential",R1,lot=20000,width=100,dens=2.1,front=25,side=10,rear=25,height=40,min_dwelling_sf=1000,cluster_max_lot_sf=9000,note=CL),
 d(J, "R1C","Single-Family Residential (15,000 sf)","residential",R1,lot=15000,width=80,dens=2.9,front=25,side=10,rear=25,height=40,min_dwelling_sf=1000,cluster_max_lot_sf=6700,note=CL+"; up to 10% of platted lots may be two-family."),
 d(J, "R1D","Single-Family Residential (10,000 sf)","residential",R1,lot=10000,width=80,dens=4.3,front=20,side=7,rear=25,height=40,min_dwelling_sf=1000,cluster_max_lot_sf=5500,note=CL+"; up to 10% of platted lots may be two-family."),
 d(J, "R1E","Single-Family Residential (7,000 sf)","residential",R1,lot=7000,width=70,dens=6.2,front=20,side=7,rear=25,height=40,min_dwelling_sf=1000,cluster_max_lot_sf=4200,note=CL+"; up to 10% of platted lots may be two-family. Conditional use: 6,000 sf lots, 60 ft wide, 6 ft sides, 800 sf homes."),
 d(J, "R2","Two-Family Residential","residential",("§405.095",27756533),lot=7000,width=70,front=25,side=7,rear=25,height=40,
   min_lot_sf_per_unit=3500, min_lot_width_per_unit_ft=35, min_dwelling_sf=1000, min_dwelling_sf_two_family=700, note="Zero side yard allowed at a common party wall."),
 d(J, "R3A","Medium Density Residential","residential",("§405.100",27756579),lot=4000,dens=10,front=20,side=10,rear=25,height=45,
   note="Setbacks apply to the outer limits of the development site; internal yards per the preliminary plat or site plan. 4,000 sf minimum is for detached single-family.", min_dwelling_sf_multifamily={"2br":500,"1br":400,"efficiency":300}),
 d(J, "R3B","Multi-Family Residential","residential",("§405.105",27756625),lot=4000,dens=20,front=20,side=10,rear=25,height=45,
   note="Setbacks apply to the outer limits of the development site; internal yards per the preliminary plat or site plan. 4,000 sf minimum is for detached single-family.", min_dwelling_sf_multifamily={"2br":500,"1br":400,"efficiency":300}),
 d(J, "RM","Manufactured/Mobile Home Residential","residential",("§405.110",27756675),lot=6000,width=60,front=20,side=10,rear=10,height=35,
   note="One home per lot. 20 ft from street right-of-way (25 ft for additions and carports). Park needs a 25-50 ft landscaped perimeter buffer and 500 sf of recreation area per lot."),
 d(J, "PR","Park Recreational","recreational",("§405.115",27756716),lot=43560,front=25,side=10,rear=25,height=45),
 d(J, "RF","Riverfront","special",("§405.120",27756752),width=200,front=30,side=30,rear=30,height=50,
   min_river_frontage_ft=300, max_height_conditional_ft=75, note="30 ft setbacks from all lines except river frontage. No minimum site area (riverboat gaming vessels need 25 acres). Conditional uses need an approved riverfront development plan."),
 d(J, "CO","Office","office",("§405.125",27756814),front=25,side=10,rear=15,height=35,
   note="Side yard 0 ft unless it adjoins A or R zoning (then 10 ft). Rear yard 0 ft next to C zoning, else 15 ft. No minimum lot area except 7,000 sf for a dwelling."),
 d(J, "C1","Neighborhood Commercial","commercial",("§405.130",27756867),front=25,side=10,rear=15,height=45,
   note="Side and rear yards are 0 ft next to C zoning; otherwise 10 ft side, 15 ft rear. No minimum lot area except 7,000 sf for residential."),
 d(J, "C2","General Commercial","commercial",("§405.135",27756929),front=25,side=10,rear=15,height=60,
   note="Side yard 10 ft next to A or R zoning, else 0 ft. Rear yard 0 ft next to C zoning, else 15 ft. No minimum lot area except 7,000 sf for residential."),
 d(J, "HTCD","High Technology Corridor","industrial",("§405.165",27757040),width=100,front=30,side=20,rear=30,height=60,
   max_lot_coverage_pct=70, note="Lot width 200 ft for lots of 5+ acres; corner side yard 30 ft. No minimum lot area. 15 ft landscape strip on side and rear lines. Site development plan, elevations and preliminary plat required."),
 d(J, "I1","Light Industrial","industrial",("§405.170",27757102),front=35,side=10,rear=15,height=60,
   note="Side and rear yards are 0 ft next to I zoning; otherwise 10 ft side, 15 ft rear. No minimum lot area except 7,000 sf for residential."),
 d(J, "I2","Heavy Industrial","industrial",("§405.175",27757157),front=35,side=10,rear=15,height=60,
   note="Side and rear yards are 0 ft next to I zoning; otherwise 10 ft side, 15 ft rear. No minimum lot area."),
 d(J, "SWD","Solid Waste Disposal","special",("§405.180",27757227),
   note="No standard lot or setback table. Standards come from the site development plan and solid-waste facility conditions."),
 d(J, "PUD","Planned Unit Development (overlay)","overlay",("§405.185-405.240",27757266),
   note="Overlay on a base district. Density per §405.205; standards set by the approved development plan."),
 d(J, "FW","Floodway (overlay)","overlay",("Part 2, Art. XI",27756190), note="Flood overlay; see Article XI."),
 d(J, "FF","Floodway Fringe (overlay)","overlay",("Part 2, Art. XI",27756190), note="Flood overlay; see Article XI."),
 d(J, "DF","Density Floodway (overlay)","overlay",("Part 2, Art. XI",27756190), note="Flood overlay; see Article XI."),
 d(J, "WH","Wellhead Protection (overlay)","overlay",("Part 2, Art. XII",27757569), note="Overlay; see Article XII."),
]
# City of St. Charles Ch. 400, Art. II "Design Standards" subsections (ecode360). Heights are "X stories or Y ft".
# Many commercial/industrial districts have Green Point Rating System (GPRS) bonuses for height and setbacks.
J = "stcharles_city"
GP = "GPRS (Green Point Rating System) bonuses allow more height and smaller setbacks, §400.920-950."
R1C = ("§400.150", 27713583)
rows += [
 d(J,"A","Agricultural","agricultural",("§400.140",27713509),lot=130680,width=150,front=50,side=20,rear=50,height=35,
   min_lot_depth_ft=200, note="Code text reads 'five (50) feet' for the rear yard. Floors 1 ft above the 100-year flood elevation."),
 d(J,"R-1C","Single-Family Residential","residential",R1C,lot=12500,width=100,front=30,side=10,rear=25,height=35,
   min_lot_depth_ft=125, max_lot_coverage_pct=40, min_dwelling_sf=1000),
 d(J,"R-1D","Single-Family Residential","residential",R1C,lot=9000,width=75,front=25,side=7,rear=25,height=35,
   min_lot_depth_ft=100, max_lot_coverage_pct=40, min_dwelling_sf=1000),
 d(J,"R-1E","Single-Family Residential","residential",R1C,lot=7000,width=60,front=25,side=7,rear=25,height=35,
   min_lot_depth_ft=100, max_lot_coverage_pct=40, min_dwelling_sf=1000),
 d(J,"R-2","Two-Family Residential","residential",("§400.160",27713654),lot=9000,width=75,front=25,side=7,rear=25,height=35,
   min_lot_depth_ft=120, max_lot_coverage_pct=40, min_dwelling_sf=700),
 d(J,"R-3A","Multiple-Family Residential","residential",("§400.170",27713681),lot=10000,width=75,dens=18,front=25,side=7,rear=25,height=45,
   min_lot_depth_ft=125, max_lot_coverage_pct=40, note="30 ft between buildings on the same lot."),
 d(J,"R-M","Manufactured/Modular Residential","residential",("§400.180",27713717),lot=5000,width=45,front=30,side=6,rear=25,
   min_lot_depth_ft=110, max_lot_coverage_pct=50, note="Park: 8 acres, 200 ft wide and deep. Front yard 10 ft on an interior drive. 10 ft between homes."),
 d(J,"O-I","Office Institution","office",("§400.190",27713776),lot=7500,front=25,side=15,rear=25,height=35,
   max_lot_coverage_pct=40, note="Side yard 0 ft unless next to residential (15 ft). College campuses may go to 10 stories / 140 ft with added setbacks. "+GP),
 d(J,"HCD","Historic Commercial","commercial",("§400.200",27713846),lot=7500,front=10,side=10,rear=30,height=35,
   max_floor_area_sf=5000, note="Side yard only when next to residential. 5,000 sf max per establishment."),
 d(J,"C-1","Neighborhood Business","commercial",("§400.210",27713921),lot=7500,front=25,side=15,rear=25,height=35,
   max_floor_area_sf=3000, note="Side yard 0 ft unless next to residential (15 ft). 3,000 sf max per establishment. "+GP),
 d(J,"C-2","General Business","commercial",("§400.220",27714013),lot=10000,front=25,side=20,rear=20,height=45,
   note="Side and rear yards 0 ft unless next to residential (20 ft). "+GP),
 d(J,"C-3","Highway Business","commercial",("§400.230",27714096),lot=10000,front=25,side=25,rear=25,height=45,
   note="Side and rear yards 0 ft unless next to residential (25 ft). "+GP),
 d(J,"I-1","Light Industrial","industrial",("§400.240",27714144),lot=43560,width=150,front=35,side=50,rear=50,height=45,
   min_lot_depth_ft=200, note="Side and rear 0 ft unless next to residential (50 ft). Buildings 100 ft from any residential district boundary; front 50 ft across from residential. "+GP),
 d(J,"I-2","Heavy Industrial","industrial",("§400.250",27714216),lot=43560,width=150,front=35,side=50,rear=50,height=45,
   min_lot_depth_ft=200, note="Side 0 ft (10 ft next to commercial, 50 ft next to residential); rear 0 ft (30 ft next to commercial, 50 ft next to residential). Buildings 100 ft from any residential district boundary. "+GP),
 d(J,"CBD","Central Business","commercial",("§400.270",27714315),front=15,side=15,rear=15,height=45,
   max_lot_coverage_pct=80, note="No yards unless across from or next to residential (15 ft), plus a 15 ft landscaped greenbelt there. Height may be varied by P&Z and Council. No minimum lot."),
 d(J,"CRD","Central Residential (CRD-I, CRD-II)","residential",("§400.280",27714349),lot=5000,front=20,side=5,rear=10,height=45,
   max_lot_coverage_pct=70, note="Height 45 ft / 3 stories in CRD-I, 35 ft / 2.5 stories in CRD-II. CRD-II: one principal building per lot, 700 sf per unit."),
 d(J,"FD","Frenchtown","mixed_use",("§400.290",27714371),front=0,side=10,rear=20,height=60,
   max_front_setback_ft=10, note="Build-to: front 0-10 ft. Side and rear only when abutting residential (10 / 20 ft). No minimum lot."),
 d(J,"WHP","Wellhead Protection (overlay)","overlay",("§400.320",27714510), note="Underlying district standards apply, plus paved storage/parking and stormwater pretreatment."),
 d(J,"SMPD","South Main Preservation (overlay)","overlay",("§400.330",27714556), note="Historic preservation overlay; design review."),
 d(J,"EHP","Extended Historic Preservation (overlay)","overlay",("§400.340",27714574), note="Historic preservation overlay; design review."),
 d(J,"HDD","Historic Downtown (overlay)","overlay",("§400.350",27714579), note="Historic preservation overlay; design review."),
 d(J,"FPD","Frenchtown Preservation (overlay)","overlay",("§400.360",27714586), note="Historic preservation overlay; design review."),
 d(J,"CPD","Commons Preservation (overlay)","overlay",("§400.370",27714631), note="Historic preservation overlay; design review."),
 d(J,"LMPD","Landmark Preservation (overlay)","overlay",("§400.380",27714644), note="Historic preservation overlay; design review."),
 d(J,"FSC/HD","Fifth Street Corridor/Hospital (overlay)","overlay",("§400.390",27714654), note="Superimposed district; see section."),
 d(J,"PD","Planned Development (PD-R, PD-C, PD-I, PD-RF, PD-MU)","planned",("§400.800-910",27717372),
   note="5-acre minimum site. Standards set by the ordinance creating each PD, §400.850."),
]

# O'Fallon Ch. 400 (Ord. 7042, 2023), Art. IV "Regulations And Performance Standards" subsections (ecode360).
J = "ofallon"
H6 = "P&Z may allow up to 6 stories (microwave-path and fire-access findings)."
rows += [
 d(J,"R-1","Single-Family Residential","residential",("§400.080",43318553),lot=10000,width=80,front=25,side=6,rear=25,height=35,
   min_lot_depth_ft=100, max_lot_coverage_pct=35),
 d(J,"R-1A","Single-Family Suburban Residential","residential",("§400.085",43318573),lot=22000,width=110,front=40,side=12,rear=40,height=35,
   min_lot_depth_ft=180, max_lot_coverage_pct=25),
 d(J,"R-2","Two-Family Residential","residential",("§400.095",43318593),lot=10000,width=80,front=25,side=6,rear=25,height=35,
   note="R-1 standards apply. Two-family on one lot: 45% coverage, 15 ft rear. Side-by-side on two lots: 5,000 sf and 40 ft wide per lot, 50% coverage, 15 ft rear, no side yard at the party wall."),
 d(J,"R-3","Medium Density Residential","residential",("§400.100",43318622),lot=7500,width=70,dens=10,front=30,side=20,rear=35,height=45,
   min_site_acres=1, max_lot_coverage_pct=40, note="Yards shown are for multi-family; single-family uses R-1 yards. 1-acre minimum site unless next to multi-family zoning. 2.5 stories."),
 d(J,"R-4","Apartment Building","residential",("§400.105",43318679),lot=7500,width=70,dens=14,front=35,side=15,rear=30,height=50,
   min_site_acres=1, max_lot_coverage_pct=40, note="Yards shown are for multi-family; single-family is 25/6/15 ft. 1-acre minimum site unless next to multi-family zoning. 4 stories."),
 d(J,"R-5","Mobile/Manufactured Home Park","residential",("§400.110",43318732),lot=4200,width=80,side=6,rear=6,
   max_lot_coverage_pct=50, note="Per home space. Homes 30 ft from the park boundary, 50 ft from an outside public street, 15 ft from interior right-of-way. 600 sf minimum home."),
 d(J,"TGD","Transitional Growth (St. Paul)","residential",("§400.112",43318809),lot=10000,width=80,front=25,side=6,rear=25,height=35,
   note="Three tiers. Primary: 1 ac, 150 ft wide, 40/20/40 ft. Secondary: 22,000 sf, 110 ft, 40/12/40 ft. Tertiary (shown): 10,000 sf, 80 ft, 25/6/25 ft."),
 d(J,"C-O","Office","office",("§400.115",43318854),width=75,front=25,side=10,rear=35,height=35,
   min_site_acres=1, max_lot_coverage_pct=25, note="Corner street-side yard 25 ft. 1-acre minimum site unless next to commercial or industrial zoning."),
 d(J,"C-1","Restricted Business","commercial",("§400.120",43318875),width=70,front=25,rear=25,height=35,
   min_site_acres=1, max_lot_coverage_pct=30, note="No side yard unless next to residential or office (then that district's side yard); corner 25 ft. 5,000 sf max per business; no outdoor storage."),
 d(J,"C-2","General Business","commercial",("§400.125",43318899),width=25,front=25,height=50,
   min_site_acres=5, note="No side or rear yard unless next to residential or office (side matches that district; rear 10 ft); corner 25 ft. No coverage limit. 3 stories; "+H6),
 d(J,"C-3","Highway Commercial","commercial",("§400.130",43318918),width=25,front=30,side=20,rear=25,height=50,
   min_site_acres=5, max_lot_coverage_pct=50, note="Corner street-side yard 30 ft. 3 stories; "+H6),
 d(J,"I-1","Light Industrial","industrial",("§400.140",43318939),width=75,front=30,side=20,rear=35,height=50,
   min_site_acres=5, max_lot_coverage_pct=50, note="Corner street-side yard 30 ft. 5-acre minimum site unless next to industrial zoning."),
 d(J,"I-2","Heavy Industrial","industrial",("§400.145",43318960),width=75,front=30,side=25,rear=50,height=50,
   min_site_acres=5, max_lot_coverage_pct=50, note="Corner street-side yard 30 ft."),
 d(J,"HTCD","High Tech Corridor","industrial",("§400.150",43318981),width=100,front=30,side=20,rear=35,height=50,
   min_site_acres=5, max_lot_coverage_pct=50, note="All operations inside enclosed buildings. Corner side yard 30 ft. Preliminary development plan and plat filed with rezoning. 3 stories; "+H6),
 d(J,"AG","Agricultural","agricultural",("§400.155",43319121),lot=87120,width=150,front=50,side=30,rear=50,
   max_lot_coverage_pct=10, note="10 acres to keep livestock; livestock structures 100 ft from lot lines. Dwellings 2.5 stories; farm buildings 50 ft. Corner street side 50 ft."),
 d(J,"P-R","Park-Recreation","recreational",("§400.160",43319139),front=60,side=30,rear=50,height=25,
   max_lot_coverage_pct=10, note="2 stories. Corner street-side yard 60 ft."),
 d(J,"MUTDD","Mixed-Use Traditional Development","mixed_use",("§400.161",43319153),
   min_site_acres=5, note="Area plan and final plan approved by Council. At least 20% residential and 20% non-residential land area."),
 d(J,"SCO","Senior Community (overlay)","overlay",("§400.162",43319270), note="Overlay with its own density and site standards."),
 d(J,"DO","Downtown (overlay)","overlay",("§400.163",43319320),
   note="No minimum lot area; 20% green space. Setbacks follow the underlying district and may be reduced by P&Z."),
 d(J,"STO","Sports Tourism (overlay)","overlay",("§400.164",45964491),height=60,
   min_site_acres=20, note="Yards per C-2. 30 ft bufferyard and 6 ft fence next to residential."),
 d(J,"PD/PUD","Planned Development / Planned Unit Development","planned",("Art. V",43319555),
   note="Standards set by the approved development plan."),
]

# St. Peters Ch. 405, Art. V (ecode360). Side yards in R-1/R-1(A)/R-2 are 10% of lot width, so side is left blank.
J = "stpeters"
PZH = "P&Z may approve more height."
rows += [
 d(J,"A-1","Agricultural","agricultural",("§405.110",28264925), note="Height, lot area, coverage and yards: not applicable."),
 d(J,"P-1","Public Park Ground","recreational",("§405.120",28264945),front=10,side=10,rear=10,height=35, note="Principal building 10 ft from any property line. 2.5 stories; "+PZH),
 d(J,"R-1","Single-Family Residential","residential",("§405.130",28264963),lot=12000,width=65,dens=5.8,front=20,rear=25,height=35,
   max_lot_coverage_pct=50, note="12,000 sf for plats approved after Jan 1, 2001 (7,000 sf before; density cap 1 unit per 7,500 sf net). Side yards 10% of lot width (6 ft max on older plats and cul-de-sacs). Corner rear 15 ft. Coverage includes paving."),
 d(J,"R-1(A)","Single-Family Residential","residential",("§405.140",28265016),lot=10000,width=90,dens=3.6,front=30,rear=30,height=35,
   max_lot_coverage_pct=50, note="Density cap 1 unit per 12,000 sf net; a 10,000 sf lot must abut a 12,000 sf lot. Side yards 10% of lot width. Corner rear 20 ft."),
 d(J,"R-2","Two-Family Residential","residential",("§405.150",28265071),lot=10000,width=80,front=20,side=6,rear=25,height=35,
   max_lot_coverage_pct=50, note="10,000 sf per two-family lot on post-2001 plats (9,000 before). Side yard 10% of width, max 6 ft; 0 ft at the common wall. 1,000 sf units (10% may be 800 sf)."),
 d(J,"R-3(A)","Multiple-Family Residential (14/ac)","residential",("§405.160",28265118),width=100,dens=14,front=20,side=15,rear=20,height=28,
   note="2 stories. Churches 50 ft from residential side and rear lines."),
 d(J,"R-3(B)","Multiple-Family Residential (10/ac)","residential",("§405.160",28265118),width=100,dens=10,front=20,side=15,rear=20,height=28,
   note="2 stories. Churches 50 ft from residential side and rear lines."),
 d(J,"R-M","Mobile/Modular Home Residential","residential",("§405.170",28265170),lot=3750,width=40,front=20,side=13,rear=20,height=35,
   note="Lot area rises with home size (3,750 sf for 560 sf up to 5,900 sf for 1,960 sf); 60 ft wide for homes over 980 sf. 26 ft between homes; 30 ft from park boundary."),
 d(J,"S-D","Special Old Town (overlay)","overlay",("§405.180",28265201),height=35, note="No minimum lot. Yards set case by case by P&Z to match existing Old Town layouts."),
 d(J,"C-1","Neighborhood Commercial","commercial",("§405.190",28265219),front=30,side=10,rear=15,height=20,
   note="1 story / 20 ft unless P&Z approves more. Side and rear 20 ft next to residential. No minimum lot."),
 d(J,"C-2","Community Commercial","commercial",("§405.200",28265252),front=30,side=10,rear=15,height=35,
   note="Side 20 ft and rear 25 ft next to residential. No minimum lot. "+PZH),
 d(J,"C-3","General Commercial","commercial",("§405.210",28265305),front=30,side=15,rear=25,
   note="6 stories unless P&Z approves more. Side 20 ft and rear 30 ft next to residential. No minimum lot."),
 d(J,"C-4","Regional Shopping Center","commercial",("§405.220",28265369),lot=2613600,front=45,side=50,rear=50,
   note="60-acre minimum parcel. Side yard 50 ft next to residential. 6 stories unless P&Z approves more."),
 d(J,"CPD","Commercial Planned","planned",("§405.225",28265407), note="Height and setbacks set by each CPD ordinance. 10 ft landscaped green belt next to residential."),
 d(J,"I-1","Light Industrial","industrial",("§405.230",28265430),front=30,side=10,rear=15,height=45,
   note="40 ft side/rear next to residential. Open storage up to 40% of lot. No minimum lot. "+PZH),
 d(J,"I-2","Heavy Industrial","industrial",("§405.240",28265478),front=30,side=10,rear=15,height=45,
   note="70 ft side/rear next to residential. Open storage up to 60% of lot. "+PZH),
 d(J,"PUD","Planned Urban Development","planned",("§405.250",28265530), note="Design standards and project-area densities in §405.250(C) and (E)."),
 d(J,"SPC","St. Peters Centre Special District","special",("§405.260",28265574), note="Subdistricts with their own lot, setback and bulk rules, §405.260(D)-(F)."),
 d(J,"L370","Lakeside 370 Special District","special",("§405.265",28265651), note="Own lot, setback and bulk rules, §405.265(C)-(E)."),
]

# Wentzville Ch. 405, Art. II "(d) Regulations and performance standards" (Municode; sec[1] is the Municode nodeId).
J = "wentzville"
WM = "https://library.municode.com/mo/wentzville/codes/code_of_ordinances?nodeId=TIT4LAUS_CH405ZO_ARTIIDIRE_"
def w(*a, **k):
    r = d(*a, **k); r["source_url"] = WM + r["source_url"].replace(E, ""); return r
WR1 = ("§405.170", "S405.170SIMIREDI")
DW = "Min dwelling 1,200 sf main floor or 1,800 sf total."
rows += [
 w(J,"A","Agricultural","agricultural",("§405.160","S405.160AGDI"),lot=130680,width=150,front=50,side=30,rear=50,height=35,
   max_lot_coverage_pct=35, note="Corner street side 50 ft. Farm buildings to 50 ft. "+DW),
 w(J,"R-1A","Single-Family Residential (1 ac)","residential",WR1,lot=43560,width=100,front=35,side=20,rear=35,height=35,max_lot_coverage_pct=35,note=DW),
 w(J,"R-1B","Single-Family Residential (20,000 sf)","residential",WR1,lot=20000,width=100,front=35,side=10,rear=35,height=35,max_lot_coverage_pct=35,note=DW),
 w(J,"R-1C","Single-Family Residential (12,000 sf)","residential",WR1,lot=12000,width=80,front=25,side=7,rear=25,height=35,max_lot_coverage_pct=35,note=DW),
 w(J,"R-1D","Single-Family Residential (9,000 sf)","residential",WR1,lot=9000,width=75,front=25,side=7,rear=25,height=35,max_lot_coverage_pct=35,note=DW),
 w(J,"R-1E","Single-Family Residential (8,300 sf)","residential",WR1,lot=8300,width=70,front=25,side=7,rear=25,height=35,max_lot_coverage_pct=35,note=DW),
 w(J,"R-2","Two-Family Residential","residential",("§405.180","S405.180TMIREDI"),lot=10000,width=80,front=25,side=7,rear=30,height=35,
   max_lot_coverage_pct=35, note="Zero side yard at a common party wall. "+DW),
 w(J,"R-3B","Multi-Family Residential","residential",("§405.190","S405.190MUMIREDI"),lot=10000,width=80,dens=8,front=25,side=10,rear=30,height=50,
   max_lot_coverage_pct=45, note="4 stories. Spacing between buildings 20-60 ft by orientation. Detached and two-family use R-2 yards."),
 w(J,"MHD","Mobile Home Development","residential",("§405.200","S405.200MHMOHODEDI"),lot=10000,width=100,front=30,side=15,rear=25,height=35,
   note="One home per lot; additions and carports 30 ft from street right-of-way."),
 w(J,"C-O","Office","office",("§405.210","S405.210OFDI"),lot=43560,width=150,front=30,side=10,rear=30,height=45,max_lot_coverage_pct=35,note="4 stories."),
 w(J,"C-1","Neighborhood Commercial","commercial",("§405.220","S405.220NECODI"),lot=8300,width=60,front=30,side=12,rear=30,height=35,max_lot_coverage_pct=35),
 w(J,"C-2","General Commercial","commercial",("§405.230","S405.230GECODI"),lot=8300,width=60,front=30,side=10,rear=25,height=50,
   note="Rear 15 ft unless next to residential (25 ft). 3 stories. Coverage set by yards, landscaping and parking."),
 w(J,"C-3","Highway Commercial","commercial",("§405.240","S405.240HICODI"),lot=10000,width=60,front=30,side=10,rear=30,height=50,
   note="3 stories. Coverage set by yards, landscaping and parking."),
 w(J,"I-1","Light Industrial","industrial",("§405.250","S405.250LIINDI"),lot=87120,width=150,front=30,side=20,rear=30,height=50,max_lot_coverage_pct=50,note="3 stories."),
 w(J,"I-2","Heavy Industrial","industrial",("§405.260","S405.260HEINDI"),lot=130680,width=150,front=50,side=50,rear=50,height=60,max_lot_coverage_pct=50,note="3 stories."),
 w(J,"PD","Planned Development","planned",("§405.270","S405.270PDPLDEDI"), note="Underlying district standards apply unless modified by the PD ordinance."),
 w(J,"HF","Highway Frontages (overlay)","overlay",("§405.290","S405.290HFHIFROVDI"), note="Design overlay along highway frontage."),
 w(J,"WP","Wentzville Parkway (overlay)","overlay",("§405.300","S405.300WPWEPAOVDI"), note="Design overlay along Wentzville Parkway."),
 w(J,"HD-1","Historic Downtown Core","mixed_use",("§405.310","S405.310HIDOCODI"), side=10,rear=10, note="3 stories, built to the street. No minimum lot width, coverage or yards, except 10 ft side/rear next to residential (director may waive with buffering)."),
 w(J,"HD-2","Historic Downtown Corridor","mixed_use",("§405.320","S405.320HIDOCODI"), side=10,rear=10, note="3 stories, built to the street. No minimum lot width, coverage or yards, except 10 ft side/rear next to residential (director may waive with buffering)."),
 w(J,"HD-3","Historic Downtown Light Industrial/Loft","mixed_use",("§405.330","S405.330HIDOLIINLODI"), side=10,rear=10, note="3 stories, built to the street. No minimum lot width, coverage or yards, except 10 ft side/rear next to residential (director may waive with buffering)."),
]

# Lake Saint Louis UDO Ch. 415 (ecode360), Tables 415.030 and 415.080. Districts renamed in 2021 (Ord. 4190); old names in note.
J = "lake_st_louis"
LR = ("§415.030", 37148343)
LN = ("§415.080", 37148369)
R6N = "Front-loaded detached houses use R4 standards; front-loaded duplexes and townhouses use R5 standards."
rows += [
 d(J,"RR","Rural Residential","residential",LR,lot=130680,width=250,front=90,side=35,rear=50,height=35,old_district="NU"),
 d(J,"R1","Residential 1","residential",LR,lot=43560,width=100,front=50,side=20,rear=50,height=35,old_district="SR-3"),
 d(J,"R2","Residential 2","residential",LR,lot=15000,width=70,front=35,side=8,rear=30,height=35,old_district="SR-1"),
 d(J,"R3","Residential 3","residential",LR,lot=9000,width=70,front=25,side=7,rear=25,height=35,old_district="SR-2"),
 d(J,"R4","Residential 4","residential",LR,lot=7000,width=50,dens=6,front=20,side=6,rear=20,height=35),
 d(J,"R5","Residential 5","residential",LR,lot=7000,width=50,dens=10,front=30,side=10,rear=30,height=40,old_district="MF",
   min_lot_sf_per_unit=3500, min_lot_width_per_unit_ft=35, building_separation_ft=15,
   note="Duplex/townhouse: 3,500 sf and 35 ft width per unit (20 ft if rear-loaded). Detached houses use R4 standards."),
 d(J,"R6","Residential 6","residential",LR,lot=3000,width=35,dens=14,front=10,side=5,rear=5,height=40,
   min_lot_sf_per_unit=2000, min_lot_width_per_unit_ft=20, building_separation_ft=10, note=R6N),
 d(J,"MU","Mixed-Use","mixed_use",LN,dens=18,height=40, note="No minimum lot size or setbacks."),
 d(J,"CO","Commercial-Office","office",LN,front=50,side=15,rear=30,height=70,max_lot_coverage_pct=60,old_district="BP",
   note="Height 50 ft where the building is within 300 ft of a platted, improved detached-house lot in a residential district existing Jan 1, 2007."),
 d(J,"C1","Commercial 1","commercial",LN,lot=21780,front=50,side=10,rear=45,height=30,max_far=1.25,old_district="CB"),
 d(J,"C2","Commercial 2","commercial",LN,lot=21780,front=42,side=9,rear=20,height=30,max_far=1.25,old_district="HC",
   note="Front setback 20 ft when all parking is in the side or rear yards."),
 d(J,"LI","Light Industrial","industrial",LN,lot=43560,width=150,front=50,side=25,rear=25,height=50),
 d(J,"PA","Public Activity","special",LN,lot=43560,front=35,side=9,rear=20,height=35),
 d(J,"PUD","Planned Unit Development (overlay)","overlay",("§415.130",37148391),old_district="PD, PR",
   note="Standards set by the approved PUD plan; also the route to modify base-district dimensions."),
 d(J,"UPT","Uptown (overlay)","overlay",("§415.140",37148429), note="Overlay; see §415.140."),
]
for r in rows:
    o = r["other_requirements"]
    if r["jurisdiction_id"] == J and "old_district" in o:
        o["note"] = f"Formerly {o['old_district']}. " + o.get("note", "")
        o["note"] = o["note"].strip()

# Cottleville Ch. 405 (ecode360). Art. II base districts; Art. III Old Town; Art. IV Community College Special District
# subdistricts (setbacks §405.265, heights §405.270, open space §405.260). C districts' street-side setback in note.
J = "cottleville"
CR = ("§405.045", 29399665)
CS = "Commercial greenbelt: 15 ft landscaped buffer with 6 ft screen next to residential zoning."
SC = ("§405.265-405.270", 29400532)
SM = " 40 ft building and parking setback from Mid Rivers Mall Dr and St. Peters-Cottleville Rd. Taller buildings allowed with Board of Aldermen site plan review and 1 ft extra setback per ft over the limit, §405.270."
rows += [
 d(J,"F-P","Floodplain","special",("§405.035",29399620),lot=130680,width=200,front=50,side=50,rear=50,height=35,min_dwelling_sf=1200),
 d(J,"R-1A","Single-Family Residential","residential",("§405.040",29399641),lot=43560,width=200,front=35,side=20,rear=35,height=35,min_dwelling_sf=1200),
 d(J,"R-1B","Single-Family Residential","residential",CR,lot=20000,width=100,front=25,side=10,rear=25,height=35,min_dwelling_sf=1200),
 d(J,"R-1C","Single-Family Residential","residential",CR,lot=15000,width=80,front=25,side=10,rear=25,height=35,min_dwelling_sf=1200),
 d(J,"R-1D","Single-Family Residential","residential",CR,lot=10000,width=80,front=25,side=7,rear=25,height=35,min_dwelling_sf=1200),
 d(J,"R-1E","Single-Family Residential","residential",CR,lot=7000,width=70,front=25,side=7,rear=25,height=35,min_dwelling_sf=1200),
 d(J,"R-2","Multi-Family Residential","residential",("§405.050",29399691),width=200,front=25,side=25,rear=25,height=35,
   min_lot_sf_per_unit=5000, min_dwelling_sf=800, note="Lot area is 5,000 sf per family."),
 d(J,"S-D/OT","Special District/Old Town Cottleville","special",("§405.095",29399946),height=35,
   note="35 ft or 2.5 stories. No minimum lot area. Yards follow the existing layout, approved case by case by P&Z. R-1/R-2 uses permitted; commercial uses conditional."),
 d(J,"C-1","Light Commercial Office","office",("§405.060",29399715),front=25,side=10,rear=15,height=20,
   note="No minimum lot size or width. Street side setback 25 ft. No permanent outdoor storage. "+CS),
 d(J,"C-2","Limited Commercial Services","commercial",("§405.065",29399744),front=30,side=15,rear=20,height=30,
   note="No minimum lot size or width. Street side setback 30 ft. "+CS),
 d(J,"C-3","General Commercial Retail","commercial",("§405.070",29399774),front=35,side=20,rear=25,height=40,
   note="No minimum lot size or width. Street side setback 35 ft. "+CS),
 d(J,"C-4","Regional Commercial Retail","commercial",("§405.075",29399804),lot=1089000,front=40,side=40,rear=40,height=60,
   note="25-acre minimum. Street side setback 20 ft. Shopping-center site plan approval; construction must start within 2 years of rezoning. "+CS),
 d(J,"C-5","Commercial Office (General Public)","office",("§405.080",29399836),front=40,side=40,rear=40,height=60,
   note="Public, institutional, health care, school and church uses. No minimum lot size or width. Street side setback 20 ft. "+CS),
 d(J,"I-1","Light Industrial","industrial",("§405.085",29399867),front=30,side=40,rear=40,height=45,
   note="Side 10 ft and rear 15 ft, or 40 ft next to residential. No minimum lot area. Height over 45 ft needs P&Z review, plus 1 ft setback per 2 ft over 45 next to residential. Open storage up to 40% of lot. 20 ft greenbelt next to residential."),
 d(J,"I-2","Heavy Industrial","industrial",("§405.090",29399902),front=30,side=70,rear=70,height=45,
   note="Side 10 ft and rear 15 ft, or 70 ft next to residential. Height over 45 ft needs P&Z review, plus 1 ft setback per 2 ft over 45 next to residential. Open storage up to 60% of lot."),
 d(J,"RD","Recreational","recreational",("§405.092",45627792),lot=43560,front=20,side=10,rear=10,
   note="No minimum lot width. Street side setback 20 ft. No height limit stated. 25 ft vegetated buffer along natural watercourses; 10 ft greenbelt next to residential."),
 d(J,"SD/C-CC","College Campus","special",SC,front=40,side=40,rear=40,height=45,min_open_space_pct=35,
   note="Parking setback 40 ft."+SM),
 d(J,"SD/C-R1","College Single-Family","residential",SC,front=35,side=15,rear=25,height=35,
   note="No lot area or width stated in Art. IV."+SM),
 d(J,"SD/C-R2","College Two-Family","residential",SC,front=30,side=25,rear=25,height=35,
   note="No lot area or width stated in Art. IV."+SM),
 d(J,"SD/C-R3","College Multi-Family","residential",SC,width=200,dens=14,front=25,side=25,rear=25,height=45,
   min_lot_sf_per_unit=3111, min_dwelling_sf=1000, note="Lot area 3,111 sf per family, §405.213(D)."+SM),
 d(J,"SD/C-C1","College Pedestrian Commercial / Light Office","commercial",SC,front=4,side=0,rear=0,height=35,min_open_space_pct=15,
   note="Build-to style: 4 ft front, 0 ft sides and rear; parking 0 ft. Exempt from the 40 ft arterial setback."),
 d(J,"SD/C-C2","College General Commercial","commercial",SC,front=25,side=25,rear=25,height=35,min_open_space_pct=25,
   note="Parking setback 15 ft."+SM),
 d(J,"SD/C-C3","College General Commercial Retail","commercial",SC,front=25,side=25,rear=25,height=35,min_open_space_pct=25,
   note="Parking setback 15 ft."+SM),
 d(J,"SD/C-C5","College General Public","office",SC,front=30,side=30,rear=30,height=40,min_open_space_pct=30,
   note="Parking setback 20 ft."+SM),
 d(J,"SD/C-I1","College Light Industrial Park","industrial",SC,front=35,side=15,rear=15,height=45,min_open_space_pct=25,
   note="Parking setback 35 ft front, 10 ft side/rear."+SM),
 d(J,"SD/C-PO","College Park and Open Space","recreational",SC,front=70,side=70,rear=70,height=35,
   note="Parking setback 45 ft."+SM),
 d(J,"SD/C-UC","College Urban Corridor (overlay)","overlay",SC,
   note="Overlay; underlying district rules apply. Buildings 30 ft and parking 25 ft from Cottleville Pkwy, Mid Rivers Mall Dr and St. Peters-Cottleville Rd (except R-1A)."),
 d(J,"PUD","Planned Unit Development","planned",("Art. V",29400341), note="Standards set by the approved PUD plan; see Article V (incl. multiple-family PUDs)."),
]

# Dardenne Prairie Ch. 405, Art. III (ecode360). R-M (2012, amended May 2026) and C-3 (2016) have sections
# but are missing from the §405.090 district list (last amended 2021).
J = "dardenne_prairie"
DH = "2.5 stories or 35 ft, whichever is less. Detached accessory buildings 25 ft max."
DD = "Min dwelling 1,600 sf one-story; 1,250 sf first floor and 2,200 sf total two-story; 1,900 sf split-level/1.5-story."
DC = "Height over 45 ft only with P&Z and Board of Aldermen findings under the conditional use standards."
rows += [
 d(J,"R-1A","Single-Family Residential","residential",("§405.140",29686641),lot=43560,width=150,front=35,side=20,rear=35,height=35,
   min_lot_depth_ft=200, max_lot_coverage_pct=25, min_dwelling_sf=1600, note=DH+" "+DD),
 d(J,"R-1B","Single-Family Residential","residential",("§405.150",29686690),lot=20000,width=100,front=25,side=10,rear=25,height=35,
   min_lot_depth_ft=120, max_lot_coverage_pct=30, min_dwelling_sf=1600, note=DH+" "+DD),
 d(J,"R-1C","Single-Family Residential","residential",("§405.160",29686728),lot=15000,width=80,front=25,side=10,rear=25,height=35,
   min_lot_depth_ft=100, max_lot_coverage_pct=30, min_dwelling_sf=1600, note=DH+" "+DD),
 d(J,"R-1D","Single-Family Residential","residential",("§405.170",29686766),lot=12000,width=80,front=25,side=10,rear=25,height=35,
   min_lot_depth_ft=100, max_lot_coverage_pct=30, min_dwelling_sf=1600,
   note="Attached single-family: 5,400 sf lot or common ground, 45 ft wide, 70 ft deep, 20 ft rear yard, 1,450 sf first floor. Villas 1,450 sf first floor. "+DH+" "+DD),
 d(J,"R-M","Multiple-Family Residential","residential",("§405.175",29686808),lot=217800,width=100,dens=8,front=20,side=20,rear=20,
   min_dwelling_sf=900, max_stories=2,
   note="2 stories max. 5-acre lot, no access to minor streets; must adjoin 10+ acres of commercial/industrial zoning along 35%+ of its perimeter, and new multi-family must be next to I-64. Max 6 units per building; 20 ft between building sides, 40 ft front/rear. Two-car garage per unit with its own entrance. Not in the §405.090 district list."),
 d(J,"C-1","Local Commercial","commercial",("§405.180",29686864),lot=43560,width=70,front=25,side=10,rear=15,height=45,
   note="1 acre, or a combined district of at least 1 acre when abutting commercial/industrial zoning. No lot depth or coverage limit. "+DC),
 d(J,"C-2","General Commercial","commercial",("§405.190",29686911),lot=217800,width=150,front=25,side=10,rear=15,height=45,
   note="5 acres, or a combined district of at least 1 acre when abutting commercial/industrial zoning. Corner street side yard 25 ft. Front yard excludes signs, pump islands and canopies. "+DC),
 d(J,"C-3","Retail Commercial","commercial",("§405.195",33291485),width=150,front=25,side=10,rear=15,height=45,
   note="No minimum lot area stated. Board of Aldermen may approve smaller lot width and yards with an Article IV area plan. Corner street side yard 25 ft. "+DC+" Not in the §405.090 district list."),
 d(J,"I-1","Light Industrial","industrial",("§405.200",29686969),lot=43560,width=150,front=30,side=20,rear=35,height=50,
   max_lot_coverage_pct=40, note="Corner street side yard 30 ft. 50 ft or 3 stories; Board may allow up to 6 stories."),
 d(J,"HTCD","High Tech Corridor","industrial",("§405.210",29687062),lot=217800,width=100,front=30,side=20,rear=35,height=50,
   max_lot_coverage_pct=50, note="5-acre site, or a combined district of at least 5 acres when abutting HTCD/commercial. Corner side yard 30 ft. Front yard kept clear of parking and loading. 50 ft or 3 stories; Planning Commission may allow up to 6 stories. Secondary uses limited to 30% of the park."),
 d(J,"ND","New Development","mixed_use",("§405.215",44981193),
   note="Replaced the Uptown district (2021). Lot, yard and height standards come from the corresponding district for each area (R-1B/C/D along Post Rd and Town Square Ave; C-1/C-2 or residential at Post Rd & Technology Dr; C-2/C-3/HTCD along Technology Dr/I-64). Area or site plan approval by the Board of Aldermen required; design standards in §405.215(F)."),
 d(J,"PUD","Planned Unit Development","planned",("Art. IV",29687154), note="Standards set by the approved area and final plans; see Article IV."),
]

# Weldon Spring Ch. 405, Art. III bulk tables (ecode360; Ord. 18-12, 2018). Residential columns hold conventional-subdivision
# values; conservation subdivisions set lot, width and yards on the final plan (density by yield plan, Ch. 410.400-410.410).
J = "weldon_spring"
WD = "Min dwelling 2,500 sf (2-2.5 story), 2,200 sf (1.5 story), 2,000 sf (1 story); 1,250 sf footprint."
WC = lambda gs, sep: f"10-acre minimum district for conventional subdivisions. Conservation subdivisions: {gs}% green space, {sep} ft between dwellings, one outbuilding up to 1,000 sf. "
WB = "25 ft buffer yard next to single-family use or zoning."
rows += [
 d(J,"AG","Agricultural","agricultural",("§405.070",34347019),lot=217800,width=250,dens=0.2,front=50,side=40,rear=50,height=35,
   min_lot_depth_ft=250, min_dwelling_sf=2000, note=WC(60,100)+"Homes may reach 45 ft with Architectural Review Commission and Board approval. Stables and kennels 75 ft from lot lines. "+WD),
 d(J,"RS-3","Single-Family Residential (3 ac)","residential",("§405.075",34347042),lot=130680,width=250,dens=0.33,front=50,side=40,rear=50,height=35,
   min_dwelling_sf=2000, note=WC(50,75)+"Homes may reach 45 ft with Architectural Review Commission and Board approval. "+WD),
 d(J,"RS-2","Single-Family Residential (80,000 sf)","residential",("§405.080",34347064),lot=80000,width=200,dens=0.54,front=40,side=40,rear=40,height=35,
   min_lot_depth_ft=200, min_dwelling_sf=2000, note=WC(40,50)+"Homes may reach 40 ft with Architectural Review Commission and Board approval. "+WD),
 d(J,"RS-1","Single-Family Residential (40,000 sf)","residential",("§405.085",34347082),lot=40000,width=150,dens=1.09,front=35,side=20,rear=35,height=35,
   min_lot_depth_ft=150, min_dwelling_sf=2000, note=WC(30,35)+"Taller homes need Architectural Review Commission and Board approval. "+WD),
 d(J,"RS-1/2","Single-Family Residential (20,000 sf)","residential",("§405.090",34347100),lot=20000,width=100,dens=2.18,front=25,side=15,rear=25,height=35,
   min_lot_depth_ft=125, min_dwelling_sf=2000, note=WC(20,25)+"35 ft or 2.5 stories. "+WD),
 d(J,"PR","Planned Residential","planned",("§405.095",34347118),lot=20000,width=100,dens=12,front=25,side=15,rear=25,height=35,
   min_lot_depth_ft=125, min_dwelling_sf=2000,
   note="Guidelines; P&Z and Board set bulk per site. 10-acre district. Density per Comprehensive Plan, max 12 du/ac, and within 200 ft of the line no more than 150% of the neighbor's density. Attached or cluster homes need 5 acres. Villas 1,200 sf (1,000 sf footprint). Up to 40 ft on 1-acre lots with 1 ft added yard per ft over 35. Front yard larger along major roads. "+WD),
 d(J,"SP","Public/Semi-Public","special",("§405.100",34347142),lot=40000,width=200,front=50,side=50,rear=50,height=45,
   min_lot_depth_ft=200, max_lot_coverage_pct=60, note="45 ft or 3 stories. 10-acre district (5 acres combined contiguous tracts). "+WB),
 d(J,"HTO","High-Technology Office","office",("§405.105",34347153),lot=20000,width=100,front=50,side=20,rear=50,height=45,
   min_lot_depth_ft=100, max_lot_coverage_pct=65, min_open_space_pct=35,
   note="45 ft or 3 stories; Board may approve 4 stories or 75 ft. 40-acre district unless contiguous to existing HTO. All operations and storage enclosed. "+WB),
 d(J,"PC","Planned Commercial","commercial",("§405.110",34347172),lot=20000,width=100,front=25,side=10,rear=15,height=45,
   min_lot_depth_ft=100, min_open_space_pct=35,
   note="Guidelines; bulk set by the governing ordinance and site plan. 5-acre district. 45 ft or 3 stories unless the Board approves more. Villas, townhomes and multi-family by conditional use on 5+ acres, max 12 du/ac; multi-family limited to 20% of the development's coverage or floor area. "+WB),
 d(J,"GC","General Commercial","commercial",("§405.115",34347196),lot=10000,width=100,front=25,side=10,rear=15,height=45,
   min_lot_depth_ft=100, max_lot_coverage_pct=80, note="45 ft or 3 stories; Board may approve 4 stories or 75 ft. 5-acre district. "+WB),
 d(J,"LI","Light Industrial","industrial",("§405.120",34347207),lot=20000,width=100,front=25,side=10,rear=15,height=45,
   min_lot_depth_ft=200, max_lot_coverage_pct=80, note="45 ft or 3 stories. 5-acre district. Parking and storage yards hard surfaced. "+WB),
 d(J,"MED","Medical","special",("§405.125",34347219),lot=20000,width=100,front=50,side=20,rear=50,height=45,
   min_lot_depth_ft=150, max_lot_coverage_pct=75,
   note="45 ft or 3 stories. 20-acre district. Buildings set back 2 ft per ft of height from residential zoning. Helipads 50 ft from lot lines and 200 ft from residential. "+WB),
 d(J,"FP","Floodplain (overlay)","overlay",("§405.135",34347231), note="Floodplain overlay; see §405.130-405.135 and the floodplain chapter."),
]

# Foristell Ch. 400, Art. IV (ecode360; Ord. 330, 1999). Lot coverage is set only for C-1. M-1/M-2 state no height.
J = "foristell"
FR = "Min dwelling 1,800 sf (1 story), 2,200 sf (1.5 story), 2,400 sf (2 story)."
FR3 = "Min dwelling 1,600 sf (1 story), 2,000 sf (1.5 story), 2,200 sf (2 story)."
FC = "Single-family homes 1,000 sf min; new commercial buildings 2,000 sf min. Multi-family follows R-5."
rows += [
 d(J,"AG-1","Agricultural","agricultural",("§400.130",29733940),lot=435600,width=150,dens=0.1,front=50,side=40,rear=50,height=35,
   min_dwelling_sf=1000, note="Min dwelling 1,000 sf (1 story) plus 700 sf per added floor."),
 d(J,"R-1","Residential (3 ac)","residential",("§400.140",29733977),lot=130680,width=150,dens=0.33,front=35,side=20,rear=35,height=35,min_dwelling_sf=1800,note=FR),
 d(J,"R-2","Residential (1 ac)","residential",("§400.150",29734010),lot=43560,width=150,dens=1,front=35,side=20,rear=35,height=35,min_dwelling_sf=1800,note=FR),
 d(J,"R-3","Residential (1/2 ac)","residential",("§400.160",29734046),lot=21780,width=100,dens=2,front=25,side=15,rear=25,height=35,min_dwelling_sf=1600,note=FR3),
 d(J,"R-4","Residential (1/3 ac; 2-4 family)","residential",("§400.170",29734076),lot=14520,width=65,front=25,side=10,rear=25,height=35,min_dwelling_sf=1600,
   note="Lot 1/3 ac single-family; 14,000 sf two-family, 18,000 sf three-family, 22,000 sf four-family (6 du/ac for 2-3 family, 7 du/ac for 4-family). "+FR3),
 d(J,"R-5","Residential (multi-family)","residential",("§400.180",29734109),lot=14000,width=70,dens=7,front=25,side=10,rear=25,height=45,
   min_dwelling_sf_multifamily={"1br":800,"2br":900,"3br":1000,"4br":1100},
   note="14,000 sf two-family, 18,000 sf three-family, 22,000 sf four-family; over four units 5,000 sf of net area per unit (7 du/ac)."),
 d(J,"PD","Planned Development (PD-R, PD-C, PD-I, PD-MXD)","planned",("§400.190",29734152),
   note="Standards set by the ordinance creating each district. 10-acre minimum site (30 acres for PD-MXD). PD-R density follows R-1 to R-5 with possible bonus and 15% common open space. Perimeter buffer 20 ft (higher-density residential) or 30 ft next to commercial/industrial."),
 d(J,"C-1","Neighborhood Business","commercial",("§400.200",29734281),lot=8000,width=70,front=30,side=12,rear=30,height=35,
   max_lot_coverage_pct=35, note="35 ft or 2.5 stories, whichever is less. Lot 8,000 sf plus room for setbacks and parking. "+FC),
 d(J,"C-2","General Commercial","commercial",("§400.210",29734385),lot=8000,width=60,front=30,side=10,rear=25,height=50,
   note="50 ft or 3 stories, whichever is less. Rear yard 15 ft, or 25 ft next to residential. Coverage governed by setbacks, landscaping and parking. "+FC),
 d(J,"C-3","Planned Commercial","commercial",("§400.220",29734507),lot=130680,width=60,front=30,side=10,rear=30,height=35,
   note="35 ft or 2.5 stories. Shopping center of at least 5 stores, one of 10,000+ sf, 20,000 sf combined. Also called Highway Commercial in the utilities section."),
 d(J,"M-1","Light Industry","industrial",("§400.230",29734549),lot=130680,front=35,side=15,rear=15,
   note="Lots under 3 acres need a conditional use. No height limit stated. Uses include C-2 uses except dwellings."),
 d(J,"M-2","General Industry","industrial",("§400.240",29734578),lot=130680,front=35,side=15,rear=15,
   note="Lots under 3 acres need a conditional use. No height limit stated. Outside storage fenced and screened."),
 d(J,"M-3","Planned Industrial","industrial",("§400.250",29734607),lot=653400,front=30,side=50,rear=50,height=45,
   note="15-acre minimum, at least 5 separate businesses. 30 ft from all rights-of-way. Side/rear 50 ft next to A or R zoning, 10 ft next to C or M; 50 ft greenbelt next to A or R."),
 d(J,"MUDD","Mixed Use Development","planned",("§400.255",29734623),dens=30,
   note="500-acre minimum district; no minimum lot. Setbacks set by the district ordinance, 10 ft minimum. Next to residential, 1 ft extra setback per 2 ft of height over 30 ft."),
 d(J,"MH","Mobile Home Park","residential",("§400.260",29734668),lot=6000,width=50,dens=6,front=30,side=15,rear=15,
   min_lot_depth_ft=120, note="5-acre net district minimum, 15 ft buffer strip, 2 parking spaces per lot."),
 d(J,"PRS","Park, Recreational and Scenic","recreational",("§400.270",29734711),lot=217800,front=30,height=15,
   note="5-acre minimum (except utilities). 30 ft from roadway is the only setback given. Parking dust-free."),
 d(J,"OT","Special Old Town","special",("§400.271",29734732),front=15,rear=15,
   note="No minimum lot. Side yards set by review; zero lot lines allowed with a maintenance agreement. Height set by P&Z and the Board. Metal-clad buildings prohibited."),
]

json.dump(rows, open(sys.argv[1] + "/zoning_districts.json", "w"), indent=1)
print(len(rows))
