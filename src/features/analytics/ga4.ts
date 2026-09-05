import type { AnalyticsPayload } from "./events";

/**
 * Google Analytics 4 연동.
 *
 * Supabase 자체 통계와 **완전히 분리**해 둔다.
 * - VITE_GA_MEASUREMENT_ID 가 없으면 아무것도 로드하지 않고 조용히 꺼진다.
 * - gtag 로드에 실패하거나 GA4 가 장애여도 휴가요정 기능에는 영향이 없다.
 * - 광고 차단기가 gtag.js 를 막는 것은 정상 상황으로 취급한다.
 */

const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();

/** GA4 를 쓸 수 있는 상태인지. UI 에서 상태 표시에 쓴다. */
export const isGa4Configured = Boolean(MEASUREMENT_ID);

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

let loaded = false;

/**
 * gtag.js 를 한 번만 로드한다.
 * 앱 시작을 막지 않도록 async 스크립트로 붙인다.
 */
export function initGa4(): void {
  if (loaded || !MEASUREMENT_ID || typeof document === "undefined") return;
  loaded = true;

  try {
    window.dataLayer = window.dataLayer ?? [];
    const gtag: GtagFn = (...args) => {
      window.dataLayer?.push(args);
    };
    window.gtag = gtag;

    gtag("js", new Date());
    // HashRouter 를 쓰므로 페이지뷰는 우리가 직접 보낸다(자동 수집은 끈다).
    gtag("config", MEASUREMENT_ID, { send_page_view: false });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    script.onerror = () => {
      // 광고 차단기 등으로 막히는 것은 흔한 일이다. 조용히 넘어간다.
      if (import.meta.env.DEV) console.info("[ga4] gtag.js 로드 실패 (무시)");
    };
    document.head.appendChild(script);
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[ga4] init 실패 (무시):", error);
  }
}

/**
 * 이벤트를 GA4 로도 보낸다.
 * Supabase 전송과 독립적이라 한쪽이 실패해도 다른 쪽은 그대로 간다.
 */
export function sendToGa4(name: string, payload: AnalyticsPayload, pagePath: string): void {
  if (!MEASUREMENT_ID) return;
  try {
    const gtag = window.gtag;
    if (typeof gtag !== "function") return;

    if (name === "page_view") {
      gtag("event", "page_view", {
        page_path: pagePath,
        page_location: window.location.href,
        page_title: document.title,
      });
      return;
    }

    gtag("event", name, {
      page_path: pagePath,
      ...(payload.targetYear !== undefined ? { target_year: payload.targetYear } : {}),
      ...(payload.leaveDays !== undefined ? { leave_days: payload.leaveDays } : {}),
      ...(payload.resultDays !== undefined ? { result_days: payload.resultDays } : {}),
      ...(payload.vacationStyle ? { vacation_style: payload.vacationStyle } : {}),
      ...(payload.props ?? {}),
    });
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[ga4] send 실패 (무시):", error);
  }
}
