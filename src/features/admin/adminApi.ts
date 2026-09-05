import { adminSupabase } from "./adminClient";

/**
 * 관리자 통계 조회.
 *
 * 전부 Supabase RPC(서버 집계 함수)를 부른다.
 * 브라우저로 raw 이벤트를 내려받아 계산하지 않는다 —
 * 수십만 건이 쌓여도 네트워크로 오는 것은 집계된 수십 줄뿐이다.
 *
 * 각 함수는 서버에서 admin_guard() 로 다시 권한을 확인하므로,
 * 관리자가 아닌 사람이 이 함수를 직접 호출해도 forbidden 만 돌아온다.
 */

export interface AdminQueryResult<T> {
  data: T | null;
  /** 화면에 그대로 띄워도 되는 안전한 메시지 */
  error: string | null;
  /** 권한 부족(로그아웃 유도용) */
  forbidden: boolean;
}

/** DB 오류 원문에는 테이블·제약조건 이름이 섞여 나오므로 그대로 노출하지 않는다. */
function toSafeError(message: string, code?: string): { error: string; forbidden: boolean } {
  const lower = message.toLowerCase();
  if (code === "42501" || lower.includes("forbidden") || lower.includes("permission denied")) {
    return { error: "이 데이터를 볼 권한이 없습니다.", forbidden: true };
  }
  if (lower.includes("could not find the function") || lower.includes("does not exist")) {
    return {
      error: "분석 함수가 아직 설치되지 않았습니다. supabase/admin-analytics.sql 을 실행해 주세요.",
      forbidden: false,
    };
  }
  if (import.meta.env.DEV) console.warn("[admin-api]", message);
  return { error: "데이터를 불러오지 못했습니다.", forbidden: false };
}

async function callRpc<T>(fn: string, params: Record<string, unknown>): Promise<AdminQueryResult<T>> {
  if (!adminSupabase) {
    return { data: null, error: "서버 연결이 설정되지 않았습니다.", forbidden: false };
  }
  try {
    const { data, error } = await adminSupabase.rpc(fn, params);
    if (error) {
      const safe = toSafeError(error.message, error.code);
      return { data: null, error: safe.error, forbidden: safe.forbidden };
    }
    return { data: data as T, error: null, forbidden: false };
  } catch {
    return { data: null, error: "데이터를 불러오지 못했습니다.", forbidden: false };
  }
}

/** 기간을 ISO 문자열로 바꿔 RPC 인자로 넘긴다. */
function rangeParams(from: Date, to: Date) {
  return { p_from: from.toISOString(), p_to: to.toISOString() };
}

// ── 응답 타입 ───────────────────────────────────────────────────────────────

export interface KpiSummary {
  visitors: number;
  page_views: number;
  sessions: number;
  sim_started: number;
  sim_completed: number;
  shares: number;
  share_visitors: number;
  affiliate_clicks: number;
}

export interface DailyTrendRow {
  day: string;
  visitors: number;
  page_views: number;
  sim_completed: number;
  shares: number;
}

export interface VacationAnalysis {
  by_year: Array<{ target_year: number; count: number; visitors: number }>;
  leave_buckets: Array<{ bucket: string; sort_key: number; count: number }>;
  avg_leave_days: number | null;
  avg_result_days: number | null;
  avg_efficiency: number | null;
  styles: Array<{ style: string; count: number }>;
  top_combos: Array<{ leave_days: number; result_days: number; count: number }>;
}

export interface TrafficSources {
  channels: Array<{ channel: string; visitors: number }>;
  utm_sources: Array<{ source: string; visitors: number }>;
  utm_mediums: Array<{ medium: string; visitors: number }>;
  utm_campaigns: Array<{ campaign: string; visitors: number }>;
  total_visitors: number;
}

export interface TopPageRow {
  page_path: string;
  page_views: number;
  visitors: number;
}

export interface ShareAnalysis {
  total: number;
  by_channel: Array<{ channel: string; count: number }>;
  share_visitors: number;
  complete_visitors: number;
  by_year: Array<{ target_year: number; count: number }>;
  top_shared_results: Array<{ leave_days: number; result_days: number; count: number }>;
}

export interface FunnelRow {
  step_order: number;
  step_name: string;
  visitors: number;
}

export interface TodaySnapshot {
  visitors: number;
  page_views: number;
  sim_completed: number;
  shares: number;
  last_event_at: string | null;
}

export interface Monetization {
  ad_impressions: number;
  ad_clicks: number;
  affiliate_clicks: number;
  affiliate_by_type: Array<{ type: string; count: number }>;
  affiliate_by_provider: Array<{ provider: string; count: number }>;
}

export interface SystemStatus {
  total_events: number;
  oldest_event: string | null;
  newest_event: string | null;
  total_visitors: number;
  admin_count: number;
  user_count: number;
  table_size: string;
  events_24h: number;
  event_names: Array<{ event_name: string; count: number }>;
}

// ── 조회 함수 ───────────────────────────────────────────────────────────────

export const fetchKpiSummary = (from: Date, to: Date) =>
  callRpc<KpiSummary>("admin_kpi_summary", rangeParams(from, to));

export const fetchDailyTrend = (from: Date, to: Date) =>
  callRpc<DailyTrendRow[]>("admin_daily_trend", rangeParams(from, to));

export const fetchVacationAnalysis = (from: Date, to: Date) =>
  callRpc<VacationAnalysis>("admin_vacation_analysis", rangeParams(from, to));

export const fetchTrafficSources = (from: Date, to: Date) =>
  callRpc<TrafficSources>("admin_traffic_sources", rangeParams(from, to));

export const fetchTopPages = (from: Date, to: Date, limit = 10) =>
  callRpc<TopPageRow[]>("admin_top_pages", { ...rangeParams(from, to), p_limit: limit });

export const fetchShareAnalysis = (from: Date, to: Date) =>
  callRpc<ShareAnalysis>("admin_share_analysis", rangeParams(from, to));

export const fetchFunnel = (from: Date, to: Date) =>
  callRpc<FunnelRow[]>("admin_funnel", rangeParams(from, to));

export const fetchTodaySnapshot = () => callRpc<TodaySnapshot>("admin_today_snapshot", {});

export const fetchMonetization = (from: Date, to: Date) =>
  callRpc<Monetization>("admin_monetization", rangeParams(from, to));

export const fetchSystemStatus = () => callRpc<SystemStatus>("admin_system_status", {});
