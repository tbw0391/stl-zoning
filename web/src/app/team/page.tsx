import Link from "next/link";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import PageTitle from "@/components/PageTitle";
import { fmtDate } from "@/lib/format";
import { team, removeMember, type Member } from "./actions";
import AddMember from "./AddMember";

export const dynamic = "force-dynamic";

// Who can sign in. Anyone on the team can add or remove people (one team, Lombardo, for now).
export default async function TeamPage() {
  const out = await team<{ me: string; members: Member[] }>({ action: "list" });
  if (out.error) {
    return (
      <>
        <PageTitle href="/team" icon={faUsers}>Team</PageTitle>
        <p>{out.error}{out.error.startsWith("Sign in") && <> <Link href="/login?next=/team">Sign in</Link></>}</p>
      </>
    );
  }
  const members = [...out.members].sort((a, b) => (a.email ?? a.phone ?? "").localeCompare(b.email ?? b.phone ?? ""));
  return (
    <>
      <PageTitle href="/team" icon={faUsers}>Team</PageTitle>
      <p className="muted">
        People who can sign in. They sign in at <code>/login</code> with a 6-digit code sent to their email, or by text if
        a mobile number is on file. No passwords.
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Email</th><th>Mobile</th><th>Last signed in</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.email ?? <span className="muted">—</span>}{m.id === out.me && <span className="muted small"> (you)</span>}</td>
                <td>{m.phone ?? <span className="muted">—</span>}</td>
                <td>{m.last_sign_in_at ? fmtDate(m.last_sign_in_at.slice(0, 10)) : <span className="muted">Never</span>}</td>
                <td>
                  {m.id !== out.me && (
                    <form action={removeMember.bind(null, m.id)}>
                      <button type="submit" className="link danger">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Add someone</h2>
      <div className="card">
        <AddMember />
        <p className="source">Adding a mobile number to someone already listed: enter their email and the number.</p>
      </div>
    </>
  );
}
