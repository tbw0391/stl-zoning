import Link from "next/link";
import { faStar } from "@fortawesome/free-regular-svg-icons";
import PageTitle from "@/components/PageTitle";
import { SITE_FEATURES as FEATURES, SEEN_COOKIE, enabledFeatures, unseenFeatureCount } from "@/lib/features";
import { fmtDate } from "@/lib/format";
import { cookies } from "next/headers";
import { setFeature } from "./actions";
import MarkSeen from "./MarkSeen";

export const dynamic = "force-dynamic";

export default async function FeaturesPage() {
  const [on, unseen, jar] = await Promise.all([enabledFeatures(), unseenFeatureCount(), cookies()]);
  const seen = jar.get(SEEN_COOKIE)?.value ?? "";
  return (
    <>
      <PageTitle href="/features" icon={faStar}>New features</PageTitle>
      <p className="muted">
        New changes to the site start switched off, so nothing moves around until you&apos;re ready. Switch one on to try it, and
        off again to go back. Your choices apply to this browser only.
      </p>
      <MarkSeen unseen={unseen} />
      {FEATURES.length === 0 ? <div className="card empty">Nothing new right now.</div> : (
        <ul className="todos card">
          {FEATURES.map((f) => {
            const isOn = on.includes(f.key);
            return (
              <li key={f.key} className="todo feature">
                <div>
                  <div className="todo-body">
                    <strong>{f.title}</strong>
                    {f.added > seen && <> <span className="tag due">New</span></>}
                  </div>
                  <div className="small">{f.description}</div>
                  <div className="small muted">
                    Added {fmtDate(f.added)}{f.page && <> · <Link href={f.page}>{f.page}</Link></>}
                  </div>
                </div>
                <form action={setFeature.bind(null, f.key, !isOn)}>
                  <button type="submit" className={isOn ? "feature-switch on" : "feature-switch"} aria-pressed={isOn}>
                    {isOn ? "On" : "Off"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
