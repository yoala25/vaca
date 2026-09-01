import { describe, expect, it } from "vitest";
import { calculateVacationScore, gradeFor } from "../vacationScore";
import { pickTopChances, scoreAllCandidates } from "../vacationRanking";
import { annotateHighlights, buildMonthlyRadar } from "../monthlyVacationRadar";
import { moodForScore, pickMascotMessage } from "../mascotMessages";
import { asLocalDate, type ScoredCandidate, type VacationCandidate } from "../../../domain/vacation";

/** 점수 계산에 필요한 필드만 채운 최소 후보. */
function makeCandidate(over: {
  id: string;
  start: string;
  end: string;
  leaveDays: number;
  restDays: number;
  freeDays: number;
}): VacationCandidate {
  const free = Array.from({ length: over.freeDays }, (_, i) =>
    asLocalDate(`2030-01-${String(i + 1).padStart(2, "0")}`),
  );
  return {
    id: over.id,
    startDate: asLocalDate(over.start),
    endDate: asLocalDate(over.end),
    restStartDateTime: `${over.start}T18:00` as never,
    restEndDateTime: `${over.end}T09:00` as never,
    totalCalendarDays: over.restDays,
    totalRestMinutes: over.restDays * 1440,
    consecutiveFullRestDays: over.restDays,
    annualLeaveMinutesUsed: over.leaveDays * 480,
    hourlyLeaveMinutesUsed: 0,
    specialLeaveMinutesUsed: 0,
    totalLeaveMinutesUsed: over.leaveDays * 480,
    annualLeaveEquivalentDays: over.leaveDays,
    leaveUsages: [],
    leaveDates: [],
    weekendDates: free,
    publicHolidayDates: [],
    substituteHolidayDates: [],
    companyHolidayDates: [],
    efficiencyScore: over.restDays / over.leaveDays,
    reasonCodes: [],
    travelSuitability: "SHORT_TRIP",
    metadata: {},
  };
}

const asScored = (candidates: VacationCandidate[]): ScoredCandidate[] =>
  candidates.map((candidate) => ({
    candidate,
    score: 0,
    breakdown: {
      baseScore: 0,
      durationScore: 0,
      efficiencyScore: 0,
      spacingScore: 0,
      preferenceScore: 0,
      holidayConnectionBonus: 0,
      penalties: [],
      finalScore: 0,
    },
  }));

describe("휴가 효율 점수", () => {
  it("연차 2일 → 7일 휴식은 대박 구간(90점 이상)이다", () => {
    const score = calculateVacationScore(
      makeCandidate({ id: "a", start: "2030-10-03", end: "2030-10-09", leaveDays: 2, restDays: 7, freeDays: 5 }),
    );
    expect(score.leverage).toBe(3.5);
    expect(score.score).toBeGreaterThanOrEqual(90);
    expect(score.grade.label).toBe("대박 찬스");
  });

  it("연차를 많이 쓰고 조금 쉬는 조합은 낮은 점수를 받는다", () => {
    const good = calculateVacationScore(
      makeCandidate({ id: "g", start: "2030-05-01", end: "2030-05-04", leaveDays: 1, restDays: 4, freeDays: 3 }),
    );
    const bad = calculateVacationScore(
      makeCandidate({ id: "b", start: "2030-06-01", end: "2030-06-10", leaveDays: 6, restDays: 10, freeDays: 4 }),
    );
    expect(good.score).toBeGreaterThan(bad.score);
    expect(bad.score).toBeLessThan(60);
  });

  it("점수는 항상 0~100 범위이고 연차 0이면 0점이다", () => {
    const zero = calculateVacationScore(
      makeCandidate({ id: "z", start: "2030-01-01", end: "2030-01-02", leaveDays: 0, restDays: 2, freeDays: 2 }),
    );
    expect(zero.score).toBe(0);

    const extreme = calculateVacationScore(
      makeCandidate({ id: "x", start: "2030-01-01", end: "2030-01-20", leaveDays: 1, restDays: 20, freeDays: 19 }),
    );
    expect(extreme.score).toBeLessThanOrEqual(100);
    expect(extreme.score).toBeGreaterThanOrEqual(0);
  });

  it("등급 경계가 정의대로 나뉜다", () => {
    expect(gradeFor(95).label).toBe("대박 찬스");
    expect(gradeFor(85).label).toBe("강력 추천");
    expect(gradeFor(75).label).toBe("괜찮은 선택");
    expect(gradeFor(65).label).toBe("무난해요");
    expect(gradeFor(30).label).toBe("다른 날짜도 찾아볼까요?");
  });
});

describe("TOP 3 선정", () => {
  const pool = asScored([
    makeCandidate({ id: "eff", start: "2030-10-03", end: "2030-10-09", leaveDays: 2, restDays: 7, freeDays: 5 }),
    makeCandidate({ id: "long", start: "2030-09-01", end: "2030-09-12", leaveDays: 6, restDays: 12, freeDays: 6 }),
    makeCandidate({ id: "thrift", start: "2030-05-01", end: "2030-05-04", leaveDays: 1, restDays: 4, freeDays: 3 }),
    makeCandidate({ id: "small", start: "2030-03-01", end: "2030-03-03", leaveDays: 1, restDays: 3, freeDays: 2 }),
  ]);

  it("세 가지 기준이 각각 다른 후보를 고른다", () => {
    const chances = pickTopChances(scoreAllCandidates(pool));
    expect(chances).toHaveLength(3);
    expect(chances.map((c) => c.category)).toEqual(["efficiency", "longest", "thrifty"]);
    expect(new Set(chances.map((c) => c.candidate.id)).size).toBe(3);
  });

  it("장기휴가왕은 가장 긴 조합, 연차절약왕은 4일 이상이면서 연차가 가장 적은 조합", () => {
    const chances = pickTopChances(scoreAllCandidates(pool));
    const longest = chances.find((c) => c.category === "longest")!;
    const thrifty = chances.find((c) => c.category === "thrifty")!;
    expect(longest.candidate.id).toBe("long");
    expect(thrifty.restDays).toBeGreaterThanOrEqual(4);
    expect(thrifty.candidate.id).toBe("thrift");
  });

  it("후보가 없으면 빈 배열을 돌려준다", () => {
    expect(pickTopChances([])).toEqual([]);
  });

  it("후보가 하나뿐이면 중복 노출하지 않는다", () => {
    const single = asScored([
      makeCandidate({ id: "only", start: "2030-10-03", end: "2030-10-09", leaveDays: 2, restDays: 7, freeDays: 5 }),
    ]);
    const chances = pickTopChances(scoreAllCandidates(single));
    expect(chances).toHaveLength(1);
  });
});

describe("휴가 레이더", () => {
  const entries = scoreAllCandidates(
    asScored([
      makeCandidate({ id: "oct1", start: "2030-10-03", end: "2030-10-09", leaveDays: 2, restDays: 7, freeDays: 5 }),
      makeCandidate({ id: "oct2", start: "2030-10-15", end: "2030-10-18", leaveDays: 1, restDays: 4, freeDays: 3 }),
      makeCandidate({ id: "mar", start: "2030-03-01", end: "2030-03-03", leaveDays: 1, restDays: 3, freeDays: 2 }),
    ]),
  );

  it("12개월을 모두 돌려주고, 기회가 없는 달은 0등급이다", () => {
    const radar = buildMonthlyRadar(entries, 2030);
    expect(radar).toHaveLength(12);
    expect(radar.map((m) => m.month)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
    expect(radar.find((m) => m.month === 7)!.level).toBe(0);
  });

  it("좋은 조합이 많은 달이 더 높은 등급을 받는다", () => {
    const radar = buildMonthlyRadar(entries, 2030);
    const october = radar.find((m) => m.month === 10)!;
    const march = radar.find((m) => m.month === 3)!;
    expect(october.level).toBeGreaterThan(march.level);
    expect(october.chanceCount).toBe(2);
    expect(october.best?.id).toBe("oct1");
  });

  it("최고의 달에 한 줄 설명이 붙는다", () => {
    const radar = annotateHighlights(buildMonthlyRadar(entries, 2030));
    expect(radar.find((m) => m.month === 10)!.highlight).toBe("올해 최고의 휴가 찬스!");
  });

  it("다른 연도 후보는 섞이지 않는다", () => {
    const radar = buildMonthlyRadar(entries, 2031);
    expect(radar.every((m) => m.level === 0)).toBe(true);
  });
});

describe("휴가요정 메시지", () => {
  it("상황에 맞는 말투를 고른다", () => {
    expect(moodForScore(0, 0)).toBe("empty");
    expect(moodForScore(92, 3)).toBe("great");
    expect(moodForScore(70, 3)).toBe("found");
    expect(moodForScore(50, 3)).toBe("weak");
  });

  it("같은 결과에는 같은 문구, 다른 결과에는 다른 문구가 나올 수 있다", () => {
    const a = pickMascotMessage({ mood: "great", seed: "x", leaveDays: 2, restDays: 7 });
    const b = pickMascotMessage({ mood: "great", seed: "x", leaveDays: 2, restDays: 7 });
    expect(a).toBe(b);

    const seeds = ["a", "b", "c", "d", "e", "f"].map((s) =>
      pickMascotMessage({ mood: "great", seed: s, leaveDays: 2, restDays: 7 }),
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("치환자가 실제 숫자로 바뀐다", () => {
    const text = pickMascotMessage({ mood: "great", seed: "seed0", leaveDays: 2, restDays: 7 });
    expect(text).not.toContain("{leave}");
    expect(text).not.toContain("{rest}");
  });
});
