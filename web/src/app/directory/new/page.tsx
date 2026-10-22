import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentState } from "@/lib/state";
import { createPerson } from "../actions";
import { PersonForm } from "../PersonForm";

export const dynamic = "force-dynamic";

export default async function NewPersonPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: js } = await supabase.from("jurisdictions").select("id, name").eq("state", await currentState()).order("name");

  return (
    <>
      <p className="small"><Link href={sp.j ? `/directory?j=${sp.j}` : "/directory"}>← Directory</Link></p>
      <h1>Add person</h1>
      <PersonForm action={createPerson} person={{ jurisdiction_id: sp.j ?? "" }} jurisdictions={js ?? []} submitLabel="Add person" />
    </>
  );
}
