/**
 * 기록하는 이벤트의 목록과 형태.
 *
 * 이 목록은 Supabase 의 RLS INSERT 정책(analytics_events)에 있는 화이트리스트와
 * 반드시 같아야 한다. 여기에 이벤트를 추가하면 SQL 쪽 목록에도 추가해야 하고,
 * 그렇지 않으면 DB 가 조용히 거부한다(의도된 동작 — 임의 이벤트 주입 방지).
 */

export const ANALYTICS_EVENTS = [
  "page_view",
  "session_start",

  "simulation_start",
  "simulation_complete",
  "retry_simulation",

  "year_select",
  "leave_input",
  "vacation_style_select",
  "result_view",

  "share_click",
  "share_kakao",
  "share_link",
  "share_image",

  "save_combination",
  "company_policy_save",

  "affiliate_click",
  "ad_impression",
  "ad_click",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const EVENT_SET = new Set<string>(ANALYTICS_EVENTS);

export function isKnownEvent(name: string): name is AnalyticsEventName {
  return EVENT_SET.has(name);
}

/**
 * 이벤트에 함께 담을 수 있는 값.
 * 전부 선택 항목이고, 개인을 식별할 수 있는 값은 여기에 넣지 않는다.
 */
export interface AnalyticsPayload {
  /** 시뮬레이션 대상 연도 (2026, 2027 …) */
  targetYear?: number;
  /** 사용자가 입력한 연차 일수 */
  leaveDays?: number;
  /** 휴가 전략 (long-break / frequent / thrifty) */
  vacationStyle?: string;
  /** 추천 결과의 총 휴식일 */
  resultDays?: number;
  /** 이벤트별 부가 정보. 짧은 문자열·숫자만 담는다. */
  props?: Record<string, string | number | boolean | null>;
}

/** DB 컬럼과 1:1로 맞춘 전송 형태. */
export interface AnalyticsRow {
  visitor_id: string;
  session_id: string;
  event_name: AnalyticsEventName;
  page_path: string | null;
  target_year: number | null;
  leave_days: number | null;
  vacation_style: string | null;
  result_days: number | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  props: Record<string, string | number | boolean | null> | null;
}
