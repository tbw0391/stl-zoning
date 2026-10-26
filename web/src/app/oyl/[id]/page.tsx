import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOT_SELECT, type Lot } from "@/lib/oyl";
import { updateLot } from "../actions";
import LotForm from "../LotForm";

export const dynamic = "force-dynamic";

export default async function EditLotPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const supabase = await createClient();
  const [{ data }, { data: js }] = await Promise.all([
    supabase.from("oyl_lots").select(LOT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("jurisdictions").select("id, name").eq("state", "MO").order("name"),
  ]);
  if (!data) notFound();
  const lot = data as unknown as Lot;
  return (
    <>
      <p className="small"><Link href="/oyl">← OYL lots</Link> · <Link href={`/projects/${lot.project_id}`}>Project page</Link></p>
      <h1>{lot.projects.address ?? lot.projects.name}</h1>
      <LotForm action={updateLot.bind(null, id)} lot={lot} jurisdictions={js ?? []} submitLabel="Save" />
    </>
  );
}
