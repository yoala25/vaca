import type { ReactNode } from "react";
import styles from "./Ui.module.css";

/** 카드 한 장. */
export function Card({
  title,
  sub,
  actions,
  children,
}: {
  title?: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.card}>
      {(title || actions) && (
        <div className={styles.cardHead}>
          {title && <h2 className={styles.cardTitle}>{title}</h2>}
          {sub && <span className={styles.cardSub}>{sub}</span>}
          {actions && <div className={styles.cardActions}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** 큰 숫자 하나를 보여주는 KPI 카드. */
export function Kpi({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
  accent?: boolean;
}) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </span>
      <span className={`${styles.kpiValue} ${accent ? styles.kpiValueAccent : ""}`}>{value}</span>
      {hint && <span className={styles.kpiHint}>{hint}</span>}
    </div>
  );
}

/**
 * 로딩 / 오류 / 빈 데이터를 한 곳에서 처리한다.
 * 오류 메시지는 adminApi 가 이미 안전한 문구로 바꿔 놓은 것만 들어온다.
 */
export function DataState({
  loading,
  error,
  empty,
  emptyHint,
  height = 180,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyHint?: string;
  height?: number;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div style={{ height }}>
        <div className={styles.skeleton} />
      </div>
    );
  }
  if (error) {
    return (
      <div className={styles.state}>
        <span className={styles.stateIcon} aria-hidden>
          ⚠️
        </span>
        <span className={styles.stateTitle}>불러오지 못했어요</span>
        <span className={styles.stateHint}>{error}</span>
      </div>
    );
  }
  if (empty) {
    return (
      <div className={styles.state}>
        <span className={styles.stateIcon} aria-hidden>
          🗒️
        </span>
        <span className={styles.stateTitle}>아직 데이터 없음</span>
        {emptyHint && <span className={styles.stateHint}>{emptyHint}</span>}
      </div>
    );
  }
  return <>{children}</>;
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/**
 * 가로 막대 순위 차트.
 * 항목 이름이 길고 개수가 들쭉날쭉한 순위형 데이터에는
 * 세로 막대나 원형보다 가로 막대가 정확하게 읽힌다.
 */
export function BarList({
  data,
  total,
  color = "var(--a-s1)",
  format,
  showPercent = true,
}: {
  data: BarDatum[];
  /** 비율 계산의 분모. 없으면 최댓값 기준 상대 길이만 보여준다. */
  total?: number;
  color?: string;
  format?: (value: number) => string;
  showPercent?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const sum = total ?? data.reduce((acc, d) => acc + d.value, 0);
  const fmt = format ?? ((v: number) => v.toLocaleString("ko-KR"));

  return (
    <div className={styles.barList}>
      {data.map((datum) => (
        <div key={datum.label} className={styles.barRow}>
          <span className={styles.barLabel} title={datum.label}>
            {datum.label}
          </span>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              style={{
                width: `${Math.max(2, (datum.value / max) * 100)}%`,
                background: datum.color ?? color,
              }}
            />
          </span>
          <span className={styles.barValue}>
            {fmt(datum.value)}
            {showPercent && sum > 0 && (
              <span className={styles.barPercent}>
                {((datum.value / sum) * 100).toFixed(1)}%
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 안내 배너. */
export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn";
  children: ReactNode;
}) {
  return (
    <div className={`${styles.banner} ${tone === "warn" ? styles.bannerWarn : styles.bannerInfo}`}>
      {children}
    </div>
  );
}

export { styles as uiStyles };
