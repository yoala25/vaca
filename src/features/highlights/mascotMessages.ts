/**
 * 휴가요정 말풍선 문구.
 * 상황마다 여러 개를 두고, 결과에 따라 안정적으로 하나를 고른다
 * (렌더링할 때마다 문구가 바뀌면 산만하므로 무작위 대신 결과 기반 해시를 쓴다).
 */

export type MascotMood =
  | "searching"
  | "found"
  | "great"
  | "weak"
  | "empty"
  /** 미래 연도를 미리 시뮬레이션할 때 */
  | "futureGreat"
  | "futureFound"
  | "futureEmpty";

const MESSAGES: Record<MascotMood, string[]> = {
  searching: [
    "잠깐만요! 휴가요정이 달력을 뒤지는 중… 🔍",
    "공휴일 사이에 숨은 휴가를 찾고 있어요.",
    "연차를 어디에 놓아야 제일 길게 쉴지 계산 중이에요.",
    "주말이랑 붙는 날을 살펴보는 중이에요 👀",
  ],
  great: [
    "찾았다! ✨ 연차 {leave}일로 {rest}일 쉴 수 있어요!",
    "이 조합은 놓치면 아까워요 😎",
    "올해 이만한 기회는 흔치 않아요!",
    "연차 {leave}일이 {rest}일이 됐어요. 남는 장사예요 🎉",
  ],
  found: [
    "연차 {leave}일로 {rest}일 휴식, 나쁘지 않죠?",
    "이 정도면 여행 계획 세워도 좋아요 🧳",
    "달력을 뒤져서 {count}개 조합을 찾아왔어요.",
    "쉴 만한 자리를 몇 군데 찾아뒀어요 🌴",
  ],
  weak: [
    "음… 이건 연차가 조금 아까워요.",
    "조금만 날짜를 바꾸면 더 길게 쉴 수 있어요!",
    "다른 전략도 눌러보시면 더 좋은 조합이 있을지도 몰라요.",
    "연차를 몰아 쓰면 더 길게 쉴 수 있어요 🤔",
  ],
  empty: [
    "앗, 지금 조건으로는 찾을 수 있는 조합이 없어요.",
    "남은 연차를 늘리거나 소멸일을 확인해 주세요.",
    "연차가 1일 이상 있어야 계산할 수 있어요!",
  ],
  futureGreat: [
    "{year}년에 이런 황금연휴가 숨어 있었어요! ✨",
    "미리 봤더니 연차 {leave}일로 {rest}일이나 쉴 수 있어요 🎉",
    "{year}년 최고의 기회, 지금 찜해두면 마음이 편해요 😎",
    "벌써 {year}년 여행 계획이 그려지지 않나요? 🧳",
  ],
  futureFound: [
    "{year}년 휴가를 미리 짜볼까요?",
    "휴가요정이 {year}년 연휴를 미리 찾아드릴게요 ✨",
    "{year}년 연차, 어디에 쓰면 가장 이득일까요?",
    "미리 본 {year}년, 쉴 자리가 {count}군데 있어요 🌴",
  ],
  futureEmpty: [
    "{year}년 예상 연차를 조금만 더 넣어볼까요?",
    "연차가 1일 이상 있어야 {year}년을 그려볼 수 있어요!",
    "{year}년은 아직 비어 있어요. 예상 연차를 알려주세요 🧚",
  ],
};

/** 문자열을 안정적인 숫자로 접는다(문구 고정용). */
function hash(seed: string): number {
  let value = 0;
  for (let i = 0; i < seed.length; i++) {
    value = (value * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(value);
}

export interface MascotMessageInput {
  mood: MascotMood;
  seed: string;
  leaveDays?: number;
  restDays?: number;
  count?: number;
  /** 시뮬레이션 중인 연도. 미래 연도 문구에서 쓴다. */
  year?: number;
}

export function pickMascotMessage({
  mood,
  seed,
  leaveDays,
  restDays,
  count,
  year,
}: MascotMessageInput): string {
  const pool = MESSAGES[mood];
  const template = pool[hash(seed) % pool.length];
  return template
    .replace("{leave}", String(leaveDays ?? 0))
    .replace("{rest}", String(restDays ?? 0))
    .replace("{count}", String(count ?? 0))
    .replace("{year}", String(year ?? ""));
}

/**
 * 최고 점수에 따라 어떤 말투를 쓸지 정한다.
 * 미래 연도는 "올해"를 전제로 한 문구가 어색하므로 별도 말투를 쓴다.
 */
export function moodForScore(
  bestScore: number,
  chanceCount: number,
  isFutureYear = false,
): MascotMood {
  if (isFutureYear) {
    if (chanceCount === 0) return "futureEmpty";
    return bestScore >= 85 ? "futureGreat" : "futureFound";
  }
  if (chanceCount === 0) return "empty";
  if (bestScore >= 85) return "great";
  if (bestScore >= 65) return "found";
  return "weak";
}
