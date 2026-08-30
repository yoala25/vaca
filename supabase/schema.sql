-- 휴가요정 Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.

-- 사용자별 휴가 설계 상태(남은 연차, 회사 휴가제도, 찜한 조합, 직접 추가한 휴가 등)
create table if not exists public.planner_states (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ⚠️ 필수: publishable(anon) 키는 브라우저에 공개되므로,
-- RLS가 꺼져 있으면 누구나 모든 사용자의 데이터를 읽고 쓸 수 있다.
alter table public.planner_states enable row level security;

-- 본인 행만 읽고 쓸 수 있게 한다.
drop policy if exists "planner_states_select_own" on public.planner_states;
create policy "planner_states_select_own"
  on public.planner_states for select
  using (auth.uid() = user_id);

drop policy if exists "planner_states_insert_own" on public.planner_states;
create policy "planner_states_insert_own"
  on public.planner_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "planner_states_update_own" on public.planner_states;
create policy "planner_states_update_own"
  on public.planner_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "planner_states_delete_own" on public.planner_states;
create policy "planner_states_delete_own"
  on public.planner_states for delete
  using (auth.uid() = user_id);
