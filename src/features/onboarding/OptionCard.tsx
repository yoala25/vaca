import styles from "./OptionCard.module.css";

interface OptionCardProps {
  icon: string;
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

export function OptionCard({ icon, title, description, selected, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles.selected : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {description && <span className={styles.desc}>{description}</span>}
      </span>
      <span className={`${styles.check} ${selected ? styles.checkSelected : ""}`}>✓</span>
    </button>
  );
}
