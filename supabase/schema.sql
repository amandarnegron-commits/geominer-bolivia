-- Versión futura (fase 2). Ejecútese solamente después de crear el proyecto en la cuenta autorizada.
-- Política: cada usuario autenticado ve y modifica solamente sus propias áreas.
create table if not exists public.study_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  bbox jsonb not null check (jsonb_typeof(bbox) = 'array' and jsonb_array_length(bbox) = 4),
  area_km2 numeric(12,2) not null check (area_km2 > 0 and area_km2 <= 2500),
  created_at timestamptz not null default now()
);
create index if not exists study_areas_user_created_idx on public.study_areas (user_id,created_at desc);
alter table public.study_areas enable row level security;
revoke all on public.study_areas from anon;
grant select,insert,update,delete on public.study_areas to authenticated;
drop policy if exists "owner_select" on public.study_areas;
drop policy if exists "owner_insert" on public.study_areas;
drop policy if exists "owner_update" on public.study_areas;
drop policy if exists "owner_delete" on public.study_areas;
create policy "owner_select" on public.study_areas for select to authenticated using ((select auth.uid()) = user_id);
create policy "owner_insert" on public.study_areas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "owner_update" on public.study_areas for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner_delete" on public.study_areas for delete to authenticated using ((select auth.uid()) = user_id);
-- No introducir claves OpenAI en la base de datos pública, frontend ni GitHub.
