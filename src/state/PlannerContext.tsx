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
  todayInSeoul,
  type CompanyHoliday,
  type LocalDate,
  type VacationOptimizationResult,
  type VacationOverlayRange,
} from "../domain/vacation";
import {
  DEFAULT_COMPANY_POLICY,
  remainingLeaveDays,
  resolveLeaveExpiryDate,
  totalLeaveDays,
  type CompanyPolicy,
} from "../data/companyPolicy";
import { getHolidaySet } from "../data/holidayProvider";
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
  /** 게스트가 연차를 입력하고 "계산하기"를 눌렀는지. */
  hasCalculated: boolean;
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
  hasCalculated: false,
  onboardingComplete: false,
  companyPolicy: DEFAULT_COMPANY_POLICY,
};

function loadState(storageKey: string): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      companyPolicy: { ...DEFAULT_COMPANY_POLICY, ...(parsed.companyPolicy ?? {}) },
    };
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
  /** 사용자가 입력한 남은 연차(직접 추가분 차감 전). */
  remainingLeaveDays: number;
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
        setState({
          ...DEFAULT_STATE,
          ...result.state,
          companyPolicy: { ...DEFAULT_COMPANY_POLICY, ...(result.state.companyPolicy ?? {}) },
        });
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
  const leaveExpiryDate = useMemo(
    () => resolveLeaveExpiryDate(state.companyPolicy, today),
    [state.companyPolicy, today],
  );

  const companyRemaining = remainingLeaveDays(state.companyPolicy);
  // 직접 찍은 휴가는 이미 쓰기로 한 연차이므로 추천 예산에서 뺀다.
  const availableLeaveDays = Math.max(0, companyRemaining - state.manualLeaveDates.length);

  const result = useMemo(() => {
    const dateRange = {
      startDate: today,
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

    const leaveCatalog = createDefaultLeaveCatalog({
      annualRemainingMinutes: availableLeaveDays * state.companyPolicy.dailyWorkMinutes,
      annualTotalMinutes: totalLeaveDays(state.companyPolicy) * state.companyPolicy.dailyWorkMinutes,
      halfDayEnabled: state.companyPolicy.halfDayEnabled,
      hourlyUnitMinutes: state.companyPolicy.hourlyUnitMinutes,
      standardDailyWorkMinutes: state.companyPolicy.dailyWorkMinutes,
      validUntil: leaveExpiryDate,
    });

    return engine.optimize({
      dateRange,
      workSchedule,
      holidays: getHolidaySet(dateRange.startDate, dateRange.endDate),
      companyHolidays,
      leaveCatalog,
      strategy: state.strategy,
      // 직접 찍은 날은 추천이 중복해서 쓰지 않도록, 취소한 날은 다시 제안하지 않도록 제외한다.
      preferences: { blockedDates: [...state.manualLeaveDates, ...state.excludedDates] },
    });
  }, [
    today,
    leaveExpiryDate,
    availableLeaveDays,
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
    hasCalculated: state.hasCalculated,
    onboardingComplete: state.onboardingComplete,
    availableLeaveDays,
    remainingLeaveDays: companyRemaining,
    totalLeaveDays: totalLeaveDays(state.companyPolicy),
    today,
    leaveExpiryDate,
    syncStatus,
    result,

    setWorkPattern: (workPattern) => setState((s) => ({ ...s, workPattern })),
    setStrategy: (strategy) => setState((s) => ({ ...s, strategy })),
    /*
     * 남은 연차는 사용자가 입력한 값을 그대로 저장한다.
     * 회사 휴가제도에서 전체 휴가일수(리프레시휴가 등)를 바꿔도 이 값은 건드리지 않는다.
     */
    setRemainingLeaveDays: (value) =>
      setState((s) => ({
        ...s,
        companyPolicy: {
          ...s.companyPolicy,
          remainingLeaveDays: Math.max(0, Math.min(90, value)),
        },
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
    markCalculated: () => setState((s) => ({ ...s, hasCalculated: true })),
    resetCalculation: () => setState((s) => ({ ...s, hasCalculated: false })),
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
