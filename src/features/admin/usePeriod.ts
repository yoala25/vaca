import { createContext, useContext } from "react";

/**
 * 관리자 화면 상단의 기간 필터.
 * 모든 페이지가 같은 기간을 공유하므로 Context 로 올려 둔다.
 */

export const PERIOD_PRESETS = [
  { id: "today", label: "오늘" },
  { id: "7d", label: "최근 7일" },
  { id: "30d", label: "최근 30일" },
  { id: "month", label: "이번 달" },
  { id: "all", label: "전체" },
  { id: "custom", label: "사용자 지정" },
] as const;

export type PeriodId = (typeof PERIOD_PRESETS)[number]["id"];

export interface PeriodRange {
  from: Date;
  to: Date;
}

/** 프리셋을 실제 날짜 구간으로 바꾼다. 하루의 시작·끝까지 포함한다. */
export function resolvePeriod(id: PeriodId, custom?: { from: string; to: string }): PeriodRange {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  switch (id) {
    case "today":
      return { from: startOfToday, to: endOfToday };
    case "7d":
      return { from: new Date(startOfToday.getTime() - 6 * 86400000), to: endOfToday };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday };
    case "all":
      // 서버에서 3년으로 한 번 더 자른다(admin_clamp_range).
      return { from: new Date(now.getFullYear() - 3, 0, 1), to: endOfToday };
    case "custom": {
      const from = custom?.from ? new Date(`${custom.from}T00:00:00`) : startOfToday;
      const to = custom?.to ? new Date(`${custom.to}T23:59:59`) : endOfToday;
      // 뒤집힌 구간이 들어와도 조회가 깨지지 않게 정렬한다.
      return from <= to ? { from, to } : { from: to, to: from };
    }
    case "30d":
    default:
      return { from: new Date(startOfToday.getTime() - 29 * 86400000), to: endOfToday };
  }
}

export interface PeriodValue {
  id: PeriodId;
  range: PeriodRange;
  custom: { from: string; to: string };
  setPeriod: (id: PeriodId) => void;
  setCustom: (custom: { from: string; to: string }) => void;
  /** 수동 새로고침 트리거. 값이 바뀌면 각 페이지가 다시 조회한다. */
  refreshToken: number;
  refresh: () => void;
}

export const PeriodContext = createContext<PeriodValue | null>(null);

export function usePeriod(): PeriodValue {
  const value = useContext(PeriodContext);
  if (!value) throw new Error("usePeriod must be used within AdminLayout");
  return value;
}

/** "1,284" 처럼 읽기 쉬운 숫자. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("ko-KR");
}

/** "57.8%" */
export function formatPercent(numerator: number, denominator: number, digits = 1): string {
  if (!denominator) return "—";
  return `${((numerator / denominator) * 100).toFixed(digits)}%`;
}

/** "14.2일" */
export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toFixed(1)}일`;
}
