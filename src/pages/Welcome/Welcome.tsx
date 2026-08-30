import { useNavigate } from "react-router-dom";
import styles from "./Welcome.module.css";
import { slothHammock } from "../../assets/mascot";

export function Welcome() {
  const navigate = useNavigate();

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.brand}>휴가요정</span>
        <button type="button" className={styles.skip} onClick={() => navigate("/")}>
          건너뛰기
        </button>
      </div>

      <h1 className={styles.headline}>
        올해 연차,
        <br />
        어떻게 쓰면
        <br />
        제일 잘 쉴 수 있을까요?
      </h1>
      <p className={styles.subtitle}>
        휴가요정이 공휴일과 주말을 분석해서
        <br />
        당신만의 최적 휴가 플랜을 만들어드릴게요!
      </p>

      <div className={styles.mascotWrap}>
        <img className={styles.mascot} src={slothHammock} alt="휴가요정" />
      </div>

      <button type="button" className={styles.cta} onClick={() => navigate("/onboarding/leave")}>
        30초 만에 휴가 찾기
      </button>
      <p className={styles.caption}>회원가입 없이 바로 시작할 수 있어요</p>
    </div>
  );
}
