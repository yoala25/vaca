import { supabase } from "../auth/supabaseClient";

/**
 * 로그인한 사용자의 휴가 설계 상태를 Supabase에 저장/복구한다.
 *
 * 필요한 테이블(SQL은 README 참고):
 *   public.planner_states(user_id uuid pk, state jsonb, updated_at timestamptz)
 * RLS로 본인 행만 읽고 쓸 수 있어야 한다.
 */

const TABLE = "planner_states";

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error" | "unavailable";

/** 테이블이 아직 없을 때 나는 오류인지. */
function isMissingTable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find the table") ||
    lower.includes("does not exist") ||
    lower.includes("schema cache")
  );
}

export interface LoadResult<T> {
  status: "found" | "empty" | "unavailable" | "error";
  state?: T;
  message?: string;
}

export async function loadPlannerState<T>(userId: string): Promise<LoadResult<T>> {
  if (!supabase) return { status: "unavailable" };

  const { data, error } = await supabase
    .from(TABLE)
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return isMissingTable(error.message)
      ? { status: "unavailable", message: "planner_states 테이블이 아직 없어요." }
      : { status: "error", message: error.message };
  }

  if (!data?.state) return { status: "empty" };
  return { status: "found", state: data.state as T };
}

export async function savePlannerState<T>(
  userId: string,
  state: T,
): Promise<{ ok: boolean; unavailable?: boolean; message?: string }> {
  if (!supabase) return { ok: false, unavailable: true };

  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });

  if (error) {
    return isMissingTable(error.message)
      ? { ok: false, unavailable: true, message: "planner_states 테이블이 아직 없어요." }
      : { ok: false, message: error.message };
  }
  return { ok: true };
}
