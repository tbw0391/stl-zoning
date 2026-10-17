// Suggestion #25: "Download deck" on the dashboard. Builds an editable PowerPoint from the live data: a title slide,
// the pipeline summary, one slide per active project (key dates, timeline with delays, tasks, latest note) and the
// project municipalities' meetings in the next 30 days. Text and tables are native PowerPoint objects, so the team
// can edit them before presenting.
import PptxGenJS from "pptxgenjs";
import { createClient } from "@/lib/supabase/server";
import { CLOSED_STAGES, STAGE_LABEL, addDays, fmtDate, shortName, todayCentral } from "@/lib/format";
import { Delay, STEP_LABEL, Timeline, loadTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";

// Pipeline order, matching the dashboard columns.
const ORDER = ["prospect", "loi", "diligence", "development", "oyl"];
const AHEAD_DAYS = 30;
// Diligence ending within this many days is flagged, as on the dashboard.
const DILIGENCE_WARN_DAYS = 30;
const MAX_TASKS = 5;

// Brand colors from globals.css (light theme), without '#'.
const C = { header: "033333", accent: "096764", brand: "FFB549", text: "1D2A28", muted: "5F6B67", border: "E3E1DA",
  due: "C4502A", ok: "2D6A3E", soft: "F6F5F1" };
const FONT = "Calibri";

type Project = {
  id: number; name: string; stage: string; jurisdiction_id: string | null; address: string | null; acreage: number | null;
  current_zoning: string | null; proposed_zoning: string | null; filed_on: string | null; diligence_expires_on: string | null;
  closing_on: string | null; case_numbers: string | null; jurisdictions: { name: string } | null;
  tasks: { title: string; assigned_to: string | null; due_date: string | null; done_at: string | null }[];
  project_notes: { body: string; author: string | null; created_at: string }[];
};

const short = (d: string | null | undefined) => (d ? fmtDate(d) : "—");
const cell = (text: string): PptxGenJS.TableCell => ({ text });

export async function GET(req: Request) {
  const today = todayCentral();
  const supabase = await createClient();
  const { data } = await supabase.from("projects")
    .select("id, name, stage, jurisdiction_id, address, acreage, current_zoning, proposed_zoning, filed_on, diligence_expires_on, closing_on, case_numbers, jurisdictions(name), tasks(title, assigned_to, due_date, done_at), project_notes(body, author, created_at)");
  const projects = ((data ?? []) as unknown as Project[])
    .filter((p) => !CLOSED_STAGES.includes(p.stage))
    .sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage) || a.name.localeCompare(b.name));

  // Each project's timeline: its own schedule (with delays) once filed, otherwise what filing today would look like.
  const { data: delayRows } = await supabase.from("project_delays").select("*").order("created_at");
  const delaysFor = (id: number) => ((delayRows ?? []) as (Delay & { project_id: number })[]).filter((d) => d.project_id === id);
  const timelines = new Map<number, Timeline>();
  await Promise.all(projects.filter((p) => p.jurisdiction_id).map(async (p) => {
    timelines.set(p.id, await loadTimeline(supabase, p.jurisdiction_id!, p.filed_on ?? today, p.filed_on ? delaysFor(p.id) : []));
  }));
  const places = [...new Set(projects.map((p) => p.jurisdiction_id).filter((j): j is string => !!j))];
  const { data: ahead } = places.length
    ? await supabase.from("meetings").select("jurisdiction_id, body, event_type, event_date, status, jurisdictions(name)")
        .in("jurisdiction_id", places).gte("event_date", today).lte("event_date", addDays(today, AHEAD_DAYS))
        .neq("status", "cancelled").in("body", ["planning_zoning", "governing_body"]).order("event_date")
    : { data: [] };

  const logo = await fetch(new URL("/lombardo-logo.png", req.url)).then(async (r) =>
    r.ok ? `image/png;base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null).catch(() => null);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = `Entitlement pipeline ${today}`;
  pptx.company = "Lombardo Homes";

  // Header band used on every content slide, as a slide master so the extra slides a long table runs onto
  // (autoPage) get it too. The summary and meetings slides get their own master with the title built in.
  const master = (name: string, title?: string, sub?: string) => pptx.defineSlideMaster({
    title: name, background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: C.header } } },
      { rect: { x: 0, y: 0.9, w: 13.33, h: 0.06, fill: { color: C.brand } } },
      { text: { text: `Entitlement Tracker · ${fmtDate(today)}`, options: { x: 0.5, y: 7.05, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted } } },
      ...(title ? [{ text: { text: title, options: { x: 0.5, y: 0.12, w: 9.5, h: 0.66, fontFace: FONT, fontSize: 24, bold: true, color: "FFFFFF", valign: "middle" as const } } }] : []),
      ...(sub ? [{ text: { text: sub, options: { x: 9.3, y: 0.12, w: 3.55, h: 0.66, fontFace: FONT, fontSize: 12, color: "D9E4E2", align: "right" as const, valign: "middle" as const } } }] : []),
    ],
  });
  master("CONTENT");
  const frame = (title: string, sub?: string) => {
    const slide = pptx.addSlide({ masterName: "CONTENT" });
    slide.addText(title, { x: 0.5, y: 0.12, w: 9.5, h: 0.66, fontFace: FONT, fontSize: 24, bold: true, color: "FFFFFF", valign: "middle" });
    if (sub) slide.addText(sub, { x: 9.3, y: 0.12, w: 3.55, h: 0.66, fontFace: FONT, fontSize: 12, color: "D9E4E2", align: "right", valign: "middle" });
    return slide;
  };
  const head = (t: string) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: C.accent } } });

  // 1. Title
  const title = pptx.addSlide();
  title.background = { color: C.header };
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 5.2, w: 13.33, h: 0.08, fill: { color: C.brand } });
  if (logo) {
    title.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 0.8, w: 3.6, h: 1.2, fill: { color: "FFFFFF" }, rectRadius: 0.1 });
    title.addImage({ data: logo, x: 1.0, y: 0.92, w: 3.2, h: 0.9 });
  }
  title.addText("Entitlement Pipeline", { x: 0.8, y: 2.6, w: 11.5, h: 1.0, fontFace: FONT, fontSize: 44, bold: true, color: "FFFFFF" });
  const acres = projects.reduce((s, p) => s + (p.acreage ?? 0), 0);
  title.addText(`${projects.length} active project${projects.length === 1 ? "" : "s"} · ${places.length} municipalit${places.length === 1 ? "y" : "ies"}` +
    (acres ? ` · ${Math.round(acres).toLocaleString()} acres` : ""), { x: 0.8, y: 3.6, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 20, color: C.brand });
  title.addText(fmtDate(today), { x: 0.8, y: 5.5, w: 6, h: 0.5, fontFace: FONT, fontSize: 16, color: "D9E4E2" });

  // 2. Pipeline summary: a tile per stage, then a row per project.
  master("SUMMARY", "Pipeline summary", `${projects.length} active`);
  const summary = pptx.addSlide({ masterName: "SUMMARY" });
  const tileW = (12.33 - 0.2 * (ORDER.length - 1)) / ORDER.length;
  ORDER.forEach((stage, i) => {
    const list = projects.filter((p) => p.stage === stage);
    const ac = list.reduce((s, p) => s + (p.acreage ?? 0), 0);
    const x = 0.5 + i * (tileW + 0.2);
    summary.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: tileW, h: 1.1, fill: { color: C.soft }, line: { color: C.border }, rectRadius: 0.08 });
    summary.addText([
      { text: String(list.length), options: { fontSize: 28, bold: true, color: C.accent, breakLine: true } },
      { text: `${STAGE_LABEL[stage]}${ac ? ` · ${Math.round(ac)} ac` : ""}`, options: { fontSize: 12, color: C.muted } },
    ], { x, y: 1.2, w: tileW, h: 1.1, fontFace: FONT, align: "center", valign: "middle" });
  });
  const rows = projects.map((p) => {
    const t = timelines.get(p.id);
    const hearing = t?.best.steps.find((s) => s.label === "P&Z hearing" && s.postponed == null);
    const flags = [
      t?.original !== undefined && p.filed_on ? "Delayed" : null,
      p.diligence_expires_on && p.diligence_expires_on < addDays(today, DILIGENCE_WARN_DAYS)
        ? (p.diligence_expires_on < today ? "Diligence expired" : "Diligence ending") : null,
    ].filter(Boolean).join(", ");
    return [...[p.name, p.jurisdictions ? shortName(p.jurisdictions.name) : "—", STAGE_LABEL[p.stage] ?? p.stage,
      p.acreage != null ? String(p.acreage) : "—",
      hearing?.date ? `${short(hearing.date)}${p.filed_on ? "" : " (if filed now)"}` : "—",
      short(t?.best.finalDate)].map(cell), { text: flags, options: { color: C.due, bold: !!flags } }];
  });
  summary.addTable([
    ["Project", "Municipality", "Stage", "Acres", "P&Z hearing", "Council", "Flags"].map(head),
    ...rows,
  ], { x: 0.5, y: 2.55, w: 12.33, colW: [2.9, 1.9, 1.2, 0.8, 2.0, 1.4, 2.13], fontFace: FONT, fontSize: 11, color: C.text,
    border: { type: "solid", pt: 0.5, color: C.border }, autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.2 });

  // 3. One slide per project.
  for (const p of projects) {
    const s = frame(p.name, `${STAGE_LABEL[p.stage] ?? p.stage}${p.jurisdictions ? ` · ${shortName(p.jurisdictions.name)}` : ""}`);
    const zoning = p.current_zoning || p.proposed_zoning ? `${p.current_zoning ?? "?"} → ${p.proposed_zoning ?? "?"}` : "—";
    const fact = (k: string, v: string, warn = false) => [
      { text: k, options: { color: C.muted } }, { text: v, options: { bold: warn, color: warn ? C.due : C.text } }];
    const dilWarn = !!p.diligence_expires_on && p.diligence_expires_on < addDays(today, DILIGENCE_WARN_DAYS);
    s.addText("Key facts", { x: 0.5, y: 1.15, w: 5.6, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
    s.addTable([
      fact("Address", p.address ?? "—"),
      fact("Acreage", p.acreage != null ? `${p.acreage} ac` : "—"),
      fact("Zoning", zoning),
      fact("Case number(s)", p.case_numbers ?? "—"),
      fact("Application filed", p.filed_on ? short(p.filed_on) : "Not yet"),
      fact("Diligence expires", short(p.diligence_expires_on), dilWarn),
      fact("Closing", short(p.closing_on)),
    ], { x: 0.5, y: 1.55, w: 5.6, colW: [1.9, 3.7], fontFace: FONT, fontSize: 12, border: { type: "solid", pt: 0.5, color: C.border } });

    // Timeline on the right: postponed dates struck through.
    const t = timelines.get(p.id);
    s.addText(p.filed_on ? "Schedule" : "Timeline if filed today", { x: 6.6, y: 1.15, w: 6.2, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
    const steps = t?.best.steps ?? [];
    const lines = steps.length ? steps.map((st) => {
      const gone = st.postponed != null;
      return { text: `${short(st.date)}   ${st.label}${gone ? `  (postponed${st.postponed ? `: ${st.postponed}` : ""})` : st.estimated && st.date ? "  (est.)" : ""}${st.note && !gone ? ` · ${st.note}` : ""}`,
        options: { breakLine: true, color: gone ? C.muted : C.text, strike: gone ? ("sngStrike" as const) : undefined } };
    }) : [{ text: p.jurisdiction_id ? "No schedule loaded for this municipality." : "Municipality not set.", options: { color: C.muted } }];
    s.addText(lines, { x: 6.6, y: 1.55, w: 6.2, h: 2.4, fontFace: FONT, fontSize: 12, valign: "top", paraSpaceAfter: 4 });
    if (t?.original !== undefined && p.filed_on) {
      const slip = t.original && t.best.finalDate
        ? `Final council action ${short(t.best.finalDate)}, was ${short(t.original)}.`
        : "Final council action is now past the loaded schedule.";
      s.addText(`Delayed. ${slip}`, { x: 6.6, y: 3.95, w: 6.2, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: C.due });
    }
    const delays = delaysFor(p.id);
    if (delays.length) {
      s.addText(delays.map((d) => ({ text: `${STEP_LABEL[d.step]} postponed from ${short(d.from_date)}${d.reason ? ` · ${d.reason}` : ""}`,
        options: { breakLine: true } })), { x: 6.6, y: 4.35, w: 6.2, h: 0.8, fontFace: FONT, fontSize: 10, color: C.muted, valign: "top" });
    }

    // Bottom: open tasks and the latest note.
    const open = p.tasks.filter((x) => !x.done_at).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    s.addText("Next steps", { x: 0.5, y: 4.85, w: 5.6, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
    s.addText(open.length ? open.slice(0, MAX_TASKS).map((x) => ({
      text: `${x.title}${x.assigned_to ? ` — ${x.assigned_to}` : ""}${x.due_date ? ` (due ${short(x.due_date)})` : ""}`,
      options: { bullet: true, breakLine: true, color: x.due_date && x.due_date < today ? C.due : C.text },
    })).concat(open.length > MAX_TASKS ? [{ text: `+ ${open.length - MAX_TASKS} more`, options: { bullet: false, breakLine: true, color: C.muted } }] : [])
      : [{ text: "No open tasks.", options: { bullet: false, breakLine: true, color: C.muted } }],
    { x: 0.5, y: 5.25, w: 5.6, h: 1.75, fontFace: FONT, fontSize: 11, valign: "top" });
    const note = [...p.project_notes].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (note) {
      s.addText("Latest note", { x: 6.6, y: 5.2, w: 6.2, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
      s.addText(`${note.body.length > 400 ? `${note.body.slice(0, 400)}…` : note.body}\n— ${note.author ?? "Unknown"}, ${short(note.created_at.slice(0, 10))}`,
        { x: 6.6, y: 5.6, w: 6.2, h: 1.4, fontFace: FONT, fontSize: 10, color: C.text, valign: "top" });
    }
  }

  // 4. Upcoming hearings in the project municipalities.
  master("MEETINGS", `Upcoming meetings · next ${AHEAD_DAYS} days`, "Project municipalities");
  const up = pptx.addSlide({ masterName: "MEETINGS" });
  const meetings = (ahead ?? []) as unknown as { jurisdiction_id: string; body: string; event_type: string; event_date: string; status: string; jurisdictions: { name: string } | null }[];
  if (meetings.length) {
    up.addTable([
      ["Date", "Municipality", "Meeting", "Projects there"].map(head),
      ...meetings.map((m) => ([
        `${short(m.event_date)}${m.status === "projected" ? " (projected)" : ""}`,
        m.jurisdictions ? shortName(m.jurisdictions.name) : m.jurisdiction_id,
        m.event_type === "submittal_deadline" ? "Submittal deadline" : m.body === "planning_zoning" ? "P&Z" : "Council / Aldermen",
        projects.filter((p) => p.jurisdiction_id === m.jurisdiction_id).map((p) => p.name).join(", "),
      ]).map(cell)),
    ], { x: 0.5, y: 1.2, w: 12.33, colW: [2.2, 2.4, 2.2, 5.53], fontFace: FONT, fontSize: 11, color: C.text,
      border: { type: "solid", pt: 0.5, color: C.border }, autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.2 });
  } else {
    up.addText("No meetings loaded for the project municipalities in the next 30 days.", { x: 0.5, y: 1.4, w: 12, h: 0.5, fontFace: FONT, fontSize: 14, color: C.muted });
  }

  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="entitlement-pipeline-${today}.pptx"`,
    },
  });
}
