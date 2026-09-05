import { useState } from "react";
import { MascotBubble, UserBubble } from "../ChatBubble";
import styles from "./LeaveStep.module.css";
import { sanitizeLeaveDays } from "../../../lib/validation";

const LEAVE_QUICK_OPTIONS = [3, 5, 7, 10];

interface LeaveStepProps {
  answered: number | null;
  onSelect: (value: number) => void;
}

export function LeaveStep({ answered, onSelect }: LeaveStepProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  return (
    <div>
      <MascotBubble>반가워요! 🦥</MascotBubble>
      <MascotBubble>
        올해 남은 연차를 알려주시면 최적의 휴가를 찾아드릴게요.
      </MascotBubble>
      <MascotBubble>먼저, 올해 남은 연차가 며칠인가요?</MascotBubble>

      {answered != null && (
        <>
          <UserBubble>{answered}일</UserBubble>
          <MascotBubble>좋아요! {answered}일이면 멋진 조합을 만들 수 있어요. ✨</MascotBubble>
        </>
      )}

      <div className={styles.chips}>
        {LEAVE_QUICK_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.chip} ${answered === n ? styles.chipSelected : ""}`}
            onClick={() => onSelect(n)}
          >
            {n}일
          </button>
        ))}
        <button
          key="10+"
          type="button"
          className={`${styles.chip} ${answered != null && answered > 10 ? styles.chipSelected : ""}`}
          onClick={() => onSelect(12)}
        >
          10일+
        </button>
      </div>

      {!customOpen ? (
        <button type="button" className={styles.customLink} onClick={() => setCustomOpen(true)}>
          직접 입력하기
        </button>
      ) : (
        <div className={styles.customInputRow}>
          <input
            className={styles.customInput}
            type="number"
            min={0}
            step={0.5}
            placeholder="예: 8.5"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
          />
          <button
            type="button"
            className={styles.customConfirm}
            onClick={() => {
              const parsed = sanitizeLeaveDays(customValue, 0);
              if (parsed > 0) onSelect(parsed);
            }}
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
