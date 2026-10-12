// Public profile links for a person (people.links): Facebook, LinkedIn, X, a campaign site.
export type ProfileLink = { label: string; url: string };

const SITES: [RegExp, string][] = [
  [/facebook\.com|fb\.com/i, "Facebook"],
  [/linkedin\.com/i, "LinkedIn"],
  [/twitter\.com|(^|\.)x\.com/i, "X"],
  [/instagram\.com/i, "Instagram"],
  [/nextdoor\.com/i, "Nextdoor"],
  [/youtube\.com/i, "YouTube"],
];

export function labelFor(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SITES.find(([re]) => re.test(host))?.[1] ?? host;
  } catch {
    return "Link";
  }
}

// One URL per line from the edit form; anything that isn't an http(s) link is dropped.
export function parseLinks(text: string): ProfileLink[] | null {
  const links = text.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\/\S+\.\S+/i.test(s))
    .map((url) => ({ label: labelFor(url), url }));
  return links.length ? links : null;
}

export default function ProfileLinks({ links }: { links: ProfileLink[] | null | undefined }) {
  if (!links?.length) return null;
  return (
    <div className="small">
      {links.map((l, i) => (
        <span key={l.url}>{i > 0 && " · "}<a href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a></span>
      ))}
    </div>
  );
}
