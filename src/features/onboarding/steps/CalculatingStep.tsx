import { useEffect, useState } from "react";
import styles from "./CalculatingStep.module.css";
import { slothLaptop } from "../../../assets/mascot";

const CHECK_ITEMS = [
  "공휴일과 대체공휴일 확인 중",
  "주말과 연결 가능한 구간 탐색 중",
  "연차를 최적으로 배분 중",
  "회사 제도 반영 가능성 분석 중",
];

interface CalculatingStepProps {
  onDone: () => void;
}

export function CalculatingStep({ onDone }: CalculatingStepProps) {
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    if (doneCount >= CHECK_ITEMS.length) {
      const finish = setTimeout(onDone, 500);
      return () => clearTimeout(finish);
    }
    const tick = setTimeout(() => setDoneCount((c) => c + 1), 550);
    return () => clearTimeout(tick);
  }, [doneCount, onDone]);

  return (
    <div className={styles.wrap}>
      <img className={styles.mascot} src={slothLaptop} alt="분석 중인 휴가요정" />
      <p className={styles.title}>
        당신에게 가장 좋은
        <br />
        <span className={styles.highlight}>휴가 조합을 찾고 있어요...</span>
      </p>
      <div className={styles.checklist}>
        {CHECK_ITEMS.map((item, i) => (
          <div key={item} className={`${styles.item} ${i < doneCount ? styles.itemDone : ""}`}>
            <span className={`${styles.check} ${i < doneCount ? styles.checkDone : ""}`}>✓</span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
