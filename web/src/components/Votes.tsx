import Link from "next/link";
import { MeetingVotes, MemberVote, RESULT_LABEL, VOTE_LABEL, memberHref, tally } from "@/lib/votes";

export const ResultTag = ({ result }: { result: string }) =>
  <span className={`tag result-${result}`}>{RESULT_LABEL[result] ?? result}</span>;

export const VoteTag = ({ vote }: { vote: string }) =>
  <span className={`tag vote-${vote}`}>{VOTE_LABEL[vote] ?? vote}</span>;

// The votes on a meeting's land-use items. members are this meeting's member_votes rows, for links to each member's record.
export function VotesList({ votes, members, jurisdictionId }: { votes: MeetingVotes; members: MemberVote[]; jurisdictionId: string }) {
  const row = new Map(members.map((r) => [`${r.vote_idx}|${r.roll_idx}`, r]));
  return (
    <div className="votes">
      {votes.votes.map((v, i) => (
        <div key={i} className="card vote">
          <div className="case-meta">
            <ResultTag result={v.result} />
            <strong>{v.item}</strong>
            {tally(v) && <span className="small muted">{tally(v)}</span>}
          </div>
          <div className="small">{v.motion}</div>
          {v.roll_call.length > 0 && (
            <ul className="roll">
              {v.roll_call.map((r, j) => {
                const m = row.get(`${i}|${j}`);
                return (
                  <li key={j}>
                    <VoteTag vote={r.vote} />{" "}
                    {m ? <Link href={memberHref(jurisdictionId, m.member_key)}>{m.person_name ?? r.name}</Link> : r.name}
                  </li>
                );
              })}
            </ul>
          )}
          {v.note && <div className="small muted">{v.note}</div>}
        </div>
      ))}
    </div>
  );
}
