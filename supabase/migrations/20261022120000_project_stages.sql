-- Suggestion #12 (Oct 13): project stages are Prospect, LOI, Diligence and Development, plus Closed for deals that
-- are dropped or finished (hidden from /projects unless "Show closed").
alter table public.projects drop constraint if exists projects_stage_check;
update public.projects set stage = case
  when stage = 'prospect' then 'prospect'
  when stage in ('due_diligence','pre_application','on_hold') then 'diligence'
  when stage in ('submitted','pz_hearing','governing_body','approved') then 'development'
  else 'closed' end
where stage not in ('prospect','loi','diligence','development','closed');
alter table public.projects add constraint projects_stage_check
  check (stage in ('prospect','loi','diligence','development','closed'));
