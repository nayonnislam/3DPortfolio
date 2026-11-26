create table if not exists public.portfolio_projects (
  id text primary key,
  title text not null check (char_length(title) between 1 and 80),
  category text not null default 'eyewear',
  description text not null default '' check (char_length(description) <= 500),
  cover text not null default '',
  gallery text[] not null default '{}',
  details text[] not null default '{}',
  model text not null default '',
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(gallery) <= 20),
  check (cardinality(details) <= 30)
);

alter table public.portfolio_projects
  add column if not exists category text not null default 'eyewear';

alter table public.portfolio_projects
  drop constraint if exists portfolio_projects_category_check;

alter table public.portfolio_projects
  add constraint portfolio_projects_category_check
  check (category in ('eyewear', 'product', 'character', '2d'));

alter table public.portfolio_projects enable row level security;

drop policy if exists "Anyone can view portfolio projects" on public.portfolio_projects;
create policy "Anyone can view portfolio projects"
  on public.portfolio_projects
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert portfolio projects" on public.portfolio_projects;
create policy "Admins can insert portfolio projects"
  on public.portfolio_projects
  for insert
  to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update portfolio projects" on public.portfolio_projects;
create policy "Admins can update portfolio projects"
  on public.portfolio_projects
  for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete portfolio projects" on public.portfolio_projects;
create policy "Admins can delete portfolio projects"
  on public.portfolio_projects
  for delete
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.portfolio_projects to anon, authenticated;
grant insert, update, delete on public.portfolio_projects to authenticated;
grant usage on schema public to anon, authenticated;

create table if not exists public.portfolio_site_settings (
  id integer primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_site_settings enable row level security;

drop policy if exists "Anyone can view portfolio site settings" on public.portfolio_site_settings;
create policy "Anyone can view portfolio site settings"
  on public.portfolio_site_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert portfolio site settings" on public.portfolio_site_settings;
create policy "Admins can insert portfolio site settings"
  on public.portfolio_site_settings
  for insert
  to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update portfolio site settings" on public.portfolio_site_settings;
create policy "Admins can update portfolio site settings"
  on public.portfolio_site_settings
  for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.portfolio_site_settings to anon, authenticated;
grant insert, update on public.portfolio_site_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio',
  'portfolio',
  true,
  26214400,
  array['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp', 'model/gltf-binary', 'application/octet-stream']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view portfolio media" on storage.objects;
create policy "Anyone can view portfolio media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "Admins can upload portfolio media" on storage.objects;
create policy "Admins can upload portfolio media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'portfolio'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can update portfolio media" on storage.objects;
create policy "Admins can update portfolio media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'portfolio'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'portfolio'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can delete portfolio media" on storage.objects;
create policy "Admins can delete portfolio media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'portfolio'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
