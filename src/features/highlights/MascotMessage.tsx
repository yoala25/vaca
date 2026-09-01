import styles from "./Highlights.module.css";
import { slothChatAvatar } from "../../assets/mascot";

export function MascotMessage({ text }: { text: string }) {
  return (
    <div className={styles.mascotRow}>
      <span className={styles.mascotAvatar}>
        <img src={slothChatAvatar} alt="" />
      </span>
      <div className={styles.mascotBubble}>
        <p className={styles.mascotName}>휴가요정</p>
        <p className={styles.mascotText}>{text}</p>
      </div>
    </div>
  );
}
