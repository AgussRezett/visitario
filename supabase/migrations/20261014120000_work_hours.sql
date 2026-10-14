-- =============================================================================
-- Work hours: the company's usual schedule (9 to 14 by default) and, when someone
-- works different hours, their own. The team's day only counts inactivity inside it.
-- =============================================================================
alter table public.company
  add column shift_start time not null default '09:00',
  add column shift_end   time not null default '14:00',
  add constraint company_shift_check check (shift_start < shift_end);

alter table public.membership
  add column shift_start time,
  add column shift_end   time,
  add constraint membership_shift_check check ((shift_start is null) = (shift_end is null) and (shift_start is null or shift_start < shift_end));

comment on column public.membership.shift_start is 'Own schedule when it differs from the company''s; null = the company''s.';

grant update (shift_start, shift_end) on public.company to authenticated;
grant update (shift_start, shift_end) on public.membership to authenticated;
