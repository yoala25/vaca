import { useMemo, useState } from "react";
import styles from "./Ui.module.css";

/**
 * 다중 시리즈 꺾은선 차트.
 *
 * 차트 라이브러리를 넣지 않고 인라인 SVG 로 그린다.
 * Recharts/Chart.js 는 gzip 기준 40~90KB 를 더한다. 지금 필요한 것은
 * 선 몇 개와 툴팁뿐이고, 이 앱은 이미 달력·게이지를 직접 SVG 로 그리고 있어
 * 같은 방식이 구조에도 맞는다. 번들 증가 0KB.
 *
 * 색은 검증된 카테고리 팔레트 1~4번 슬롯을 고정 순서로 쓴다(돌려쓰지 않음).
 * 라이트 모드에서 일부 색이 표면 대비 3:1 미만이라, 규칙에 따라
 * 범례 + 직접 라벨 + 표 보기를 함께 제공한다.
 */

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface TrendChartProps {
  labels: string[];
  series: TrendSeries[];
  height?: number;
  /** 값 포맷(툴팁·축) */
  format?: (value: number) => string;
}

const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function TrendChart({ labels, series, height = 240, format }: TrendChartProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const visible = series.filter((s) => !hidden.has(s.key));
  const width = 720; // viewBox 기준. 실제 크기는 CSS 가 늘린다.

  const max = useMemo(() => {
    const peak = Math.max(1, ...visible.flatMap((s) => s.values));
    return niceMax(peak);
  }, [visible]);

  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const stepX = labels.length > 1 ? plotW / (labels.length - 1) : 0;

  const xAt = (i: number) => PAD_L + i * stepX;
  const yAt = (v: number) => PAD_T + plotH - (v / max) * plotH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  // x축 라벨은 겹치지 않을 만큼만 남긴다.
  const labelStride = Math.max(1, Math.ceil(labels.length / 8));

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      // 마지막 하나까지 끄면 빈 차트가 되므로 막는다.
      else if (visible.length > 1) next.add(key);
      return next;
    });

  const fmt = format ?? ((v: number) => v.toLocaleString("ko-KR"));

  return (
    <div className={styles.chartBox}>
      <svg
        className={styles.chartSvg}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${series.map((s) => s.label).join(", ")} 추세`}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const x = ratio * width;
          const index = Math.round((x - PAD_L) / (stepX || 1));
          setHoverIndex(index >= 0 && index < labels.length ? index : null);
        }}
      >
        {/* 격자와 y축 눈금 — 데이터보다 뒤로 물러나 있어야 한다 */}
        {gridLines.map((ratio) => {
          const y = PAD_T + plotH - ratio * plotH;
          return (
            <g key={ratio}>
              <line
                x1={PAD_L}
                x2={width - PAD_R}
                y1={y}
                y2={y}
                stroke="var(--a-grid)"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--a-ink-3)"
              >
                {fmt(Math.round(max * ratio))}
              </text>
            </g>
          );
        })}

        {/* x축 라벨 */}
        {labels.map((label, i) =>
          i % labelStride === 0 ? (
            <text
              key={label + i}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--a-ink-3)"
            >
              {label}
            </text>
          ) : null,
        )}

        {/* 호버 크로스헤어 */}
        {hoverIndex !== null && (
          <line
            x1={xAt(hoverIndex)}
            x2={xAt(hoverIndex)}
            y1={PAD_T}
            y2={PAD_T + plotH}
            stroke="var(--a-line-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* 선 — 2px, 끝은 둥글게 */}
        {visible.map((s) => {
          const d = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
            .join(" ");
          return (
            <path
              key={s.key}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* 호버 지점 마커 — 겹칠 때 구분되도록 표면색 링을 두른다 */}
        {hoverIndex !== null &&
          visible.map((s) => (
            <circle
              key={s.key}
              cx={xAt(hoverIndex)}
              cy={yAt(s.values[hoverIndex] ?? 0)}
              r={4}
              fill={s.color}
              stroke="var(--a-surface)"
              strokeWidth={2}
            />
          ))}
      </svg>

      {hoverIndex !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: `${(xAt(hoverIndex) / width) * 100}%`,
            top: `${(PAD_T / height) * 100}%`,
          }}
        >
          <div className={styles.tooltipTitle}>{labels[hoverIndex]}</div>
          {visible.map((s) => (
            <div key={s.key} className={styles.tooltipRow}>
              <span className={styles.tooltipDot} style={{ background: s.color }} />
              <span>{s.label}</span>
              <span className={styles.tooltipVal}>{fmt(s.values[hoverIndex] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 시리즈가 2개 이상이면 범례는 항상 보인다(색만으로 구분하지 않기 위해) */}
      {series.length > 1 && (
        <div className={styles.legend}>
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`${styles.legendItem} ${hidden.has(s.key) ? styles.legendItemMuted : ""}`}
              onClick={() => toggle(s.key)}
              aria-pressed={!hidden.has(s.key)}
            >
              <span className={styles.legendSwatch} style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
