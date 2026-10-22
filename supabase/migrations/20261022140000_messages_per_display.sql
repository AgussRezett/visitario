-- =============================================================================
-- ANTES / DESPUÉS per display: when on, the activador gets one pair of messages for
-- each display added to the visit ({exhibiciones} names only that display).
-- The company decides; off by default.
-- =============================================================================
alter table public.company add column messages_per_display boolean not null default false;

comment on column public.company.messages_per_display is 'One ANTES / DESPUÉS message per display instead of one per visit.';

grant update (messages_per_display) on public.company to authenticated;
