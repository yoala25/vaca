import { sanitizeLeaveDays } from "../lib/validation";

/**
 * 연도별 연차 지갑.
 *
 * 올해 "남은 연차"와 내년 "예상 연차"는 전혀 다른 값이므로 연도별로 독립 저장한다.
 * 어떤 경우에도 한 연도의 값을 다른 연도로 자동 복사하지 않는다.
 */

export type LeaveEntryType = "remaining" | "expected";

export interface LeaveWalletEntry {
  days: number;
  type: LeaveEntryType;
}

/** { 2026: { days: 4, type: "remaining" }, 2027: { days: 15, type: "expected" } } */
export type LeaveWallet = Record<number, LeaveWalletEntry>;

/** 현재 연도면 "남은 연차", 미래면 "예상 연차". */
export function entryTypeFor(year: number, currentYear: number): LeaveEntryType {
  return year <= currentYear ? "remaining" : "expected";
}

export function leaveTypeLabel(type: LeaveEntryType): string {
  return type === "remaining" ? "남은 연차" : "예상 연차";
}

export function getWalletEntry(wallet: LeaveWallet, year: number): LeaveWalletEntry | undefined {
  return wallet[year];
}

/** 값이 없으면 undefined. 절대 다른 연도 값으로 대체하지 않는다. */
export function getLeaveDays(wallet: LeaveWallet, year: number): number | undefined {
  return wallet[year]?.days;
}

/** 연차 지갑에 담을 수 있는 연도 범위(저장소·URL 조작 방어). */
const MIN_WALLET_YEAR = 2000;
const MAX_WALLET_YEAR = 2100;

export function isWalletYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_WALLET_YEAR && year <= MAX_WALLET_YEAR;
}

export function setLeaveDays(
  wallet: LeaveWallet,
  year: number,
  days: number,
  currentYear: number,
): LeaveWallet {
  // 범위 밖 연도는 저장하지 않는다(조작된 값이 지갑에 쌓이지 않도록).
  if (!isWalletYear(year)) return wallet;
  return {
    ...wallet,
    [year]: { days: sanitizeLeaveDays(days), type: entryTypeFor(year, currentYear) },
  };
}

/** 저장소에서 읽은 값을 검증한다. 손상된 항목은 조용히 버린다. */
export function sanitizeWallet(raw: unknown, currentYear: number): LeaveWallet {
  if (!raw || typeof raw !== "object") return {};
  const wallet: LeaveWallet = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const year = Number(key);
    if (!isWalletYear(year)) continue;
    if (!value || typeof value !== "object") continue;

    const days = sanitizeLeaveDays((value as LeaveWalletEntry).days, Number.NaN);
    if (!Number.isFinite(days)) continue;

    wallet[year] = { days, type: entryTypeFor(year, currentYear) };
  }

  return wallet;
}

/** 연차 규모에 따른 가벼운 한 줄 코멘트. */
export function describeLeaveAmount(days: number): string {
  if (days <= 0) return "연차를 입력하면 휴가를 짜드릴게요.";
  if (days <= 3) return "연차가 귀하네요. 최대한 길게 늘려볼게요!";
  if (days <= 7) return `연차 ${days}일, 알뜰하게 써볼까요?`;
  if (days <= 14) return `연차 ${days}일이면 여행 한 번은 넉넉해요 🧳`;
  return `연차 ${days}일이면 꽤 멀리 갈 수 있겠는데요? 😎`;
}
