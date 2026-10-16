-- Dashboard drag-and-drop (Oct 16): a project's position within its stage column. Null sorts after ordered cards
-- (newest-updated first), so projects nobody has dragged keep the old order.
alter table public.projects add column if not exists board_order int;
