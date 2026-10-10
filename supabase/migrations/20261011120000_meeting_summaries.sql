-- Meeting recordings and summaries (written from the YouTube auto-captions).
alter table public.meetings
  add column video_url text,
  add column summary text,            -- light markdown: "## " headings, "- " bullets, blank-line paragraphs
  add column summary_items jsonb,     -- [{item, request, result}] agenda outcomes
  add column summarized_on date;
create index meetings_video_idx on public.meetings (event_date desc) where video_url is not null;
