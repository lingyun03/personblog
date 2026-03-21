-- 文章阅读次数：在 Supabase SQL Editor 执行一次
-- 依赖已有 public.articles 表

alter table public.articles add column if not exists view_count bigint not null default 0;

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

grant execute on function public.increment_article_view(uuid) to anon, authenticated;
