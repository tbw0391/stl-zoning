import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { shortName } from "@/lib/format";
import { ASK_COOKIE } from "@/lib/features";
import { answerHistoryAsk } from "@/app/history-ask/actions";

// One-time question for the team: read older agendas for the project cities, and is there another city to do first?
// Hidden once answered in this browser.
export default async function HistoryAsk() {
  if ((await cookies()).get(ASK_COOKIE)) return null;
  const supabase = await createClient();
  const { data: js } = await supabase.from("jurisdictions").select("id, name").not("collector", "is", null)
    .not("id", "in", "(chesterfield,stcharles_county,wildwood)").order("name");
  return (
    <form action={answerHistoryAsk} className="alert-banner ask-banner">
      <div>
        <strong>See how long cases usually take?</strong> We can read past agendas (back to 2021) for{" "}
        <strong>Chesterfield</strong> and <strong>St. Charles County</strong>, so project timelines show what&apos;s
        typical there, like they do for Wildwood.
        <label className="ask-other">Want another city sooner?{" "}
          <select name="other" defaultValue="">
            <option value="">No other city</option>
            {(js ?? []).map((j) => <option key={j.id} value={shortName(j.name)}>{shortName(j.name)}</option>)}
          </select>
        </label>
      </div>
      <div className="alert-banner-actions">
        <button type="submit" name="choice" value="yes">Yes, add them</button>
        <button type="submit" name="choice" value="no" className="link">Not now</button>
      </div>
    </form>
  );
}
