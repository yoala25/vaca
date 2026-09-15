import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DayOfWeek,
  VacationStrategy,
  addDays,
  createDefaultLeaveCatalog,
  createVacationEngine,
  createWorkSchedule,
  localDate,
  maxDate,
  toCivil,
  todayInSeoul,
  type CompanyHoliday,
  type LocalDate,
  type VacationOptimizationResult,
  type VacationOverlayRange,
} from "../domain/vacation";
import {
  DEFAULT_COMPANY_POLICY,
  resolveLeaveExpiryDate,
  totalLeaveDays,
  extraLeavesForYear,
  type CompanyPolicy,
} from "../data/companyPolicy";
import { getHolidaySet } from "../data/holidayProvider";
import { SUPPORTED_HOLIDAY_YEARS } from "../data/holidays";
import {
  describeLeaveAmount,
  entryTypeFor,
  getLeaveDays,
  sanitizeWallet,
  setLeaveDays,
  type LeaveEntryType,
  type LeaveWallet,
} from "../data/leaveWallet";
import { sanitizeLeaveDays, sanitizeWorkMinutes, sanitizeYear } from "../lib/validation";
import { useAuth } from "../features/auth/AuthContext";
import { loadPlannerState, savePlannerState, type SyncStatus } from "../features/sync/plannerSync";

export type WorkPattern = "mon-fri" | "mon-sat" | "custom";

const WORK_PATTERN_DAYS: Record<WorkPattern, DayOfWeek[]> = {
  "mon-fri": [
    DayOfWeek.Monday,
    DayOfWeek.Tuesday,
    DayOfWeek.Wednesday,
    DayOfWeek.Thursday,
    DayOfWeek.Friday,
  ],
  "mon-sat": [
    DayOfWeek.Monday,
    DayOfWeek.Tuesday,
    DayOfWeek.Wednesday,
    DayOfWeek.Thursday,
    DayOfWeek.Friday,
    DayOfWeek.Saturday,
  ],
  custom: [
    DayOfWeek.Monday,
    DayOfWeek.Tuesday,
    DayOfWeek.Wednesday,
    DayOfWeek.Thursday,
    DayOfWeek.Friday,
  ],
};

/** 휴가 구간이 소멸일을 넘어 이어질 수 있으므로 달력은 소멸일 뒤로 조금 더 본다. */
const RANGE_TAIL_DAYS = 21;

interface PersistedState {
  workPattern: WorkPattern;
  strategy: VacationStrategy;
  savedRanges: VacationOverlayRange[];
  /** 사용자가 달력에서 직접 찍어 추가한 휴가 날짜. */
  manualLeaveDates: LocalDate[];
  /** 추천된 휴가 중 사용자가 "이 날은 안 쓸래"라고 취소한 날짜. */
  excludedDates: LocalDate[];
  /** 연도별 연차 지갑. 연도마다 값이 완전히 독립적이다. */
  leaveWallet: LeaveWallet;
  /** 게스트가 연차를 입력하고 "계산하기"를 눌렀는지. */
  onboardingComplete: boolean;
  companyPolicy: CompanyPolicy;
}

const STORAGE_PREFIX = "hyugayojeong-state-v5";

/** 로그인하면 계정별로 데이터를 나눠 저장한다. 게스트는 공용 키를 쓴다. */
function storageKeyFor(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX;
}

const DEFAULT_STATE: PersistedState = {
  workPattern: "mon-fri",
  strategy: VacationStrategy.LongBreak,
  savedRanges: [],
  manualLeaveDates: [],
  excludedDates: [],
  leaveWallet: {},
  onboardingComplete: false,
  companyPolicy: DEFAULT_COMPANY_POLICY,
};

/**
 * 외부에서 들어온 상태(localStorage · 서버 저장본)를 앱이 믿을 수 있는 형태로 만든다.
 * 두 경로 모두 사용자가 조작할 수 있으므로 반드시 여기를 거쳐야 한다.
 */
function normalizeState(parsed: Partial<PersistedState> | null | undefined): PersistedState {
  if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;

  const currentYear = toCivil(todayInSeoul()).year;
  const companyPolicy = { ...DEFAULT_COMPANY_POLICY, ...(parsed.companyPolicy ?? {}) };
  companyPolicy.remainingLeaveDays = sanitizeLeaveDays(companyPolicy.remainingLeaveDays, 0);
  companyPolicy.baseLeaveDays = sanitizeLeaveDays(companyPolicy.baseLeaveDays, 0);
  companyPolicy.dailyWorkMinutes = sanitizeWorkMinutes(companyPolicy.dailyWorkMinutes);

  let leaveWallet = sanitizeWallet(parsed.leaveWallet, currentYear);

  // 이전 버전은 연차를 companyPolicy 한 곳에만 저장했다.
  // 지갑이 비어 있으면 그 값을 올해 항목으로 옮겨 준다(기존 사용자 데이터 보존).
  if (Object.keys(leaveWallet).length === 0) {
    leaveWallet = {
      [currentYear]: { days: companyPolicy.remainingLeaveDays, type: "remaining" },
    };
  }

  /*
   * 아는 키만 골라 담는다(화이트리스트).
   * 저장소는 사용자가 직접 편집할 수 있으므로, 모르는 키를 통째로 넘기면
   * isAdmin 같은 값이 상태에 섞여 들어가 다시 저장된다. 앱은 그런 값을 읽지 않지만
   * 애초에 담기지 않는 편이 안전하다.
   */
  return {
    ...DEFAULT_STATE,
    workPattern: parsed.workPattern ?? DEFAULT_STATE.workPattern,
    strategy: parsed.strategy ?? DEFAULT_STATE.strategy,
    onboardingComplete: parsed.onboardingComplete === true,
    companyPolicy,
    leaveWallet,
    // 배열이어야 하는 값이 다른 타입으로 조작돼도 렌더가 깨지지 않게 한다.
    savedRanges: Array.isArray(parsed.savedRanges) ? parsed.savedRanges : [],
    manualLeaveDates: Array.isArray(parsed.manualLeaveDates) ? parsed.manualLeaveDates : [],
    excludedDates: Array.isArray(parsed.excludedDates) ? parsed.excludedDates : [],
  };
}

function loadState(storageKey: string): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_STATE;
    return normalizeState(JSON.parse(raw) as Partial<PersistedState>);
  } catch {
    return DEFAULT_STATE;
  }
}

// 엔진 인스턴스는 한 번만 만든다. 내부에 후보 풀 캐시를 들고 있어서
// 전략만 바꿀 때는 달력·후보를 다시 계산하지 않는다.
const engine = createVacationEngine();

interface PlannerContextValue {
  workPattern: WorkPattern;
  strategy: VacationStrategy;
  companyPolicy: CompanyPolicy;
  savedRanges: VacationOverlayRange[];
  manualLeaveDates: LocalDate[];
  excludedDates: LocalDate[];
  hasCalculated: boolean;
  onboardingComplete: boolean;

  /** 보유 연차에서 직접 추가한 휴가를 뺀, 추천에 쓸 수 있는 연차. */
  availableLeaveDays: number;
  /** 사용자가 입력한 남은/예상 연차(직접 추가분 차감 전). */
  remainingLeaveDays: number;

  // ── 연도 선택 & 연차 지갑 ──
  /** 지금 보고 있는 연도. */
  selectedYear: number;
  /** 오늘 기준 연도. */
  currentYear: number;
  /** 선택 가능한 연도 목록(공휴일 데이터가 있는 연도만). */
  availableYears: number[];
  isFutureYear: boolean;
  /** 현재 연도면 "남은 연차", 미래면 "예상 연차". */
  leaveEntryType: LeaveEntryType;
  /** 선택 연도의 연차 값이 아직 입력되지 않았는지. */
  needsLeaveInput: boolean;
  leaveWallet: LeaveWallet;
  leaveAmountHint: string;
  setSelectedYear: (year: number) => void;
  setLeaveDaysForYear: (year: number, days: number) => void;
  /** 기본 연차 + 리프레시휴가 등을 합친 올해 전체 휴가일수. */
  totalLeaveDays: number;
  today: LocalDate;
  /** 연차 소멸일. 이 날짜까지만 휴가를 배치한다. */
  leaveExpiryDate: LocalDate;
  /** 서버 저장 상태. 로그인했을 때만 의미가 있다. */
  syncStatus: SyncStatus;
  result: VacationOptimizationResult;

  setWorkPattern: (value: WorkPattern) => void;
  setStrategy: (value: VacationStrategy) => void;
  setRemainingLeaveDays: (value: number) => void;
  updateCompanyPolicy: (policy: CompanyPolicy) => void;
  toggleSavedRange: (range: VacationOverlayRange) => void;
  isRangeSaved: (candidateId: string) => boolean;
  toggleManualLeaveDate: (date: LocalDate) => void;
  clearManualLeaveDates: () => void;
  excludeDate: (date: LocalDate) => void;
  clearExcludedDates: () => void;
  markCalculated: () => void;
  resetCalculation: () => void;
  completeOnboarding: () => void;
  restartOnboarding: () => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user, cloudEnabled } = useAuth();
  const userId = user?.id ?? null;
  const storageKey = storageKeyFor(userId);

  const [state, setState] = useState<PersistedState>(() => loadState(storageKeyFor(userId)));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  /*
   * "연차 질문을 지나 시뮬레이터로 들어왔는가"는 영구 저장하지 않고 탭 단위로만 기억한다.
   * 새로 접속하면 항상 질문 페이지부터 보여주되(지난 입력값은 미리 채워진다),
   * 같은 탭에서 새로고침하거나 구글 로그인 후 돌아왔을 때는 보던 화면을 유지하기 위해서다.
   */
  const [hasCalculated, setHasCalculated] = useState<boolean>(readSessionCalculated);

  /*
   * 계정이 바뀌면(로그인/로그아웃) 그 계정의 저장본을 불러온다.
   * 게스트로 쓰던 내용이 있고 그 계정에 아직 저장본이 없으면, 가입 직후 데이터가
   * 사라지지 않도록 게스트 데이터를 그대로 이어받는다.
   */
  const loadedKeyRef = useRef(storageKey);
  useEffect(() => {
    if (loadedKeyRef.current === storageKey) return;
    loadedKeyRef.current = storageKey;

    const hasLocalCopy = window.localStorage.getItem(storageKey) !== null;
    if (!userId) {
      setState(loadState(storageKey));
      setSyncStatus("idle");
      return;
    }

    // 로그인: 서버 저장본이 있으면 그것을 우선하고, 없으면 지금 화면 상태를 계정에 옮긴다.
    let active = true;
    setSyncStatus("loading");
    void loadPlannerState<PersistedState>(userId).then((result) => {
      if (!active) return;
      if (result.status === "found" && result.state) {
        // 서버 저장본도 신뢰하지 않는다. 로컬 저장본과 똑같이 검증해서 넣는다.
        setState(normalizeState(result.state));
        setSyncStatus("saved");
      } else if (result.status === "unavailable") {
        if (hasLocalCopy) setState(loadState(storageKey));
        setSyncStatus("unavailable");
      } else if (result.status === "error") {
        if (hasLocalCopy) setState(loadState(storageKey));
        setSyncStatus("error");
      } else {
        // 서버에 아직 저장본이 없다 → 현재(게스트) 상태를 그대로 이어간다.
        setSyncStatus("idle");
      }
    });

    return () => {
      active = false;
    };
  }, [storageKey, userId]);

  // 로컬에는 항상 즉시 저장한다(오프라인·비로그인 대비).
  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, state]);

  // 로그인 상태면 서버에도 저장한다. 입력이 잦으므로 잠시 모았다가 보낸다.
  useEffect(() => {
    if (!userId || !cloudEnabled) return;
    if (syncStatus === "loading") return;

    const timer = window.setTimeout(() => {
      setSyncStatus("saving");
      void savePlannerState(userId, state).then((result) => {
        if (result.ok) setSyncStatus("saved");
        else setSyncStatus(result.unavailable ? "unavailable" : "error");
      });
    }, 800);

    return () => window.clearTimeout(timer);
    // syncStatus는 저장 결과를 담는 값이라 의존성에 넣으면 무한 루프가 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cloudEnabled, state]);

  // 오늘 날짜는 렌더마다 다시 읽지 않는다(계산 캐시가 무효화되므로).
  const today = useMemo(() => todayInSeoul(), []);
  const currentYear = toCivil(today).year;

  // 선택 가능한 연도: 올해부터, 공휴일 데이터가 있는 만큼(최소 2년 앞까지).
  const availableYears = useMemo(
    () => SUPPORTED_HOLIDAY_YEARS.filter((year) => year >= currentYear),
    [currentYear],
  );

  const [selectedYear, setSelectedYearState] = useState<number>(() =>
    sanitizeYear(readYearFromUrl(), availableYears, currentYear),
  );

  // URL(?year=)과 선택 연도를 동기화해 새로고침·공유해도 유지되게 한다.
  useEffect(() => {
    writeYearToUrl(selectedYear, currentYear);
  }, [selectedYear, currentYear]);

  const isFutureYear = selectedYear > currentYear;
  const leaveEntryType: LeaveEntryType = entryTypeFor(selectedYear, currentYear);

  /** 선택 연도의 연차. 값이 없으면 undefined — 다른 연도 값으로 대체하지 않는다. */
  const leaveDaysForYear = getLeaveDays(state.leaveWallet, selectedYear);
  const hasLeaveForYear = leaveDaysForYear !== undefined;

  /**
   * 연차 소멸일은 선택 연도 기준으로 계산한다.
   * 미래 연도는 그 해 1월 1일을 기준일로 삼아 "그 해의 12/31" 같은 규칙이 그대로 적용된다.
   */
  const leaveExpiryDate = useMemo(
    () =>
      resolveLeaveExpiryDate(
        state.companyPolicy,
        isFutureYear ? localDate(selectedYear, 1, 1) : today,
      ),
    [state.companyPolicy, today, selectedYear, isFutureYear],
  );

  /*
   * 선택 연도에 적용되는 추가 휴가(리프레시휴가 등).
   * "2027년에만 2주" 같은 일회성 휴가는 그 해를 볼 때만 반영된다.
   */
  const extraLeaves = useMemo(
    () => extraLeavesForYear(state.companyPolicy, selectedYear),
    [state.companyPolicy, selectedYear],
  );
  /** 나눠 쓸 수 있는 추가 휴가는 그냥 연차 예산에 더한다. */
  const splittableExtraDays = extraLeaves
    .filter((entry) => !entry.continuous)
    .reduce((sum, entry) => sum + Math.max(0, entry.days), 0);

  const companyRemaining = leaveDaysForYear ?? 0;
  // 직접 찍은 휴가는 이미 쓰기로 한 연차이므로 추천 예산에서 뺀다.
  const availableLeaveDays = Math.max(
    0,
    companyRemaining + splittableExtraDays - state.manualLeaveDates.length,
  );

  const result = useMemo(() => {
    // 올해는 오늘부터, 미래 연도는 그 해 1월 1일부터 탐색한다.
    const yearStart = localDate(selectedYear, 1, 1);
    const dateRange = {
      startDate: maxDate(yearStart, today),
      endDate: addDays(leaveExpiryDate, RANGE_TAIL_DAYS),
    };
    const workSchedule = createWorkSchedule({
      workingDays: WORK_PATTERN_DAYS[state.workPattern],
    });

    const companyHolidays: CompanyHoliday[] = state.companyPolicy.companyHolidays.map((entry) => ({
      id: entry.id,
      name: entry.name,
      startDate: entry.startDate,
      endDate: entry.endDate,
      recurring: entry.recurring,
    }));

    // 연속으로 써야 하는 휴가만 별도 휴가 종류로 만든다(엔진이 통째 블록으로 배치).
    const continuousExtras = extraLeaves.filter((entry) => entry.continuous && entry.days > 0);

    const leaveCatalog = createDefaultLeaveCatalog({
      annualRemainingMinutes: availableLeaveDays * state.companyPolicy.dailyWorkMinutes,
      annualTotalMinutes:
        Math.max(totalLeaveDays(state.companyPolicy, selectedYear), companyRemaining) *
        state.companyPolicy.dailyWorkMinutes,
      halfDayEnabled: state.companyPolicy.halfDayEnabled,
      hourlyUnitMinutes: state.companyPolicy.hourlyUnitMinutes,
      standardDailyWorkMinutes: state.companyPolicy.dailyWorkMinutes,
      validUntil: leaveExpiryDate,
      extraLeaves: continuousExtras.map((entry) => ({
        id: `extra-${entry.id}`,
        name: entry.name,
        days: entry.days,
        continuous: true,
        countsCalendarDays: entry.countsCalendarDays,
      })),
    });

    return engine.optimize({
      dateRange,
      workSchedule,
      holidays: getHolidaySet(dateRange.startDate, dateRange.endDate),
      companyHolidays,
      leaveCatalog,
      strategy: state.strategy,
      // 연속 사용 휴가가 있을 때만 특별휴가 탐색을 켠다(없으면 후보 생성 비용 0).
      includeSpecialLeave: continuousExtras.length > 0,
      // 직접 찍은 날은 추천이 중복해서 쓰지 않도록, 취소한 날은 다시 제안하지 않도록 제외한다.
      preferences: { blockedDates: [...state.manualLeaveDates, ...state.excludedDates] },
    });
  }, [
    today,
    selectedYear,
    leaveExpiryDate,
    availableLeaveDays,
    companyRemaining,
    extraLeaves,
    state.workPattern,
    state.strategy,
    state.companyPolicy,
    state.manualLeaveDates,
    state.excludedDates,
  ]);

  const value: PlannerContextValue = {
    workPattern: state.workPattern,
    strategy: state.strategy,
    companyPolicy: state.companyPolicy,
    savedRanges: state.savedRanges,
    manualLeaveDates: state.manualLeaveDates,
    excludedDates: state.excludedDates,
    hasCalculated,
    onboardingComplete: state.onboardingComplete,
    availableLeaveDays,
    remainingLeaveDays: companyRemaining,
    totalLeaveDays: Math.max(totalLeaveDays(state.companyPolicy, selectedYear), companyRemaining),

    selectedYear,
    currentYear,
    availableYears,
    isFutureYear,
    leaveEntryType,
    needsLeaveInput: !hasLeaveForYear,
    leaveWallet: state.leaveWallet,
    leaveAmountHint: describeLeaveAmount(companyRemaining),
    setSelectedYear: (year) =>
      setSelectedYearState(sanitizeYear(year, availableYears, currentYear)),
    setLeaveDaysForYear: (year, days) =>
      setState((current) => ({
        ...current,
        leaveWallet: setLeaveDays(current.leaveWallet, year, days, currentYear),
      })),
    today,
    leaveExpiryDate,
    syncStatus,
    result,

    setWorkPattern: (workPattern) => setState((s) => ({ ...s, workPattern })),
    setStrategy: (strategy) => setState((s) => ({ ...s, strategy })),
    /*
     * 남은/예상 연차는 "지금 보고 있는 연도"의 지갑 항목에 저장한다.
     * 연도별로 완전히 분리되므로 2026년 값을 바꿔도 2027년 값은 그대로다.
     * 회사 휴가제도의 전체 휴가일수(리프레시휴가 등)와도 서로 영향을 주지 않는다.
     */
    setRemainingLeaveDays: (value) =>
      setState((current) => ({
        ...current,
        leaveWallet: setLeaveDays(current.leaveWallet, selectedYear, value, currentYear),
        // 올해 값은 회사 휴가제도 화면과도 맞춰 둔다(기존 화면 호환).
        companyPolicy:
          selectedYear === currentYear
            ? { ...current.companyPolicy, remainingLeaveDays: sanitizeLeaveDays(value) }
            : current.companyPolicy,
      })),
    updateCompanyPolicy: (companyPolicy) => setState((s) => ({ ...s, companyPolicy })),
    toggleSavedRange: (range) =>
      setState((s) => ({
        ...s,
        savedRanges: s.savedRanges.some((item) => item.candidateId === range.candidateId)
          ? s.savedRanges.filter((item) => item.candidateId !== range.candidateId)
          : [...s.savedRanges, range],
      })),
    isRangeSaved: (candidateId) =>
      state.savedRanges.some((item) => item.candidateId === candidateId),
    toggleManualLeaveDate: (date) =>
      setState((s) => ({
        ...s,
        manualLeaveDates: s.manualLeaveDates.includes(date)
          ? s.manualLeaveDates.filter((item) => item !== date)
          : [...s.manualLeaveDates, date].sort(),
      })),
    clearManualLeaveDates: () => setState((s) => ({ ...s, manualLeaveDates: [] })),
    // 추천된 휴가일을 취소한다. 예산은 그대로이므로 엔진이 다른 날로 다시 배치한다.
    excludeDate: (date) =>
      setState((s) =>
        s.excludedDates.includes(date)
          ? s
          : { ...s, excludedDates: [...s.excludedDates, date].sort() },
      ),
    clearExcludedDates: () => setState((s) => ({ ...s, excludedDates: [] })),
    markCalculated: () => {
      writeSessionCalculated(true);
      setHasCalculated(true);
    },
    resetCalculation: () => {
      writeSessionCalculated(false);
      setHasCalculated(false);
    },
    completeOnboarding: () => setState((s) => ({ ...s, onboardingComplete: true })),
    restartOnboarding: () => setState((s) => ({ ...s, onboardingComplete: false })),
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used within PlannerProvider");
  return ctx;
}

/** URL 의 ?year= 값을 읽는다. 검증은 호출부에서 한다. */
function readYearFromUrl(): unknown {
  if (typeof window === "undefined") return undefined;
  // HashRouter 를 쓰므로 해시 뒤 쿼리와 일반 쿼리를 모두 살펴본다.
  const search = new URLSearchParams(window.location.search).get("year");
  if (search) return search;
  const hash = window.location.hash;
  const index = hash.indexOf("?");
  if (index === -1) return undefined;
  return new URLSearchParams(hash.slice(index + 1)).get("year") ?? undefined;
}

/** 올해면 파라미터를 지우고, 미래 연도면 ?year= 를 남긴다. */
function writeYearToUrl(year: number, currentYear: number): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (year === currentYear) url.searchParams.delete("year");
  else url.searchParams.set("year", String(year));
  window.history.replaceState(null, "", url.toString());
}

const SESSION_CALCULATED_KEY = "hyugayojeong-session-calculated";

/** 이 탭에서 이미 연차 질문을 통과했는지. 저장소를 못 쓰면 질문부터 보여준다. */
function readSessionCalculated(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_CALCULATED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSessionCalculated(value: boolean): void {
  try {
    if (value) window.sessionStorage.setItem(SESSION_CALCULATED_KEY, "1");
    else window.sessionStorage.removeItem(SESSION_CALCULATED_KEY);
  } catch {
    // 저장에 실패해도 이번 화면 전환은 메모리 상태로 그대로 동작한다.
  }
}
