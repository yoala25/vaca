import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./OnboardingHeader.module.css";

interface OnboardingHeaderProps {
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
}

export function OnboardingHeader({
  title = "휴가요정",
  right,
  onBack,
  showBack = true,
}: OnboardingHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.header}>
      {showBack ? (
        <button
          type="button"
          className={styles.backBtn}
          aria-label="뒤로"
          onClick={onBack ?? (() => navigate(-1))}
        >
          ‹
        </button>
      ) : (
        <span className={styles.backBtn} />
      )}
      <span className={styles.titlePill}>{title}</span>
      <span className={styles.right}>{right}</span>
    </div>
  );
}
