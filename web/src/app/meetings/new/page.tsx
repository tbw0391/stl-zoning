import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createMeeting } from "../actions";
import { MeetingForm } from "../MeetingForm";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: js } = await supabase.from("jurisdictions").select("id, name").order("name");

  return (
    <>
      <p className="small"><Link href={sp.j ? `/jurisdictions/${sp.j}` : "/"}>← Back</Link></p>
      <h1>Add a meeting or deadline</h1>
      <MeetingForm action={createMeeting} meeting={{ jurisdiction_id: sp.j ?? "" }} jurisdictions={js ?? []} submitLabel="Add" />
    </>
  );
}
