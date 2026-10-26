-- OYL (On Your Lot) lots: Chad's "OYL Tracker" spreadsheet moved into the site (/oyl). One row per lot, each tied to a
-- project (stage 'oyl', or 'closed' once the customer has bought the lot), so the lot also gets a map point, nearby
-- cases and satellite images. Diligence end and Lombardo's purchase date live on the project (diligence_expires_on,
-- closing_on), as on dashboard cards. Chad's data was loaded with SQL, not here, to keep prices out of the repo.
create table if not exists public.oyl_lots (
  id bigint generated always as identity primary key,
  project_id bigint not null unique references public.projects(id) on delete cascade,
  lot_type text check (lot_type in ('Walkout', 'In-Grade', 'Lookout', 'TBD')),
  ownership text check (ownership in ('Pending', 'Lombardo', 'Customer', 'In Diligence')),
  sales_status text check (sales_status in ('Reserved', 'Flashed', 'Customer Purchased')),
  flashed_on date,
  customer_purchased_on date,
  acquisition_price numeric,
  municipality_cost numeric,
  arb_cost numeric,
  site_cost numeric,          -- "Site Cost Doug/Travis"
  civil_engineer text,
  contract_price numeric,     -- the home contract (the sheet's "Flash Price" on closed lots)
  jpp_projection numeric,
  final_sale_price numeric,
  sign_status text,
  hoa_contact text,
  hoa_phone text,
  largest_home text,
  updated_at timestamptz not null default now()
);

alter table public.oyl_lots enable row level security;
-- Same as projects for now: the site has no logins yet. Tighten with the rest when sign-in ships.
create policy "team_all_oyl_lots" on public.oyl_lots for all to authenticated using (true) with check (true);
create policy "public_all_oyl_lots" on public.oyl_lots for all to anon using (true) with check (true);
