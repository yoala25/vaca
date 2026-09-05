/**
 * 익명 방문자 · 세션 식별자.
 *
 * 개인정보를 쓰지 않는다. 랜덤 UUID 하나가 전부다.
 * 이름·이메일·전화번호·IP·정확한 위치·브라우저 fingerprint 는 만들지도, 보내지도 않는다.
 * 사용자가 브라우저 저장소를 지우면 새 사람으로 취급되며, 그게 의도된 동작이다.
 */

const VISITOR_KEY = "hyugayojeong-visitor-id";
const SESSION_KEY = "hyugayojeong-session";

/** 30분 이상 활동이 없으면 새 세션으로 본다(GA4 와 같은 기준). */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface StoredSession {
  id: string;
  lastSeen: number;
}

/** crypto.randomUUID 가 없는 환경(구형 브라우저·비보안 컨텍스트)을 위한 대비책. */
function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* 저장소·crypto 접근이 막힌 환경 */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * 방문자 ID. 한 번 만들면 계속 유지한다.
 * 사생활 보호 모드 등으로 저장소를 못 쓰면 매번 새로 만들어 쓰고 넘어간다
 * (통계가 조금 부정확해질 뿐, 앱은 절대 멈추지 않는다).
 */
export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8 && existing.length <= 64) return existing;
    const created = randomId();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

/** 세션 ID. 마지막 활동에서 30분이 지나면 새로 만든다. */
export function getSessionId(): { id: string; isNew: boolean } {
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSession;
      if (parsed?.id && now - parsed.lastSeen < SESSION_TIMEOUT_MS) {
        const touched: StoredSession = { id: parsed.id, lastSeen: now };
        const value = JSON.stringify(touched);
        sessionStorage.setItem(SESSION_KEY, value);
        localStorage.setItem(SESSION_KEY, value);
        return { id: parsed.id, isNew: false };
      }
    }
  } catch {
    /* 저장소를 못 읽으면 새 세션으로 취급한다 */
  }

  const created: StoredSession = { id: randomId(), lastSeen: now };
  try {
    const value = JSON.stringify(created);
    sessionStorage.setItem(SESSION_KEY, value);
    localStorage.setItem(SESSION_KEY, value);
  } catch {
    /* 저장 실패해도 이번 이벤트는 그대로 보낸다 */
  }
  return { id: created.id, isNew: true };
}

export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * 화면 폭만 본다. User-Agent 를 파싱해 기기를 특정하지 않는다(fingerprint 방지).
 * 앱의 반응형 breakpoint 와 같은 기준을 쓴다.
 */
export function getDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1200) return "tablet";
  return "desktop";
}

export interface Attribution {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

const ATTRIBUTION_KEY = "hyugayojeong-attribution";

function trim(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().slice(0, max);
  return cleaned || undefined;
}

/**
 * 유입 경로. 세션이 시작될 때 한 번 잡아 두고 그 세션 내내 같은 값을 쓴다.
 * (앱 안에서 라우트를 옮길 때마다 referrer 가 자기 자신으로 덮여 쓰이는 것을 막는다.)
 *
 * referrer 는 전체 URL 이 아니라 호스트만 남긴다. 검색어 등 경로에 담긴
 * 사용자 정보가 따라 들어오지 않게 하기 위해서다.
 */
export function getAttribution(): Attribution {
  try {
    const cached = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (cached) return JSON.parse(cached) as Attribution;
  } catch {
    /* 캐시를 못 읽으면 아래에서 새로 계산한다 */
  }

  const attribution: Attribution = {};

  try {
    const params = new URLSearchParams(window.location.search);
    attribution.utmSource = trim(params.get("utm_source"), 64);
    attribution.utmMedium = trim(params.get("utm_medium"), 64);
    attribution.utmCampaign = trim(params.get("utm_campaign"), 64);

    const ref = document.referrer;
    if (ref) {
      const url = new URL(ref);
      // 자기 사이트에서 넘어온 것은 유입이 아니다.
      if (url.host !== window.location.host) attribution.referrer = trim(url.host, 256);
    }
  } catch {
    /* URL 파싱 실패는 무시한다 */
  }

  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    /* 저장 실패는 무시 */
  }
  return attribution;
}

/**
 * 현재 페이지 경로. HashRouter 를 쓰므로 해시 안의 경로가 실제 화면이다.
 * 쿼리스트링은 떼어 낸다(?year=2027 이 다른 페이지로 집계되면 안 되고,
 * 쿼리에 사용자 정보가 섞여 들어올 여지도 없앤다).
 */
export function getPagePath(): string {
  if (typeof window === "undefined") return "/";
  const hash = window.location.hash.replace(/^#/, "");
  const path = (hash || window.location.pathname || "/").split("?")[0];
  return path.slice(0, 256) || "/";
}
