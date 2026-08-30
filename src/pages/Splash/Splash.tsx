import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Splash.module.css";
import { slothBeach } from "../../assets/mascot";

export function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/welcome"), 1400);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <button
      type="button"
      className={styles.wrap}
      style={{ border: "none", width: "100%" }}
      onClick={() => navigate("/welcome")}
    >
      <img className={styles.mascot} src={slothBeach} alt="휴가요정" />
      <h1 className={styles.title}>휴가요정</h1>
      <p className={styles.subtitle}>
        당신의 연차를 가장
        <br />
        행복한 휴가로 만들어드려요
      </p>
    </button>
  );
}
