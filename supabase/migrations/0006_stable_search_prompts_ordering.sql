-- DevAtlas — Phase 1: fix unstable pagination in search_prompts().
--
-- `order by p.created_at desc` alone has no tiebreaker. Postgres does not
-- guarantee a stable row order for ties, so two calls with different
-- p_offset values can return the same row twice (a duplicate) or skip a
-- row entirely (a gap) whenever multiple rows share a created_at value —
-- exactly what happened here: the 48 seed prompts were inserted in 4
-- batches, and every row within a batch shares the exact same
-- transaction-scoped now(), producing 4 groups of 12 identical timestamps.
-- Surfaced by the browse page's infinite-scroll pagination as a React
-- "two children with the same key" crash on prompt id.
--
-- `id` (a uuid) is unique per row, so appending it as a secondary sort key
-- makes the ordering — and therefore LIMIT/OFFSET pagination — fully
-- deterministic, regardless of how many rows share a created_at.

create or replace function public.search_prompts(
  p_category prompt_category default null,
  p_tags text[] default null,
  p_query text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns setof prompts
language sql
stable
set search_path = public
as $$
  select p.*
  from public.prompts p
  where (p_category is null or p.category = p_category)
    and (
      p_tags is null or array_length(p_tags, 1) is null or exists (
        select 1 from public.prompt_tags pt
        join public.tags t on t.id = pt.tag_id
        where pt.prompt_id = p.id and t.slug = any(p_tags)
      )
    )
    and (
      p_query is null or p_query = '' or
      to_tsvector('english', p.title || ' ' || p.description || ' ' || p.base_instructions)
        @@ websearch_to_tsquery('english', p_query)
      or p.title ilike '%' || p_query || '%'
    )
  order by p.created_at desc, p.id
  limit p_limit offset p_offset;
$$;
