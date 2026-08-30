import {
  candidateOverlapRatio,
  leaveDateSimilarity,
  type VacationCandidate,
} from "../models/vacation-candidate";

const DEFAULT_OVERLAP_THRESHOLD = 0.8;
/**
 * 0.5로 두면 {금} 과 {금,월}이 0.5로 묶여, 단일 연결(single-linkage) 때문에
 * "금요일 반차"와 "월요일 반차"가 조합 후보를 다리 삼아 한 클러스터가 되어버린다.
 * 0.6이면 "휴가 날짜가 대부분 같은" 후보만 묶이고 서로 다른 선택지는 살아남는다.
 */
const DEFAULT_LEAVE_SIMILARITY_THRESHOLD = 0.6;
const DEFAULT_MAX_PER_CLUSTER = 4;

/**
 * A가 B에게 완전히 지배되는가?
 * B가 A보다 휴가를 더 쓰지 않으면서, A가 쉬는 시간을 전부 포함하면 A는 버려도 된다.
 *
 * 기간 비교에 날짜(startDate~endDate)가 아니라 실제 휴식 구간을 쓰는 것이 중요하다.
 * 같은 주말에 "금요일 오후반차"와 "월요일 오전반차"를 붙인 두 후보는 코어 날짜가 같아서
 * 날짜만 보면 한쪽이 다른 쪽을 지배해 버리지만, 사용자에게는 전혀 다른 선택지다.
 *
 * 아래 removeDominatedCandidates가 이 규칙을 스윕으로 구현한다. 이 함수는 규칙을 그대로
 * 표현한 참조 구현으로, 테스트에서 스윕 결과를 검증하는 데 쓴다.
 */
export function isDominatedBy(a: VacationCandidate, b: VacationCandidate): boolean {
  if (a.id === b.id) return false;

  const coversPeriod =
    b.restStartDateTime <= a.restStartDateTime && b.restEndDateTime >= a.restEndDateTime;
  if (!coversPeriod) return false;

  if (b.totalLeaveMinutesUsed > a.totalLeaveMinutesUsed) return false;

  // 최소 한 가지 지표에서 실제로 더 나아야 지배로 인정한다.
  return (
    b.totalLeaveMinutesUsed < a.totalLeaveMinutesUsed ||
    b.totalRestMinutes > a.totalRestMinutes
  );
}

/**
 * Pareto 지배 후보를 제거한다 (§22).
 *
 * 모든 쌍을 비교하면 후보가 수만 개일 때 O(n²)로 터진다. 대신 한 번의 스윕으로 끝낸다.
 *   - 휴식 시작 시각 오름차순으로 훑으면, 이미 본 후보는 전부 restStart가 앞선다.
 *   - 구간 포함(containment)은 restMinutes 대소를 자동으로 함의하므로,
 *     비용별로 "지금까지 본 최대 restEnd"만 들고 있으면 지배 여부를 판정할 수 있다.
 *   - 서로 다른 비용 값의 개수는 적으므로(보통 수십 개) 후보당 비교가 상수 시간이다.
 *
 * 판정은 보수적이다. 확실히 지배되는 경우만 제거하므로 좋은 후보를 잃지 않는다.
 */
export function removeDominatedCandidates(
  candidates: VacationCandidate[],
): VacationCandidate[] {
  const sorted = [...candidates].sort(
    (a, b) =>
      a.restStartDateTime.localeCompare(b.restStartDateTime) ||
      b.restEndDateTime.localeCompare(a.restEndDateTime) ||
      a.totalLeaveMinutesUsed - b.totalLeaveMinutesUsed,
  );

  const costLevels = [...new Set(sorted.map((c) => c.totalLeaveMinutesUsed))].sort((a, b) => a - b);
  const maxRestEndByCost = new Map<number, string>();
  const survivors: VacationCandidate[] = [];

  for (const candidate of sorted) {
    const cost = candidate.totalLeaveMinutesUsed;
    let dominated = false;

    for (const level of costLevels) {
      if (level > cost) break;
      const seenRestEnd = maxRestEndByCost.get(level);
      if (seenRestEnd === undefined) continue;

      // 더 싸면서 최소한 같은 시각까지 쉰다 → 확실히 지배
      if (level < cost && seenRestEnd >= candidate.restEndDateTime) {
        dominated = true;
        break;
      }
      // 같은 비용인데 더 늦게까지 쉰다 → 확실히 지배
      if (level === cost && seenRestEnd > candidate.restEndDateTime) {
        dominated = true;
        break;
      }
    }

    if (!dominated) survivors.push(candidate);

    const previous = maxRestEndByCost.get(cost);
    if (previous === undefined || candidate.restEndDateTime > previous) {
      maxRestEndByCost.set(cost, candidate.restEndDateTime);
    }
  }

  return survivors;
}

/**
 * 사실상 같은 연휴를 가리키는 후보들을 묶어 대표만 남긴다 (§23).
 *
 * 주의: 여기서 "대표 하나"만 남기면 안 된다. 전략마다 원하는 대표가 다르기 때문이다
 * (연차 절약은 싼 후보, 장기 집중은 긴 후보). 후보 풀은 전략과 무관하게 한 번만
 * 만들어 재사용하므로(§34), 클러스터마다 비용 수준별 Pareto 대표를 남긴다.
 */
export function clusterSimilarCandidates(
  candidates: VacationCandidate[],
  overlapThreshold = DEFAULT_OVERLAP_THRESHOLD,
  maxPerCluster = DEFAULT_MAX_PER_CLUSTER,
  leaveSimilarityThreshold = DEFAULT_LEAVE_SIMILARITY_THRESHOLD,
): VacationCandidate[] {
  const sorted = [...candidates].sort(
    (a, b) => b.totalRestMinutes - a.totalRestMinutes || a.startDate.localeCompare(b.startDate),
  );

  // 겹칠 수 없을 만큼 떨어진 후보끼리 비교하지 않도록 월 단위로 후보군을 나눈다.
  const clustersByMonth = new Map<string, VacationCandidate[][]>();
  const allClusters: VacationCandidate[][] = [];

  for (const candidate of sorted) {
    const month = candidate.startDate.slice(0, 7);
    const nearbyClusters = neighbouringMonths(month).flatMap(
      (key) => clustersByMonth.get(key) ?? [],
    );

    // 기간이 거의 같으면서 "휴가를 쓰는 날짜"까지 겹쳐야 같은 후보로 본다.
    // 기간만 보면 금요일 반차와 화요일 연차처럼 전혀 다른 선택지가 한데 묶인다.
    const cluster = nearbyClusters.find((members) =>
      members.some(
        (member) =>
          candidateOverlapRatio(member, candidate) >= overlapThreshold &&
          leaveDateSimilarity(member, candidate) >= leaveSimilarityThreshold,
      ),
    );

    if (cluster) {
      cluster.push(candidate);
      continue;
    }

    const created = [candidate];
    allClusters.push(created);
    const bucket = clustersByMonth.get(month);
    if (bucket) bucket.push(created);
    else clustersByMonth.set(month, [created]);
  }

  return allClusters.flatMap((members) => pickClusterRepresentatives(members, maxPerCluster));
}

/** `YYYY-MM` 기준 앞뒤 한 달까지 포함한 키 목록. */
function neighbouringMonths(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const shift = (delta: number) => {
    const total = year * 12 + (monthNumber - 1) + delta;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
  };
  return [shift(-1), month, shift(1)];
}

/** 비용 수준별로 가장 오래 쉬는 후보를 남긴다. */
function pickClusterRepresentatives(
  members: VacationCandidate[],
  maxPerCluster: number,
): VacationCandidate[] {
  const bestByCost = new Map<number, VacationCandidate>();

  for (const member of members) {
    const cost = member.totalLeaveMinutesUsed;
    const incumbent = bestByCost.get(cost);
    if (!incumbent || compareQuality(member, incumbent) < 0) {
      bestByCost.set(cost, member);
    }
  }

  return [...bestByCost.values()]
    .sort((a, b) => a.totalLeaveMinutesUsed - b.totalLeaveMinutesUsed)
    .slice(0, maxPerCluster);
}

/** 동점 상황에서도 결과가 흔들리지 않도록 하는 결정적 비교 (§44). */
export function compareQuality(a: VacationCandidate, b: VacationCandidate): number {
  if (b.totalRestMinutes !== a.totalRestMinutes) return b.totalRestMinutes - a.totalRestMinutes;
  if (a.totalLeaveMinutesUsed !== b.totalLeaveMinutesUsed) {
    return a.totalLeaveMinutesUsed - b.totalLeaveMinutesUsed;
  }
  if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
  return a.id.localeCompare(b.id);
}
