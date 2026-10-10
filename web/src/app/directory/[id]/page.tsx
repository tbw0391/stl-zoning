import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { removePerson, updatePerson } from "../actions";
import { PersonForm } from "../PersonForm";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const [{ data: p }, { data: js }] = await Promise.all([
    supabase.from("people").select("*").eq("id", id).maybeSingle(),
    supabase.from("jurisdictions").select("id, name").order("name"),
  ]);
  if (!p) notFound();

  return (
    <>
      <p className="small"><Link href={`/directory?j=${p.jurisdiction_id}`}>← Directory</Link></p>
      <h1>Edit {p.full_name}</h1>
      {p.verified_on && <p className="muted small">Last verified {fmtDate(p.verified_on)}. Saving marks it verified today.</p>}
      {!p.active && <p className="notice">This person was removed from the directory. Saving won&apos;t bring them back.</p>}
      <PersonForm action={updatePerson.bind(null, id)} person={p} jurisdictions={js ?? []} submitLabel="Save changes" />
      {p.active && (
        <form action={removePerson.bind(null, id, p.jurisdiction_id)} style={{ marginTop: 16 }}>
          <button type="submit" className="link">Remove from directory</button>
          <span className="muted small"> (no longer serving; the record is kept)</span>
        </form>
      )}
    </>
  );
}
