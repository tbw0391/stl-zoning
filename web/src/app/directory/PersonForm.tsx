import { ROLE_LABEL, shortName } from "@/lib/format";
import type { ProfileLink } from "@/components/ProfileLinks";

export type Person = {
  jurisdiction_id: string;
  full_name: string;
  role_group: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  term_expires: string | null;
  source_url: string | null;
  links: ProfileLink[] | null;
};

export function PersonForm({ action, person, jurisdictions, submitLabel }: {
  action: (fd: FormData) => Promise<void>;
  person?: Partial<Person>;
  jurisdictions: { id: string; name: string }[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="card stack-form">
      <label>Name<input name="full_name" required defaultValue={person?.full_name ?? ""} /></label>
      <label>Jurisdiction
        <select name="jurisdiction_id" required defaultValue={person?.jurisdiction_id ?? ""}>
          <option value="" disabled>Choose one</option>
          {jurisdictions.map((j) => <option key={j.id} value={j.id}>{shortName(j.name)}</option>)}
        </select>
      </label>
      <label>Group
        <select name="role_group" required defaultValue={person?.role_group ?? ""}>
          <option value="" disabled>Choose one</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>Title<input name="title" defaultValue={person?.title ?? ""} placeholder="e.g. Alderman, Ward 2" /></label>
      <label>Email<input type="email" name="email" defaultValue={person?.email ?? ""} /></label>
      <label>Phone<input name="phone" defaultValue={person?.phone ?? ""} /></label>
      <label>Term expires<input type="date" name="term_expires" defaultValue={person?.term_expires ?? ""} /></label>
      <label>Public profiles (one link per line: Facebook, LinkedIn, campaign site)
        <textarea name="links" rows={3} defaultValue={(person?.links ?? []).map((l) => l.url).join("\n")} placeholder="https://www.facebook.com/..." />
      </label>
      <label>Source (where this came from)<input name="source_url" defaultValue={person?.source_url ?? ""} placeholder="Link, or e.g. Phone call with city clerk" /></label>
      <div><button type="submit">{submitLabel}</button></div>
    </form>
  );
}
