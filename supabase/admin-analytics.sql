-- ============================================================================
-- 휴가요정 관리자 분석 스키마
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하세요. (여러 번 실행해도 안전)
--
-- 설계 원칙
--   1. 개인정보를 저장하지 않는다. visitor_id 는 브라우저가 만든 랜덤 UUID 뿐이다.
--      이름·이메일·전화번호·IP·정확한 위치·fingerprint 는 어떤 컬럼에도 담지 않는다.
--   2. 권한은 프론트엔드가 아니라 DB 가 판단한다. anon 키는 공개돼 있으므로
--      RLS 를 통과하지 못하면 개발자도구로 호출해도 한 줄도 못 읽는다.
--   3. 집계는 서버에서 한다. 브라우저로 raw 데이터를 내려받지 않는다.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. profiles : 관리자 여부를 담는 유일한 근거
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 가입하면 프로필이 자동으로 생긴다. role 은 항상 'user' 로 시작한다.
-- (관리자 승격은 SQL Editor 에서 수동으로만 가능 → 셀프 승격 경로가 없다)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입돼 있던 사용자들의 프로필을 채운다(스키마를 나중에 적용한 경우).
insert into public.profiles (id, email, role)
select u.id, u.email, 'user' from auth.users u
on conflict (id) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. is_admin() : 모든 관리자 권한 판단의 단일 출처
--
--    security definer 로 만드는 이유가 중요하다.
--    profiles 의 RLS 정책 안에서 profiles 를 다시 조회하면 무한 재귀가 난다.
--    definer 는 RLS 를 우회하므로 재귀 없이 role 만 확인할 수 있다.
--    search_path 를 고정해 검색 경로 하이재킹도 막는다.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$fn$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- profiles RLS : 본인 행만 읽는다. 관리자는 전체를 읽는다.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- ⚠️ UPDATE/INSERT/DELETE 정책을 일부러 만들지 않는다.
--    정책이 없으면 RLS 가 전부 거부하므로, 사용자가 자기 role 을
--    'admin' 으로 바꾸는 경로 자체가 존재하지 않는다.
--    관리자 승격은 SQL Editor(service_role) 에서만 가능하다.


-- ────────────────────────────────────────────────────────────────────────────
-- 3. analytics_events : 익명 이용 통계
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id             uuid primary key default gen_random_uuid(),
  visitor_id     text not null,
  session_id     text not null,
  event_name     text not null,
  page_path      text,
  target_year    integer,
  leave_days     numeric(5, 1),
  vacation_style text,
  result_days    numeric(5, 1),
  referrer       text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  device_type    text,
  -- 이벤트마다 다른 부가 정보(공유 채널, 제휴 제공사 등)를 담는 자유 필드.
  -- 컬럼을 계속 늘리지 않고 확장하기 위한 자리다. 개인정보는 넣지 않는다.
  props          jsonb,
  created_at     timestamptz not null default now(),

  -- ── 쓰레기 데이터 방어 (RLS INSERT 정책과 함께 동작) ──
  constraint analytics_visitor_len  check (char_length(visitor_id) between 8 and 64),
  constraint analytics_session_len  check (char_length(session_id) between 8 and 64),
  constraint analytics_event_len    check (char_length(event_name) between 1 and 48),
  constraint analytics_path_len     check (page_path is null or char_length(page_path) <= 256),
  constraint analytics_referrer_len check (referrer is null or char_length(referrer) <= 256),
  constraint analytics_utm_len      check (
    (utm_source   is null or char_length(utm_source)   <= 64) and
    (utm_medium   is null or char_length(utm_medium)   <= 64) and
    (utm_campaign is null or char_length(utm_campaign) <= 64)
  ),
  constraint analytics_style_len    check (vacation_style is null or char_length(vacation_style) <= 32),
  constraint analytics_device       check (device_type is null or device_type in ('mobile','tablet','desktop')),
  constraint analytics_year_range   check (target_year is null or target_year between 2000 and 2100),
  constraint analytics_leave_range  check (leave_days  is null or leave_days  between 0 and 400),
  constraint analytics_result_range check (result_days is null or result_days between 0 and 400),
  -- jsonb→text 캐스트는 IMMUTABLE 이라 CHECK 에서 쓸 수 있다
  -- (pg_column_size 는 STABLE 이어서 CHECK 제약에 넣으면 거부된다).
  constraint analytics_props_size   check (props is null or char_length(props::text) <= 2048)
);

-- 수십만 건을 전제로 한 인덱스.
-- 모든 집계가 기간으로 먼저 자르므로 created_at 을 앞에 두는 복합 인덱스가 효율적이다.
create index if not exists analytics_created_at_idx     on public.analytics_events (created_at desc);
create index if not exists analytics_event_created_idx  on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_visitor_idx        on public.analytics_events (visitor_id, created_at desc);
create index if not exists analytics_session_idx        on public.analytics_events (session_id);
create index if not exists analytics_year_idx           on public.analytics_events (target_year, created_at desc)
  where target_year is not null;
create index if not exists analytics_path_idx           on public.analytics_events (page_path, created_at desc)
  where page_path is not null;
create index if not exists analytics_source_idx         on public.analytics_events (utm_source, created_at desc)
  where utm_source is not null;

alter table public.analytics_events enable row level security;

-- 익명 방문자도 이벤트를 남길 수 있어야 한다(가입 없이 쓰는 서비스이므로).
-- 단 "지금 시각으로, 알려진 이벤트 이름만" 넣을 수 있다.
-- created_at 을 조작해 과거·미래 데이터를 심는 것을 막는다.
drop policy if exists "analytics_insert_anyone" on public.analytics_events;
create policy "analytics_insert_anyone"
  on public.analytics_events for insert
  to anon, authenticated
  with check (
    created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
    and event_name in (
      'page_view', 'session_start',
      'simulation_start', 'simulation_complete', 'retry_simulation',
      'year_select', 'leave_input', 'vacation_style_select', 'result_view',
      'share_click', 'share_kakao', 'share_link', 'share_image',
      'save_combination', 'company_policy_save',
      'affiliate_click', 'ad_impression', 'ad_click'
    )
  );

-- ⚠️ 핵심: SELECT 정책은 관리자에게만 준다.
--    일반 사용자는 자기가 넣은 행조차 다시 읽을 수 없다
--    (visitor_id 는 브라우저에 있으므로, 읽기를 열면 남의 id 를 넣어 조회할 수 있다).
drop policy if exists "analytics_select_admin_only" on public.analytics_events;
create policy "analytics_select_admin_only"
  on public.analytics_events for select
  to authenticated
  using (public.is_admin());

-- UPDATE/DELETE 정책 없음 → 아무도 기록을 고치거나 지울 수 없다(감사 무결성).


-- ────────────────────────────────────────────────────────────────────────────
-- 4. 집계 함수 (RPC)
--
--    브라우저는 raw 행을 받지 않는다. 집계된 결과만 받는다.
--    모든 함수는 security definer 이므로 첫 줄에서 반드시 관리자인지 확인한다.
-- ────────────────────────────────────────────────────────────────────────────

-- 관리자가 아니면 즉시 중단. 모든 RPC 의 첫 줄에서 호출한다.
create or replace function public.admin_guard()
returns void
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$fn$;

revoke all on function public.admin_guard() from public;
grant execute on function public.admin_guard() to authenticated;


-- 기간 방어: 너무 넓은 구간을 요청해 DB 를 갈아넣지 못하게 상한을 둔다.
create or replace function public.admin_clamp_range(p_from timestamptz, p_to timestamptz)
returns tstzrange
language sql
-- now() 를 쓰므로 immutable 이 아니라 stable 이어야 한다.
-- immutable 로 두면 플래너가 결과를 상수로 접어 기간이 갱신되지 않는다.
stable
as $fn$
  select tstzrange(
    greatest(coalesce(p_from, now() - interval '30 days'), now() - interval '3 years'),
    least(coalesce(p_to, now()), now() + interval '1 day'),
    '[]'
  );
$fn$;


-- ── 4-1. KPI 요약 ──────────────────────────────────────────────────────────
create or replace function public.admin_kpi_summary(p_from timestamptz, p_to timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  r tstzrange;
  result json;
begin
  perform public.admin_guard();
  r := public.admin_clamp_range(p_from, p_to);

  select json_build_object(
    'visitors',         count(distinct visitor_id),
    'page_views',       count(*) filter (where event_name = 'page_view'),
    'sessions',         count(distinct session_id),
    'sim_started',      count(distinct visitor_id) filter (where event_name = 'simulation_start'),
    'sim_completed',    count(distinct visitor_id) filter (where event_name = 'simulation_complete'),
    'shares',           count(*) filter (where event_name like 'share%'),
    'share_visitors',   count(distinct visitor_id) filter (where event_name like 'share%'),
    'affiliate_clicks', count(*) filter (where event_name = 'affiliate_click')
  )
  into result
  from public.analytics_events
  where created_at <@ r;

  return result;
end;
$fn$;


-- ── 4-2. 일별 추세 ─────────────────────────────────────────────────────────
create or replace function public.admin_daily_trend(p_from timestamptz, p_to timestamptz)
returns table (
  day            date,
  visitors       bigint,
  page_views     bigint,
  sim_completed  bigint,
  shares         bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare r tstzrange;
begin
  perform public.admin_guard();
  r := public.admin_clamp_range(p_from, p_to);

  -- 이벤트가 없는 날도 0 으로 채워야 그래프가 끊기지 않는다.
  return query
  select
    d::date,
    count(distinct e.visitor_id),
    count(e.id) filter (where e.event_name = 'page_view'),
    count(distinct e.visitor_id) filter (where e.event_name = 'simulation_complete'),
    count(e.id) filter (where e.event_name like 'share%')
  from generate_series(
         date_trunc('day', lower(r)),
         date_trunc('day', upper(r)),
         interval '1 day'
       ) d
  left join public.analytics_events e
    on e.created_at >= d and e.created_at < d + interval '1 day' and e.created_at <@ r
  group by d
  order by d;
end;
$fn$;


-- ── 4-3. 휴가 시뮬레이션 분석 ──────────────────────────────────────────────
create or replace function public.admin_vacation_analysis(p_from timestamptz, p_to timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  r tstzrange;
  result json;
begin
  perform public.admin_guard();
  r := public.admin_clamp_range(p_from, p_to);

  select json_build_object(
    -- 연도별 시뮬레이션 비중
    'by_year', (
      select coalesce(json_agg(x order by x.target_year), '[]'::json) from (
        select target_year, count(*) as count, count(distinct visitor_id) as visitors
        from public.analytics_events
        where created_at <@ r and target_year is not null
          and event_name in ('simulation_complete', 'year_select')
        group by target_year
      ) x
    ),
    -- 입력 연차 분포
    'leave_buckets', (
      select coalesce(json_agg(x order by x.sort_key), '[]'::json) from (
        select
          case
            when leave_days <=  5 then '0~5일'
            when leave_days <= 10 then '6~10일'
            when leave_days <= 15 then '11~15일'
            when leave_days <= 20 then '16~20일'
            else '21일 이상'
          end as bucket,
          case
            when leave_days <=  5 then 1 when leave_days <= 10 then 2
            when leave_days <= 15 then 3 when leave_days <= 20 then 4 else 5
          end as sort_key,
          count(*) as count
        from public.analytics_events
        where created_at <@ r and leave_days is not null
          and event_name in ('leave_input', 'simulation_complete')
        group by bucket, sort_key
      ) x
    ),
    'avg_leave_days', (
      select round(avg(leave_days)::numeric, 1)
      from public.analytics_events
      where created_at <@ r and leave_days is not null
        and event_name in ('leave_input', 'simulation_complete')
    ),
    'avg_result_days', (
      select round(avg(result_days)::numeric, 1)
      from public.analytics_events
      where created_at <@ r and result_days is not null and event_name = 'simulation_complete'
    ),
    'avg_efficiency', (
      select round(avg(result_days / nullif(leave_days, 0))::numeric, 2)
      from public.analytics_events
      where created_at <@ r and event_name = 'simulation_complete'
        and result_days is not null and leave_days > 0
    ),
    -- 휴가 스타일(전략) 선호도
    'styles', (
      select coalesce(json_agg(x order by x.count desc), '[]'::json) from (
        select vacation_style as style, count(*) as count
        from public.analytics_events
        where created_at <@ r and vacation_style is not null
          and event_name in ('vacation_style_select', 'simulation_complete')
        group by vacation_style
      ) x
    ),
    -- 인기 추천 조합 TOP 10 : "연차 3일 → 9일 휴식"
    'top_combos', (
      select coalesce(json_agg(x order by x.count desc), '[]'::json) from (
        select leave_days, result_days, count(*) as count
        from public.analytics_events
        where created_at <@ r and event_name = 'simulation_complete'
          and leave_days is not null and result_days is not null
        group by leave_days, result_days
        order by count(*) desc
        limit 10
      ) x
    )
  ) into result;

  return result;
end;
$fn$;


-- ── 4-4. 유입 분석 ─────────────────────────────────────────────────────────
--    referrer 호스트와 UTM 을 사람이 읽는 채널명으로 정규화한다.
create or replace function public.admin_traffic_sources(p_from timestamptz, p_to timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  r tstzrange;
  result json;
begin
  perform public.admin_guard();
  r := public.admin_clamp_range(p_from, p_to);

  return (
    with first_touch as (
      -- 방문자마다 첫 유입만 센다(같은 사람이 여러 번 와도 채널 비중이 왜곡되지 않게).
      select distinct on (visitor_id)
        visitor_id, referrer, utm_source, utm_medium, utm_campaign
      from public.analytics_events
      where created_at <@ r
      order by visitor_id, created_at
    ),
    labelled as (
      select
        visitor_id,
        case
          when utm_source is not null then initcap(utm_source)
          when referrer is null or referrer = '' then 'Direct'
          when referrer ilike '%google%'    then 'Google'
          when referrer ilike '%naver%'     then 'Naver'
          when referrer ilike '%daum%'      then 'Daum'
          when referrer ilike '%kakao%'     then 'Kakao'
          when referrer ilike '%instagram%' then 'Instagram'
          when referrer ilike '%facebook%'  then 'Facebook'
          when referrer ilike '%youtube%'   then 'YouTube'
          when referrer ilike '%tistory%' or referrer ilike '%blog%' then 'Blog'
          when referrer ilike '%bing%'      then 'Bing'
          else '기타'
        end as channel,
        utm_source, utm_medium, utm_campaign
      from first_touch
    )
    select json_build_object(
      'channels', (
        select coalesce(json_agg(x order by x.visitors desc), '[]'::json) from (
          select channel, count(distinct visitor_id) as visitors from labelled group by channel
        ) x
      ),
      'utm_sources', (
        select coalesce(json_agg(x order by x.visitors desc), '[]'::json) from (
          select utm_source as source, count(distinct visitor_id) as visitors
          from labelled where utm_source is not null group by utm_source limit 20
        ) x
      ),
      'utm_mediums', (
        select coalesce(json_agg(x order by x.visitors desc), '[]'::json) from (
          select utm_medium as medium, count(distinct visitor_id) as visitors
          from labelled where utm_medium is not null group by utm_medium limit 20
        ) x
      ),
      'utm_campaigns', (
        select coalesce(json_agg(x order by x.visitors desc), '[]'::json) from (
          select utm_campaign as campaign, count(distinct visitor_id) as visitors
          from labelled where utm_campaign is not null group by utm_campaign limit 20
        ) x
      ),
      'total_visitors', (select count(distinct visitor_id) from labelled)
    )
  );
end;
$fn$;


-- ── 4-5. 인기 페이지 ───────────────────────────────────────────────────────
--    page_path 기준으로 자동 집계한다. URL 을 코드에 하드코딩하지 않으므로
--    /2027-seollal 같은 SEO 페이지를 나중에 추가해도 그대로 잡힌다.
create or replace function public.admin_top_pages(
  p_from timestamptz, p_to timestamptz, p_limit integer default 10
)
returns table (page_path text, page_views bigint, visitors bigint)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare r tstzrange;
begin
  perform public.admin_guard();
  r := public.admin_clamp_range(p_from, p_to);

  return query
  select e.page_path, count(*), count(distinct e.visitor_id)
  from public.analytics_events e
  where e.created_at <@ r and e.event_name = 'page_view' and e.page_path is not null
  group by e.page_path
  order by count(*) desc
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
end;
$fn$;


-- ── 4-6. 공유 분석 ─────────────────────────────────────────────────────────
create or replace function public.admin_share_analysis(p_from timestamptz, p_to timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  r tstzrange;
  result json;
begin
  perform public.admin_guard();
  r := public.admin_clamp_range(p_from, p_to);

  select json_build_object(
    'total',          (select count(*) from public.analytics_events
                       where created_at <@ r and event_name like 'share%'),
    'by_channel', (
      select coalesce(json_agg(x order by x.count desc), '[]'::json) from (
        select event_name as channel, count(*) as count
        from public.analytics_events
        where created_at <@ r and event_name like 'share%'
        group by event_name
      ) x
    ),
    'share_visitors', (select count(distinct visitor_id) from public.analytics_events
                       where created_at <@ r and event_name like 'share%'),
    'complete_visitors', (select count(distinct visitor_id) from public.analytics_events
                          where created_at <@ r and event_name = 'simulation_complete'),
    'by_year', (
      select coalesce(json_agg(x order by x.count desc), '[]'::json) from (
        select target_year, count(*) as count
        from public.analytics_events
        where created_at <@ r and event_name like 'share%' and target_year is not null
        group by target_year
      ) x
    ),
    'top_shared_results', (
      select coalesce(json_agg(x order by x.count desc), '[]'::json) from (
        select leave_days, result_days, count(*) as count
        from public.analytics_events
        where created_at <@ r and event_name like 'share%'
          and leave_days is not null and result_days is not null
        group by leave_days, result_days
        order by count(*) desc
        limit 10
      ) x
    )
  ) into result;

  return result;
end;
$fn$;


-- ── 4-7. 퍼널 ──────────────────────────────────────────────────────────────
--    각 단계는 "그 단계에 도달한 고유 방문자 수"다.
create or replace function public.admin_funnel(p_from timestamptz, p_to timestamptz)
returns table (step_order integer, step_name text, visitors bigint)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare r tstzrange;
begin
  perform public.admin_guard();
  r := public.admin_clamp_range(p_from, p_to);

  return query
  with e as (select * from public.analytics_events where created_at <@ r)
  select 1, '사이트 방문'::text, (select count(distinct visitor_id) from e)
  union all
  select 2, '연차 입력'::text, (select count(distinct visitor_id) from e where event_name = 'leave_input')
  union all
  select 3, '계산 시작'::text, (select count(distinct visitor_id) from e where event_name = 'simulation_start')
  union all
  select 4, '결과 확인'::text, (select count(distinct visitor_id) from e
                            where event_name in ('simulation_complete', 'result_view'))
  union all
  select 5, '공유'::text, (select count(distinct visitor_id) from e where event_name like 'share%')
  order by 1;
end;
$fn$;


-- ── 4-8. 오늘 현황 (실시간 카드용, 가볍게) ─────────────────────────────────
create or replace function public.admin_today_snapshot()
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare result json;
begin
  perform public.admin_guard();

  select json_build_object(
    'visitors',      count(distinct visitor_id),
    'page_views',    count(*) filter (where event_name = 'page_view'),
    'sim_completed', count(distinct visitor_id) filter (where event_name = 'simulation_complete'),
    'shares',        count(*) filter (where event_name like 'share%'),
    'last_event_at', max(created_at)
  ) into result
  from public.analytics_events
  where created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');

  return result;
end;
$fn$;


-- ── 4-9. 수익화 (광고·제휴) ────────────────────────────────────────────────
create or replace function public.admin_monetization(p_from timestamptz, p_to timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  r tstzrange;
  result json;
begin
  perform public.admin_guard();
  r := public.admin_clamp_range(p_from, p_to);

  select json_build_object(
    'ad_impressions', (select count(*) from public.analytics_events
                       where created_at <@ r and event_name = 'ad_impression'),
    'ad_clicks',      (select count(*) from public.analytics_events
                       where created_at <@ r and event_name = 'ad_click'),
    'affiliate_clicks', (select count(*) from public.analytics_events
                         where created_at <@ r and event_name = 'affiliate_click'),
    'affiliate_by_type', (
      select coalesce(json_agg(x order by x.count desc), '[]'::json) from (
        select coalesce(props->>'type', '기타') as type, count(*) as count
        from public.analytics_events
        where created_at <@ r and event_name = 'affiliate_click'
        group by props->>'type'
      ) x
    ),
    'affiliate_by_provider', (
      select coalesce(json_agg(x order by x.count desc), '[]'::json) from (
        select coalesce(props->>'provider', '기타') as provider, count(*) as count
        from public.analytics_events
        where created_at <@ r and event_name = 'affiliate_click'
        group by props->>'provider'
        limit 20
      ) x
    )
  ) into result;

  return result;
end;
$fn$;


-- ── 4-10. 시스템 상태 ──────────────────────────────────────────────────────
create or replace function public.admin_system_status()
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare result json;
begin
  perform public.admin_guard();

  select json_build_object(
    'total_events',   (select count(*) from public.analytics_events),
    'oldest_event',   (select min(created_at) from public.analytics_events),
    'newest_event',   (select max(created_at) from public.analytics_events),
    'total_visitors', (select count(distinct visitor_id) from public.analytics_events),
    'admin_count',    (select count(*) from public.profiles where role = 'admin'),
    'user_count',     (select count(*) from public.profiles),
    'table_size',     pg_size_pretty(pg_total_relation_size('public.analytics_events')),
    'events_24h',     (select count(*) from public.analytics_events
                       where created_at >= now() - interval '24 hours'),
    'event_names', (
      select coalesce(json_agg(x order by x.count desc), '[]'::json) from (
        select event_name, count(*) as count
        from public.analytics_events
        where created_at >= now() - interval '30 days'
        group by event_name
      ) x
    )
  ) into result;

  return result;
end;
$fn$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. 실행 권한
--    함수 안에서 admin_guard() 가 다시 막으므로, 실행 권한만으로는
--    관리자가 아닌 사람이 데이터를 얻을 수 없다.
-- ────────────────────────────────────────────────────────────────────────────
revoke all on function
  public.admin_kpi_summary(timestamptz, timestamptz),
  public.admin_daily_trend(timestamptz, timestamptz),
  public.admin_vacation_analysis(timestamptz, timestamptz),
  public.admin_traffic_sources(timestamptz, timestamptz),
  public.admin_top_pages(timestamptz, timestamptz, integer),
  public.admin_share_analysis(timestamptz, timestamptz),
  public.admin_funnel(timestamptz, timestamptz),
  public.admin_today_snapshot(),
  public.admin_monetization(timestamptz, timestamptz),
  public.admin_system_status()
from public, anon;

grant execute on function
  public.admin_kpi_summary(timestamptz, timestamptz),
  public.admin_daily_trend(timestamptz, timestamptz),
  public.admin_vacation_analysis(timestamptz, timestamptz),
  public.admin_traffic_sources(timestamptz, timestamptz),
  public.admin_top_pages(timestamptz, timestamptz, integer),
  public.admin_share_analysis(timestamptz, timestamptz),
  public.admin_funnel(timestamptz, timestamptz),
  public.admin_today_snapshot(),
  public.admin_monetization(timestamptz, timestamptz),
  public.admin_system_status()
to authenticated;


-- ============================================================================
-- 6. 관리자 승격 (이 줄만 이메일 바꿔서 따로 실행)
--
--    update public.profiles set role = 'admin' where email = 'yennysmail@gmail.com';
--
--    확인:
--    select email, role from public.profiles order by created_at;
-- ============================================================================
