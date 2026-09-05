/**
 * 사용자 입력(폼·URL·localStorage) 검증.
 *
 * URL 파라미터와 저장소 값은 사용자가 마음대로 바꿀 수 있으므로 신뢰하지 않는다.
 * 잘못된 값이 들어와도 앱이 깨지지 않고 안전한 기본값으로 되돌아가야 한다.
 */

/** 연차 입력 허용 범위(일). */
export const MIN_LEAVE_DAYS = 0;
export const MAX_LEAVE_DAYS = 90;

/**
 * 연차 일수를 안전한 숫자로 정규화한다.
 * NaN·Infinity·음수·문자열·과도하게 큰 값을 모두 걸러낸다.
 */
export function sanitizeLeaveDays(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(MAX_LEAVE_DAYS, Math.max(MIN_LEAVE_DAYS, parsed));
  // 0.5일 단위로 맞춘다(반차까지만 허용).
  return Math.round(clamped * 2) / 2;
}

/** 연도를 허용 목록 안의 값으로만 받아들인다. */
export function sanitizeYear(value: unknown, allowedYears: number[], fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return allowedYears.includes(parsed) ? parsed : fallback;
}

/** 근무시간(분)을 안전한 범위로 제한한다. */
export function sanitizeWorkMinutes(value: unknown, fallback = 480): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(720, Math.max(60, Math.round(parsed)));
}

/** 사용자가 입력한 짧은 텍스트(휴가 이름 등)를 안전한 길이로 자른다. */
export function sanitizeShortText(value: unknown, maxLength = 40): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}
