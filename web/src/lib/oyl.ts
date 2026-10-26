// OYL (On Your Lot) lots, from Chad's "OYL Tracker" spreadsheet (/oyl). Each lot is a project; the project holds the
// address, municipality, diligence end and Lombardo's purchase date, oyl_lots the rest.
export const LOT_TYPES = ["Walkout", "In-Grade", "Lookout", "TBD"];
export const OWNERSHIP = ["Pending", "Lombardo", "Customer", "In Diligence"];
export const SALES_STATUS = ["Reserved", "Flashed", "Customer Purchased"];

export const MONEY_FIELDS = ["acquisition_price", "municipality_cost", "arb_cost", "site_cost", "contract_price", "jpp_projection", "final_sale_price"] as const;
export const TEXT_FIELDS = ["lot_type", "ownership", "sales_status", "civil_engineer", "sign_status", "hoa_contact", "hoa_phone", "largest_home"] as const;
export const DATE_FIELDS = ["flashed_on", "customer_purchased_on"] as const;

export type Lot = {
  id: number;
  project_id: number;
  lot_type: string | null;
  ownership: string | null;
  sales_status: string | null;
  flashed_on: string | null;
  customer_purchased_on: string | null;
  acquisition_price: number | null;
  municipality_cost: number | null;
  arb_cost: number | null;
  site_cost: number | null;
  civil_engineer: string | null;
  contract_price: number | null;
  jpp_projection: number | null;
  final_sale_price: number | null;
  sign_status: string | null;
  hoa_contact: string | null;
  hoa_phone: string | null;
  largest_home: string | null;
  projects: {
    id: number; name: string; address: string | null; jurisdiction_id: string | null; stage: string;
    diligence_expires_on: string | null; closing_on: string | null; jurisdictions: { name: string } | null;
  };
};

export const LOT_SELECT = "*, projects!inner(id, name, address, jurisdiction_id, stage, diligence_expires_on, closing_on, jurisdictions(name))";

// The sheet's Total: acquisition + municipality + ARB + site cost.
export const lotTotal = (l: Lot) =>
  (l.acquisition_price ?? 0) + (l.municipality_cost ?? 0) + (l.arb_cost ?? 0) + (l.site_cost ?? 0);

const dayNum = (d: string) => new Date(d + "T00:00:00Z").getTime() / 864e5;
// Days from Lombardo's purchase to a later date (the sheet's "Days until Flashed" / "Days until Customer Purchase").
export const daysAfterPurchase = (l: Lot, d: string | null) =>
  d && l.projects.closing_on ? Math.round(dayNum(d) - dayNum(l.projects.closing_on)) : null;

export const isClosed = (l: Lot) => l.ownership === "Customer" || l.sales_status === "Customer Purchased";

export const money = (n: number | null) =>
  n == null ? "" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// "$412,500" / "412500" / "none" → number or null.
export function parseMoney(v: FormDataEntryValue | null) {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  return s && !Number.isNaN(Number(s)) ? Number(s) : null;
}

// The sheet's lot-count box, with each line's purchase dollars.
export function lotSummary(lots: Lot[]) {
  const line = (label: string, pick: (l: Lot) => boolean) => {
    const ls = lots.filter(pick);
    return { label, count: ls.length, dollars: ls.reduce((s, l) => s + (l.acquisition_price ?? 0), 0) };
  };
  const hasBuyer = (l: Lot) => l.sales_status === "Flashed" || l.sales_status === "Reserved";
  return [
    line("Lombardo owns", (l) => l.ownership === "Lombardo"),
    line("Owned, customer has flashed or reserved", (l) => l.ownership === "Lombardo" && hasBuyer(l)),
    line("Owned, no buyer yet", (l) => l.ownership === "Lombardo" && !hasBuyer(l)),
    line("Under contract to purchase (pending or in diligence)", (l) => l.ownership === "Pending" || l.ownership === "In Diligence"),
  ];
}
