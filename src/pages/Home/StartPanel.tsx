import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./StartPanel.module.css";
import { slothBeach } from "../../assets/mascot";
import { usePlanner } from "../../state/PlannerContext";
import { describeLeaveExpiry } from "../../data/companyPolicy";

const QUICK_OPTIONS = [3, 5, 7.5, 10, 15];

/**
 * 로그인 없이 들어온 사용자가 가장 먼저 보는 화면.
 * 남은 연차만 입력받고 "계산하기"를 누르면 시뮬레이터로 넘어간다.
 */
export function StartPanel() {
  const navigate = useNavigate();
  const { remainingLeaveDays, setRemainingLeaveDays, markCalculated, companyPolicy, today } =
    usePlanner();
  const [draft, setDraft] = useState<string>(String(remainingLeaveDays));

  const parsed = Number(draft);
  const isValid = Number.isFinite(parsed) && parsed > 0 && parsed <= 60;

  const calculate = () => {
    if (!isValid) return;
    setRemainingLeaveDays(parsed);
    markCalculated();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <img className={styles.mascot} src={slothBeach} alt="휴가요정" />

        <p className={styles.hello}>안녕하세요 👋</p>
        <h1 className={styles.title}>
          올해 남은 연차가
          <br />
          며칠인가요?
        </h1>

        <div className={styles.inputRow}>
          <input
            className={styles.input}
            type="number"
            min={0.5}
            max={60}
            step={0.5}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && calculate()}
            aria-label="남은 연차 일수"
            autoFocus
          />
          <span className={styles.unit}>일</span>
        </div>

        <div className={styles.quickRow}>
          {QUICK_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.quickChip} ${
                parsed === value ? styles.quickChipActive : ""
              }`}
              onClick={() => setDraft(String(value))}
            >
              {value}일
            </button>
          ))}
        </div>

        <p className={styles.expiry}>
          {describeLeaveExpiry(companyPolicy, today)}까지 쓸 수 있는 연차 기준이에요.
          <button
            type="button"
            className={styles.expiryLink}
            onClick={() => navigate("/company")}
          >
            변경
          </button>
        </p>

        <button type="button" className={styles.cta} disabled={!isValid} onClick={calculate}>
          계산하기 ✨
        </button>

        <p className={styles.caption}>회원가입 없이 바로 확인할 수 있어요</p>
      </div>
    </div>
  );
}
