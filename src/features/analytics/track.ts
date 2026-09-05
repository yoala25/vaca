import { supabase } from "../auth/supabaseClient";
import { isKnownEvent, type AnalyticsEventName, type AnalyticsPayload, type AnalyticsRow } from "./events";
import { getAttribution, getDeviceType, getPagePath, getSessionId, getVisitorId } from "./visitor";
import { sendToGa4 } from "./ga4";

/**
 * 익명 이용 통계 전송.
 *
 * 절대 지켜야 할 것 하나: **이 모듈은 앱을 멈추게 하면 안 된다.**
 * Supabase 가 꺼져 있든, 네트워크가 끊겼든, RLS 가 거부하든
 * 휴가 계산 기능은 아무 영향 없이 그대로 동작해야 한다.
 * 그래서 모든 경로가 fire-and-forget 이고, 오류는 개발 모드 콘솔에만 남긴다.
 */

const TABLE = "analytics_events";

/** 한 번에 모아 보내는 최대 개수. */
const BATCH_SIZE = 10;
/** 이벤트가 생긴 뒤 이만큼 기다렸다가 모아서 보낸다. */
const FLUSH_DELAY_MS = 1500;

/**
 * 초당 수십 개가 쏟아져 DB 가 오염되는 것을 막는 토큰 버킷.
 * 사람이 쓰는 속도로는 절대 걸리지 않고, 폭주하는 코드/봇만 걸린다.
 * CAPTCHA 처럼 사용자를 불편하게 만들지 않으면서 1차 방어가 된다.
 */
const RATE_CAPACITY = 30;
const RATE_REFILL_PER_SEC = 0.5;

let tokens = RATE_CAPACITY;
let lastRefill = Date.now();

function allowedByRateLimit(): boolean {
  const now = Date.now();
  tokens = Math.min(RATE_CAPACITY, tokens + ((now - lastRefill) / 1000) * RATE_REFILL_PER_SEC);
  lastRefill = now;
  if (tokens < 1) return false;
  tokens -= 1;
  return true;
}

/**
 * 같은 이벤트가 짧은 시간 안에 반복되는 것을 걸러 낸다.
 * React StrictMode 의 이중 렌더, 리렌더로 인한 effect 재실행,
 * 사용자의 연타가 모두 여기서 한 번으로 접힌다.
 */
const DEDUPE_WINDOW_MS = 2000;
const recentKeys = new Map<string, number>();

function isDuplicate(key: string): boolean {
  const now = Date.now();
  // 맵이 무한히 자라지 않도록 만료된 항목을 정리한다.
  if (recentKeys.size > 64) {
    for (const [existing, at] of recentKeys) {
      if (now - at > DEDUPE_WINDOW_MS) recentKeys.delete(existing);
    }
  }
  const last = recentKeys.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;
  recentKeys.set(key, now);
  return false;
}

/** 숫자를 DB 제약(0~400, 소수 한 자리) 안으로 맞춘다. */
function safeNumber(value: number | undefined, max: number): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.round(Math.min(max, Math.max(0, value)) * 10) / 10;
}

function safeText(value: string | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, max);
  return cleaned || null;
}

/** props 는 짧은 원시값만 허용한다. 중첩 객체·긴 문자열은 버린다. */
function safeProps(
  props: AnalyticsPayload["props"],
): Record<string, string | number | boolean | null> | null {
  if (!props || typeof props !== "object") return null;
  const result: Record<string, string | number | boolean | null> = {};
  let count = 0;
  for (const [key, value] of Object.entries(props)) {
    if (count >= 12) break;
    const safeKey = key.slice(0, 32);
    if (typeof value === "string") result[safeKey] = value.slice(0, 64);
    else if (typeof value === "number" && Number.isFinite(value)) result[safeKey] = value;
    else if (typeof value === "boolean" || value === null) result[safeKey] = value;
    else continue;
    count += 1;
  }
  return count > 0 ? result : null;
}

let queue: AnalyticsRow[] = [];
let flushTimer: number | undefined;

async function flush(): Promise<void> {
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (queue.length === 0 || !supabase) return;

  const batch = queue;
  queue = [];

  try {
    const { error } = await supabase.from(TABLE).insert(batch);
    if (error && import.meta.env.DEV) {
      // 사용자에게는 아무것도 보여주지 않는다. 통계는 실패해도 되는 부수 기능이다.
      console.warn("[analytics] insert failed:", error.message);
    }
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[analytics] insert threw:", error);
  }
}

function scheduleFlush(): void {
  if (queue.length >= BATCH_SIZE) {
    void flush();
    return;
  }
  if (flushTimer !== undefined) return;
  flushTimer = window.setTimeout(() => void flush(), FLUSH_DELAY_MS);
}

/**
 * 이벤트 하나를 기록한다.
 *
 * 반환값이 없고 await 할 필요도 없다. 호출부는 결과를 신경 쓰지 않아도 된다.
 * Supabase 가 설정돼 있지 않으면 조용히 아무 일도 하지 않는다.
 */
export function track(name: AnalyticsEventName, payload: AnalyticsPayload = {}): void {
  try {
    // 알 수 없는 이벤트는 DB 가 어차피 거부하므로 여기서 먼저 막는다.
    if (!isKnownEvent(name)) return;

    const pagePath = getPagePath();
    const dedupeKey = `${name}:${pagePath}:${payload.targetYear ?? ""}:${payload.leaveDays ?? ""}`;
    if (isDuplicate(dedupeKey)) return;
    if (!allowedByRateLimit()) return;

    // GA4 는 Supabase 와 완전히 분리해 둔다.
    // 한쪽이 죽어도 다른 쪽과 앱 본체에 영향이 없어야 한다.
    sendToGa4(name, payload, pagePath);

    if (!supabase) return;

    const { id: sessionId } = getSessionId();
    const attribution = getAttribution();

    queue.push({
      visitor_id: getVisitorId(),
      session_id: sessionId,
      event_name: name,
      page_path: pagePath,
      target_year:
        payload.targetYear !== undefined && Number.isInteger(payload.targetYear)
          ? payload.targetYear
          : null,
      leave_days: safeNumber(payload.leaveDays, 400),
      vacation_style: safeText(payload.vacationStyle, 32),
      result_days: safeNumber(payload.resultDays, 400),
      referrer: attribution.referrer ?? null,
      utm_source: attribution.utmSource ?? null,
      utm_medium: attribution.utmMedium ?? null,
      utm_campaign: attribution.utmCampaign ?? null,
      device_type: getDeviceType(),
      props: safeProps(payload.props),
    });

    scheduleFlush();
  } catch (error) {
    // 통계 때문에 앱이 죽는 일은 없어야 한다.
    if (import.meta.env.DEV) console.warn("[analytics] track threw:", error);
  }
}

/**
 * 제휴 링크 클릭 기록용 도우미.
 * 향후 항공권·호텔·여행상품 버튼에 그대로 붙이면 된다.
 *
 *   trackAffiliateClick({ provider: "booking", type: "hotel", destination: "tokyo" })
 */
export function trackAffiliateClick(input: {
  provider: string;
  type: "flight" | "hotel" | "package" | "other" | string;
  destination?: string;
  targetYear?: number;
}): void {
  track("affiliate_click", {
    targetYear: input.targetYear,
    props: {
      provider: input.provider,
      type: input.type,
      ...(input.destination ? { destination: input.destination } : {}),
    },
  });
}

/** 광고 노출·클릭 기록용 도우미 (AdSense 붙이면 사용). */
export function trackAd(kind: "impression" | "click", slot: string): void {
  track(kind === "impression" ? "ad_impression" : "ad_click", { props: { slot } });
}

/**
 * 탭을 닫거나 백그라운드로 갈 때 큐에 남은 이벤트를 흘려보낸다.
 * 이 시점에는 fetch 가 취소될 수 있어 보장은 못 하지만, 대부분은 전송된다.
 */
export function installAnalyticsFlushHooks(): () => void {
  const onHide = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  return () => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
  };
}
