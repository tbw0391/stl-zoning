import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { skipUnfollowed, unfollowedIds } from "@/lib/followed";
import { fmtDate, shortName } from "@/lib/format";
import { BODY_LABEL } from "@/components/MeetingSummary";
import PageTitle from "@/components/PageTitle";
import { ResultTag, VoteTag, VotesList } from "@/components/Votes";
import { MeetingVotes, MemberVote, memberHref } from "@/lib/votes";
import { enabledFeatures } from "@/lib/features";

export const dynamic = "force-dynamic";

type Member = {
  key: string; jurisdiction_id: string; jurisdiction_name: string; name: string; person_id: number | null;
  boards: Set<string>; aye: number; nay: number; other: number; last: string;
};

// Groups vote rows by jurisdiction and last name. The display name is the directory name when matched,
// else the longest name the minutes used ("Jane Doe" over "Doe").
function members(rows: MemberVote[]) {
  const map = new Map<string, Member>();
  for (const r of rows) {
    const k = `${r.jurisdiction_id}|${r.member_key}`;
    const m = map.get(k) ?? {
      key: r.member_key, jurisdiction_id: r.jurisdiction_id, jurisdiction_name: r.jurisdiction_name, name: r.member_name,
      person_id: null, boards: new Set<string>(), aye: 0, nay: 0, other: 0, last: r.event_date,
    };
    if (r.person_id) { m.person_id = r.person_id; m.name = r.person_name ?? m.name; }
    else if (!m.person_id && r.member_name.length > m.name.length) m.name = r.member_name;
    m.boards.add(r.body);
    if (r.vote === "aye") m.aye++; else if (r.vote === "nay") m.nay++; else m.other++;
    if (r.event_date > m.last) m.last = r.event_date;
    map.set(k, m);
  }
  return [...map.values()];
}

export default async function VotesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("member_votes").select("*").order("event_date", { ascending: false });
  q = sp.j ? q.eq("jurisdiction_id", sp.j) : skipUnfollowed(q, await unfollowedIds(supabase));
  const [{ data }, { data: js }] = await Promise.all([q, supabase.from("jurisdictions").select("id, name").order("name")]);
  const rows = (data ?? []) as MemberVote[];
  const all = members(rows);
  const byLocation = (await enabledFeatures()).includes("votes-by-location");

  // One member's record.
  if (sp.j && sp.m) {
    const mine = rows.filter((r) => r.member_key === sp.m);
    const me = members(mine)[0];
    return (
      <>
        <p className="small"><Link href={`/votes?j=${sp.j}`}>← Votes in {shortName(js?.find((j) => j.id === sp.j)?.name ?? sp.j)}</Link></p>
        <h1>{me?.name ?? sp.m}</h1>
        {me ? (
          <>
            <p className="muted">
              {shortName(me.jurisdiction_name)} · {[...me.boards].map((b) => BODY_LABEL[b] ?? b).join(", ")} ·{" "}
              {me.aye} aye, {me.nay} nay{me.other ? `, ${me.other} abstained, recused or absent` : ""}
              {me.person_id ? <> · <Link href={`/directory/${me.person_id}`}>Directory entry</Link></> : null}
            </p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Meeting</th><th>Item</th><th>Motion</th><th>Result</th><th>Vote</th></tr></thead>
                <tbody>
                  {mine.map((r) => (
                    <tr key={`${r.meeting_id}-${r.vote_idx}`}>
                      <td><Link href={`/meetings/${r.meeting_id}`}>{fmtDate(r.event_date)}</Link><div className="small muted">{r.body === "planning_zoning" ? "P&Z" : BODY_LABEL[r.body]}</div></td>
                      <td>{r.item}</td>
                      <td className="small">{r.motion}</td>
                      <td><ResultTag result={r.result} /></td>
                      <td><VoteTag vote={r.vote} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <div className="card empty">No named votes for this member.</div>}
        <p className="source">Votes are read from posted minutes; members are matched to the directory by last name within the municipality.</p>
      </>
    );
  }

  const byJ = new Map<string, Member[]>();
  for (const m of all) byJ.set(m.jurisdiction_id, [...(byJ.get(m.jurisdiction_id) ?? []), m]);
  const withVotes = (js ?? []).filter((j) => byJ.has(j.id) || j.id === sp.j);
  const memberTable = (list: Member[]) => (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Member</th><th>Board</th><th>Aye</th><th>Nay</th><th>Other</th><th>Last vote</th></tr></thead>
        <tbody>
          {list.sort((a, b) => b.nay - a.nay || a.name.localeCompare(b.name)).map((m) => (
            <tr key={m.key}>
              <td><Link href={memberHref(m.jurisdiction_id, m.key)}>{m.name}</Link></td>
              <td className="small">{[...m.boards].map((b) => (b === "planning_zoning" ? "P&Z" : "Council")).join(", ")}</td>
              <td>{m.aye}</td>
              <td>{m.nay ? <strong>{m.nay}</strong> : 0}</td>
              <td className="muted">{m.other}</td>
              <td className="small">{fmtDate(m.last)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (byLocation) return <ByLocation sp={sp} js={js ?? []} byJ={byJ} memberTable={memberTable} />;

  return (
    <>
      <PageTitle href="/votes">Votes</PageTitle>
      <p className="muted">
        How P&amp;Z and council members voted on land-use items, read from posted minutes of recent meetings. Only votes
        where the minutes name who voted which way appear here; each meeting page has the full result.
      </p>
      <form className="filters" method="get">
        <label>Municipality
          <select name="j" defaultValue={sp.j ?? ""}>
            <option value="">All</option>
            {(js ?? []).filter((j) => byJ.has(j.id) || j.id === sp.j).map((j) => <option key={j.id} value={j.id}>{shortName(j.name)}</option>)}
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>

      {withVotes.length === 0 ? (
        <div className="card empty">No named votes yet. Minutes are read hourly as cities post them.</div>
      ) : withVotes.map((j) => (
        <section key={j.id}>
          <h2>{shortName(j.name)}</h2>
          {memberTable(byJ.get(j.id) ?? [])}
        </section>
      ))}
    </>
  );
}

type Meeting = { id: number; jurisdiction_id: string; body: string; event_date: string; votes: MeetingVotes };

// "votes-by-location" feature: /votes is a button per municipality; ?j= is that municipality's page with its members
// and every vote read from its minutes, meeting by meeting (including votes where the minutes name no one).
async function ByLocation({ sp, js, byJ, memberTable }: {
  sp: Record<string, string | undefined>; js: { id: string; name: string }[]; byJ: Map<string, Member[]>;
  memberTable: (list: Member[]) => React.ReactNode;
}) {
  const supabase = await createClient();
  let q = supabase.from("meetings").select("id, jurisdiction_id, body, event_date, votes").not("votes", "is", null)
    .order("event_date", { ascending: false });
  q = sp.j ? q.eq("jurisdiction_id", sp.j) : skipUnfollowed(q, await unfollowedIds(supabase));
  const { data } = await q;
  const meetings = ((data ?? []) as Meeting[]).filter((m) => m.votes.votes?.length);
  const byMeetingJ = new Map<string, Meeting[]>();
  for (const m of meetings) byMeetingJ.set(m.jurisdiction_id, [...(byMeetingJ.get(m.jurisdiction_id) ?? []), m]);
  const voteCount = (ms: Meeting[]) => ms.reduce((n, m) => n + m.votes.votes.length, 0);

  if (sp.j) {
    const name = shortName(js.find((j) => j.id === sp.j)?.name ?? sp.j);
    const mine = byMeetingJ.get(sp.j) ?? [];
    const people = byJ.get(sp.j) ?? [];
    const { data: memberRows } = mine.length
      ? await supabase.from("member_votes").select("*").in("meeting_id", mine.map((m) => m.id))
      : { data: [] };
    const rowsFor = (id: number) => ((memberRows ?? []) as MemberVote[]).filter((r) => r.meeting_id === id);
    return (
      <>
        <p className="small"><Link href="/votes">← All municipalities</Link></p>
        <PageTitle href="/votes">Votes in {name}</PageTitle>
        <p className="muted">
          {voteCount(mine)} land-use vote{voteCount(mine) === 1 ? "" : "s"} from {mine.length} meeting{mine.length === 1 ? "" : "s"}
          {people.length > 0 && <>, {people.length} named member{people.length === 1 ? "" : "s"}</>}
          {" · "}<Link href={`/jurisdictions/${sp.j}`}>Municipality page</Link>
        </p>
        {mine.length === 0 ? <div className="card empty">No votes read from {name}&apos;s minutes yet.</div> : (
          <>
            {people.length > 0 && (<><h2>Members</h2>{memberTable(people)}</>)}
            <h2>Votes by meeting</h2>
            {mine.map((m) => (
              <section key={m.id}>
                <h3><Link href={`/meetings/${m.id}`}>{fmtDate(m.event_date)}</Link> <span className="muted small">{BODY_LABEL[m.body] ?? m.body}</span></h3>
                <VotesList votes={m.votes} members={rowsFor(m.id)} jurisdictionId={m.jurisdiction_id} />
              </section>
            ))}
          </>
        )}
        <p className="source">Votes are read from posted minutes; members are matched to the directory by last name within the municipality.</p>
      </>
    );
  }

  const places = js.filter((j) => byMeetingJ.has(j.id) || byJ.has(j.id));
  return (
    <>
      <PageTitle href="/votes">Votes</PageTitle>
      <p className="muted">
        How P&amp;Z and council members voted on land-use items, read from posted minutes of recent meetings. Pick a
        municipality to see its members and every vote.
      </p>
      {places.length === 0 ? <div className="card empty">No votes yet. Minutes are read hourly as cities post them.</div> : (
        <div className="place-grid">
          {places.map((j) => {
            const ms = byMeetingJ.get(j.id) ?? [];
            const people = byJ.get(j.id) ?? [];
            return (
              <Link key={j.id} href={`/votes?j=${j.id}`} className="card place-button">
                <strong>{shortName(j.name)}</strong>
                <span className="small">{voteCount(ms)} vote{voteCount(ms) === 1 ? "" : "s"} · {people.length} member{people.length === 1 ? "" : "s"}</span>
                {ms[0] && <span className="small muted">Last {fmtDate(ms[0].event_date)}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
