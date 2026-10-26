import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, shortName } from "@/lib/format";
import { LOT_SELECT, daysAfterPurchase, isClosed, lotSummary, lotTotal, money, type Lot } from "@/lib/oyl";
import PageTitle from "@/components/PageTitle";

export const dynamic = "force-dynamic";

const d = (v: string | null) => (v ? fmtDate(v) : "");
const days = (n: number | null) => (n == null ? "" : String(n));
const avg = (ns: (number | null)[]) => {
  const xs = ns.filter((n): n is number => n != null);
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
};

// Chad's OYL Tracker: working lots, the lot-count box, and closed lots with days to flash and to customer purchase.
export default async function OylPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("oyl_lots").select(LOT_SELECT);
  const lots = ((data ?? []) as unknown as Lot[])
    .sort((a, b) => (a.projects.closing_on ?? "9999").localeCompare(b.projects.closing_on ?? "9999"));
  const working = lots.filter((l) => !isClosed(l));
  const closed = lots.filter(isClosed);
  const place = (l: Lot) => shortName(l.projects.jurisdictions?.name ?? "");
  const address = (l: Lot) => <Link href={`/projects/${l.project_id}`}>{l.projects.address ?? l.projects.name}</Link>;
  const edit = (l: Lot) => <Link href={`/oyl/${l.id}`} className="small">Edit</Link>;

  return (
    <>
      <PageTitle href="/oyl">OYL lots</PageTitle>
      <p className="muted">
        On Your Lot lots, from Chad&apos;s OYL Tracker. Each lot is also a project, so it gets nearby-case alerts and
        satellite images. <Link href="/oyl/new">+ Add a lot</Link>
      </p>

      <div className="oyl-summary">
        {lotSummary(working).map((s) => (
          <div key={s.label} className="card">
            <strong>{s.count}</strong> <span className="muted small">lot{s.count === 1 ? "" : "s"} · {money(s.dollars)}</span>
            <div className="small">{s.label}</div>
          </div>
        ))}
        <div className="card">
          <strong>{closed.length}</strong> <span className="muted small">closed to customers</span>
          <div className="small">
            Avg {days(avg(closed.map((l) => daysAfterPurchase(l, l.flashed_on)))) || "—"} days to flash ·{" "}
            {days(avg(closed.map((l) => daysAfterPurchase(l, l.customer_purchased_on)))) || "—"} to customer purchase
          </div>
        </div>
      </div>

      <h2>Working lots</h2>
      <div className="table-wrap">
        <table className="oyl-table">
          <thead>
            <tr>
              <th>Property address</th><th>Municipality</th><th>Lot type</th><th>Diligence ends</th><th>Lombardo purchase</th>
              <th>Ownership</th><th>Sales status</th><th>Flashed sale</th><th>Customer purchased</th>
              <th className="num">Days to flash</th><th className="num">Days to customer</th>
              <th className="num">Acquisition</th><th className="num">Municipality</th><th className="num">ARB</th>
              <th className="num">Site cost</th><th className="num">Total</th><th>Civil engineer</th><th className="num">Contract price</th>
              <th>Sign</th><th>HOA contact</th><th>Phone</th><th>Largest home</th><th></th>
            </tr>
          </thead>
          <tbody>
            {working.map((l) => (
              <tr key={l.id}>
                <td className="nowrap">{address(l)}</td><td>{place(l)}</td><td>{l.lot_type}</td>
                <td className="nowrap">{d(l.projects.diligence_expires_on)}</td><td className="nowrap">{d(l.projects.closing_on)}</td>
                <td>{l.ownership}</td><td>{l.sales_status}</td>
                <td className="nowrap">{d(l.flashed_on)}</td><td className="nowrap">{d(l.customer_purchased_on)}</td>
                <td className="num">{days(daysAfterPurchase(l, l.flashed_on))}</td>
                <td className="num">{days(daysAfterPurchase(l, l.customer_purchased_on))}</td>
                <td className="num">{money(l.acquisition_price)}</td><td className="num">{money(l.municipality_cost)}</td>
                <td className="num">{money(l.arb_cost)}</td><td className="num">{money(l.site_cost)}</td>
                <td className="num"><strong>{money(lotTotal(l))}</strong></td><td>{l.civil_engineer}</td>
                <td className="num">{money(l.contract_price)}</td><td>{l.sign_status}</td>
                <td>{l.hoa_contact}</td><td className="nowrap">{l.hoa_phone}</td><td>{l.largest_home}</td><td>{edit(l)}</td>
              </tr>
            ))}
            {working.length === 0 && <tr><td colSpan={23} className="muted">No working lots. <Link href="/oyl/new">Add one</Link>.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Closed</h2>
      <div className="table-wrap">
        <table className="oyl-table">
          <thead>
            <tr>
              <th>Property address</th><th>Municipality</th><th>Lombardo purchase</th><th>Flashed sale</th>
              <th className="num">Days to flash</th><th>Customer lot closing</th><th className="num">Days to customer</th>
              <th className="num">Acquisition</th><th className="num">Site cost</th><th className="num">Total</th>
              <th className="num">Contract (flash) price</th><th className="num">JPP projection</th><th className="num">Final sales price</th>
              <th>Sign</th><th>HOA contact</th><th></th>
            </tr>
          </thead>
          <tbody>
            {closed.map((l) => (
              <tr key={l.id}>
                <td className="nowrap">{address(l)}</td><td>{place(l)}</td>
                <td className="nowrap">{d(l.projects.closing_on)}</td><td className="nowrap">{d(l.flashed_on)}</td>
                <td className="num">{days(daysAfterPurchase(l, l.flashed_on))}</td>
                <td className="nowrap">{d(l.customer_purchased_on)}</td>
                <td className="num">{days(daysAfterPurchase(l, l.customer_purchased_on))}</td>
                <td className="num">{money(l.acquisition_price)}</td><td className="num">{money(l.site_cost)}</td>
                <td className="num"><strong>{money(lotTotal(l))}</strong></td><td className="num">{money(l.contract_price)}</td>
                <td className="num">{money(l.jpp_projection)}</td><td className="num">{money(l.final_sale_price)}</td>
                <td>{l.sign_status}</td><td>{l.hoa_contact}</td><td>{edit(l)}</td>
              </tr>
            ))}
            {closed.length === 0 && <tr><td colSpan={16} className="muted">None yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="source">A lot moves to Closed when its ownership is Customer or its sales status is Customer Purchased. Total = acquisition + municipality + ARB + site cost, as in the sheet.</p>
    </>
  );
}
