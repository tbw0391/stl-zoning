import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, shortName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let q = supabase.from("people").select("*").eq("active", true).order("jurisdiction_id").order("role_group").order("id");
  if (sp.j) q = q.eq("jurisdiction_id", sp.j);
  if (sp.role) q = q.eq("role_group", sp.role);
  if (sp.q) q = q.or(`full_name.ilike.%${sp.q.replace(/[%,()]/g, "")}%,title.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  const [{ data: people }, { data: js }] = await Promise.all([
    q,
    supabase.from("jurisdictions").select("id, name").order("name"),
  ]);
  const jname = new Map((js ?? []).map((j) => [j.id, j.name]));

  return (
    <>
      <h1>Directory</h1>
      <p className="muted">P&amp;Z commissioners, elected officials and key staff. Coverage grows as each jurisdiction is researched.</p>

      <form className="filters" method="get">
        <label>Search
          <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Name or title" />
        </label>
        <label>Jurisdiction
          <select name="j" defaultValue={sp.j ?? ""}>
            <option value="">All</option>
            {(js ?? []).map((j) => <option key={j.id} value={j.id}>{shortName(j.name)}</option>)}
          </select>
        </label>
        <label>Group
          <select name="role" defaultValue={sp.role ?? ""}>
            <option value="">All</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>

      {!people || people.length === 0 ? (
        <div className="card empty">No one matches.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Title</th><th>Jurisdiction</th><th>Group</th><th>Email</th><th>Phone</th></tr></thead>
            <tbody>
              {people.map((x) => (
                <tr key={x.id}>
                  <td>{x.full_name}</td>
                  <td>{x.title}</td>
                  <td><Link href={`/jurisdictions/${x.jurisdiction_id}`}>{shortName(jname.get(x.jurisdiction_id) ?? x.jurisdiction_id)}</Link></td>
                  <td className="small">{ROLE_LABEL[x.role_group]}</td>
                  <td>{x.email ? <a href={`mailto:${x.email}`}>{x.email}</a> : <span className="muted">—</span>}</td>
                  <td>{x.phone ?? <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
