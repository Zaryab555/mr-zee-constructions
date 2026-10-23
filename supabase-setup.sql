-- Mr. Zee Constructions: run ONCE in your Supabase project's SQL Editor.
-- Then create an Auth user in Dashboard > Authentication > Users.
-- Finally give ONLY that user's UUID admin rights using the last command below.
-- Do not expose Supabase secret/service_role keys on GitHub Pages.

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  location text not null default '' check (char_length(location) <= 80),
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 10 and 1500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists reviews_status_created_idx
  on public.customer_reviews (status, created_at desc);

create table if not exists public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 100),
  file_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists gallery_published_created_idx
  on public.gallery_media (published, created_at desc);

alter table public.site_admins enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.gallery_media enable row level security;

-- Authenticated visitors may only read their OWN site-admin entry.
revoke all on public.site_admins from anon, authenticated;
grant select on public.site_admins to authenticated;
create policy "Read your own site-admin membership"
  on public.site_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- Only approved reviews are public. New public reviews are always pending.
revoke all on public.customer_reviews from anon, authenticated;
grant select on public.customer_reviews to anon, authenticated;
grant insert (name, location, rating, comment) on public.customer_reviews to anon, authenticated;
grant update, delete on public.customer_reviews to authenticated;
create policy "Anyone reads approved reviews"
  on public.customer_reviews for select to anon, authenticated
  using (status = 'approved');
create policy "Admins read all reviews"
  on public.customer_reviews for select to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
create policy "Visitors submit pending reviews"
  on public.customer_reviews for insert to anon, authenticated
  with check (status = 'pending');
create policy "Admins moderate reviews"
  on public.customer_reviews for update to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
create policy "Admins delete reviews"
  on public.customer_reviews for delete to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())));

-- All visible gallery entries are publicly readable; only admins modify entries.
revoke all on public.gallery_media from anon, authenticated;
grant select on public.gallery_media to anon, authenticated;
grant insert, update, delete on public.gallery_media to authenticated;
create policy "Visitors see published gallery entries"
  on public.gallery_media for select to anon, authenticated using (published = true);
create policy "Admins see every gallery entry"
  on public.gallery_media for select to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
create policy "Admins add gallery entries"
  on public.gallery_media for insert to authenticated
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
create policy "Admins update gallery entries"
  on public.gallery_media for update to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.site_admins where user_id = (select auth.uid())));
create policy "Admins delete gallery entries"
  on public.gallery_media for delete to authenticated
  using (exists (select 1 from public.site_admins where user_id = (select auth.uid())));

-- Public downloads; ONLY admins may upload, list/manage or delete.
-- The public bucket means links to uploaded media are accessible to anyone.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Site admins upload media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] in ('photos','videos')
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );
create policy "Site admins read media metadata"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'site-media'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );
create policy "Site admins delete media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-media'
    and exists (select 1 from public.site_admins where user_id = (select auth.uid()))
  );

-- IMPORTANT: run this SEPARATELY after creating your admin user in Auth > Users:
-- insert into public.site_admins(user_id) values ('PASTE-YOUR-ADMIN-AUTH-USER-UUID');
