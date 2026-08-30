import type { ReactNode } from "react";
import styles from "./ChatBubble.module.css";
import { slothChatAvatar } from "../../assets/mascot";

export function MascotBubble({ children }: { children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.avatar}>
        <img src={slothChatAvatar} alt="휴가요정" />
      </span>
      <p className={styles.bubble}>{children}</p>
    </div>
  );
}

export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.row} ${styles.rowUser}`}>
      <p className={`${styles.bubble} ${styles.bubbleUser}`}>{children}</p>
    </div>
  );
}
