import { useCallback } from "react";
import { DayOfWeek, dayOfWeek, type LocalDate } from "../domain/vacation";
import { usePlanner } from "../state/PlannerContext";

/**
 * 사용자의 근무 요일 설정에 따라 "그 요일에 출근하는가"를 판정한다.
 * 달력이 어떤 날을 클릭 가능한 평일로 볼지 결정할 때 쓴다.
 */
export function useWorkingWeekday(): (date: LocalDate) => boolean {
  const { workPattern } = usePlanner();

  return useCallback(
    (date: LocalDate) => {
      const dow = dayOfWeek(date);
      if (dow === DayOfWeek.Sunday) return false;
      if (dow === DayOfWeek.Saturday) return workPattern === "mon-sat";
      return true;
    },
    [workPattern],
  );
}
