-- One row per member per named vote in meetings.votes (from extract-votes), with the member matched to the
-- directory: same jurisdiction and same last name, used only when exactly one person in that jurisdiction has it.

-- "Councilmember Saettele", "Vice Chair Jane Doe Jr." -> "Saettele", "Jane Doe".
create or replace function public.vote_member_name(n text) returns text
language sql immutable as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(trim(n),
        '^((council ?(member|man|woman|person)|alder(man|woman|person|men)|commissioner|board member|trustee|' ||
        '(vice[- ])?chair(man|woman|person)?|mayor( pro tem)?|president|presiding officer|mr|mrs|ms|dr)\.?\s+)+', '', 'i'),
      ',?\s+(jr|sr|ii|iii|iv)\.?$', '', 'i'),
    '\s+', ' ', 'g'))
$$;

-- Last name, lowercased letters only: the match key.
create or replace function public.vote_member_key(n text) returns text
language sql immutable as $$
  select lower(regexp_replace(regexp_replace(public.vote_member_name(n), '^.*\s', ''), '[^A-Za-z]', '', 'g'))
$$;

create or replace view public.member_votes with (security_invoker = true) as
select m.id as meeting_id, j.id as jurisdiction_id, j.name as jurisdiction_name, j.county, m.body, m.event_date,
       (v.ord - 1)::int as vote_idx, v.x->>'item' as item, v.x->>'case_number' as case_number, v.x->>'motion' as motion,
       v.x->>'result' as result, public.vote_member_name(r.x->>'name') as member_name,
       public.vote_member_key(r.x->>'name') as member_key, r.x->>'vote' as vote,
       p.person_id, pp.full_name as person_name, (r.ord - 1)::int as roll_idx
from public.meetings m
join public.jurisdictions j on j.id = m.jurisdiction_id
cross join lateral jsonb_array_elements(m.votes->'votes') with ordinality as v(x, ord)
cross join lateral jsonb_array_elements(v.x->'roll_call') with ordinality as r(x, ord)
left join lateral (
  select case when count(*) = 1 then min(p.id) end as person_id
  from public.people p
  where p.jurisdiction_id = m.jurisdiction_id and public.vote_member_key(p.full_name) = public.vote_member_key(r.x->>'name')
) p on true
left join public.people pp on pp.id = p.person_id
where jsonb_typeof(m.votes->'votes') = 'array' and jsonb_typeof(v.x->'roll_call') = 'array';
grant select on public.member_votes to anon, authenticated;
