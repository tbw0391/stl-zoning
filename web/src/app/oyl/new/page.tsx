import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createLot } from "../actions";
import LotForm from "../LotForm";

export const dynamic = "force-dynamic";

export default async function NewLotPage() {
  const supabase = await createClient();
  const { data: js } = await supabase.from("jurisdictions").select("id, name").eq("state", "MO").order("name");
  return (
    <>
      <p className="small"><Link href="/oyl">← OYL lots</Link></p>
      <h1>Add an OYL lot</h1>
      <LotForm action={createLot} jurisdictions={js ?? []} submitLabel="Add lot" />
    </>
  );
}
