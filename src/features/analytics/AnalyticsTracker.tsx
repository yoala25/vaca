import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { track, installAnalyticsFlushHooks } from "./track";
import { initGa4 } from "./ga4";
import { getSessionId, getPagePath } from "./visitor";

/**
 * 라우트가 바뀔 때마다 page_view 를 남기는 보이지 않는 컴포넌트.
 *
 * UI 를 그리지 않으므로 기존 화면에 아무 영향이 없다.
 * 라우터 안 어디에든 한 번만 넣으면 된다.
 *
 * 같은 경로가 연속으로 렌더돼도 한 번만 기록한다
 * (StrictMode 이중 렌더 + track() 내부 중복 제거, 이중 방어).
 */
export function AnalyticsTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  // GA4 초기화 + 종료 시 큐 비우기 훅은 앱 생애 동안 한 번만.
  useEffect(() => {
    initGa4();
    return installAnalyticsFlushHooks();
  }, []);

  useEffect(() => {
    const path = getPagePath();
    if (lastPath.current === path) return;
    lastPath.current = path;

    // 세션이 새로 시작됐다면 그 사실도 한 번 남긴다(세션 단위 분석용).
    const { isNew } = getSessionId();
    if (isNew) track("session_start");

    track("page_view");
  }, [location.pathname, location.hash, location.search]);

  return null;
}
