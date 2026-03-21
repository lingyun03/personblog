-- TechBlog: global settings + storage setup
-- Run in Supabase SQL Editor (project owner role)

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- Everyone can read site settings
drop policy if exists "site_settings_select_all" on public.site_settings;
create policy "site_settings_select_all"
on public.site_settings
for select
to anon, authenticated
using (true);

-- Only admins can write site settings
drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write"
on public.site_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Shared asset bucket (public read)
insert into storage.buckets (id, name, public)
values ('blog-assets', 'blog-assets', true)
on conflict (id) do nothing;

-- Public read for all files in blog-assets
drop policy if exists "blog_assets_public_read" on storage.objects;
create policy "blog_assets_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'blog-assets');

-- Any authenticated user can upload article images
drop policy if exists "blog_assets_auth_upload" on storage.objects;
create policy "blog_assets_auth_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'blog-assets'
  and (storage.foldername(name))[1] = 'images'
);

-- Any authenticated user can update/delete their own image object
drop policy if exists "blog_assets_auth_update_delete" on storage.objects;
create policy "blog_assets_auth_update_delete"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'blog-assets'
  and owner = auth.uid()
)
with check (
  bucket_id = 'blog-assets'
  and owner = auth.uid()
);

drop policy if exists "blog_assets_auth_delete" on storage.objects;
create policy "blog_assets_auth_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'blog-assets'
  and owner = auth.uid()
);

-- Only admin can upload/update/delete background music under bgm/
drop policy if exists "blog_assets_admin_bgm_write" on storage.objects;
create policy "blog_assets_admin_bgm_write"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'blog-assets'
  and (storage.foldername(name))[1] = 'bgm'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
