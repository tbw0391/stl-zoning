import { LOT_TYPES, OWNERSHIP, SALES_STATUS, type Lot } from "@/lib/oyl";

// Add / edit form for an OYL lot: the columns of Chad's sheet, grouped.
export default function LotForm({ action, lot, jurisdictions, submitLabel }: {
  action: (fd: FormData) => Promise<void>;
  lot?: Lot;
  jurisdictions: { id: string; name: string }[];
  submitLabel: string;
}) {
  const p = lot?.projects;
  const pick = (name: string, label: string, options: string[], value: string | null | undefined) => (
    <label>{label}
      <select name={name} defaultValue={value ?? ""}>
        <option value="">—</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
  const date = (name: string, label: string, value: string | null | undefined) => (
    <label>{label}<input type="date" name={name} defaultValue={value ?? ""} /></label>
  );
  const field = (name: string, label: string, value: string | number | null | undefined) => (
    <label>{label}<input name={name} defaultValue={value ?? ""} /></label>
  );
  const dollars = (name: string, label: string, value: number | null | undefined) => (
    <label>{label}<input name={name} inputMode="decimal" placeholder="$" defaultValue={value ?? ""} /></label>
  );

  return (
    <form action={action} className="card stack-form oyl-form">
      <fieldset>
        <legend>Lot</legend>
        <label>Property address<input name="address" required defaultValue={p?.address ?? ""} /></label>
        <label>Municipality
          <select name="jurisdiction_id" defaultValue={p?.jurisdiction_id ?? ""}>
            <option value="">—</option>
            {jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </label>
        {pick("lot_type", "Lot type", LOT_TYPES, lot?.lot_type)}
        {field("largest_home", "Largest home available", lot?.largest_home)}
      </fieldset>
      <fieldset>
        <legend>Dates and status</legend>
        {date("diligence_expires_on", "Diligence ends", p?.diligence_expires_on)}
        {date("closing_on", "Lombardo purchase date", p?.closing_on)}
        {pick("ownership", "Ownership", OWNERSHIP, lot?.ownership)}
        {pick("sales_status", "Sales status", SALES_STATUS, lot?.sales_status)}
        {date("flashed_on", "Flashed sale date", lot?.flashed_on)}
        {date("customer_purchased_on", "Customer purchased lot", lot?.customer_purchased_on)}
      </fieldset>
      <fieldset>
        <legend>Costs and prices</legend>
        {dollars("acquisition_price", "Acquisition price", lot?.acquisition_price)}
        {dollars("municipality_cost", "Municipality", lot?.municipality_cost)}
        {dollars("arb_cost", "ARB", lot?.arb_cost)}
        {dollars("site_cost", "Site cost (Doug/Travis)", lot?.site_cost)}
        {dollars("contract_price", "Contract price", lot?.contract_price)}
        {dollars("jpp_projection", "JPP projection", lot?.jpp_projection)}
        {dollars("final_sale_price", "Final sales price", lot?.final_sale_price)}
        {field("civil_engineer", "Civil engineer", lot?.civil_engineer)}
      </fieldset>
      <fieldset>
        <legend>Sign and HOA</legend>
        {field("sign_status", "Sign status", lot?.sign_status)}
        {field("hoa_contact", "HOA contact", lot?.hoa_contact)}
        {field("hoa_phone", "HOA phone", lot?.hoa_phone)}
      </fieldset>
      <div><button type="submit">{submitLabel}</button></div>
    </form>
  );
}
