-- 网站访问与阅读统计（在 Supabase SQL Editor 执行一次）
-- 作用：
-- 1) 保证文章阅读计数函数可用
-- 2) 新增按天访问统计，供管理后台可视化

alter table public.articles add column if not exists view_count bigint not null default 0;

create table if not exists public.site_daily_stats (
  day date primary key,
  total_visits bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.increment_article_view(article_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.articles
  set view_count = coalesce(view_count, 0) + 1
  where id = article_uuid;
end;
$$;

create or replace function public.track_site_visit()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.site_daily_stats(day, total_visits)
  values (current_date, 1)
  on conflict (day)
  do update set
    total_visits = public.site_daily_stats.total_visits + 1,
    updated_at = now();
end;
$$;

grant execute on function public.increment_article_view(uuid) to anon, authenticated;
grant execute on function public.track_site_visit() to anon, authenticated;
