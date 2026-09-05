import { Card, Kpi, DataState, BarList, uiStyles as ui } from "../../features/admin/components/Primitives";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import { fetchVacationAnalysis } from "../../features/admin/adminApi";
import { formatDays, formatNumber, usePeriod } from "../../features/admin/usePeriod";

/** 엔진의 전략 코드를 사람이 읽는 이름으로. */
const STYLE_LABELS: Record<string, string> = {
  "long-break": "장기 집중 휴가",
  frequent: "수시 휴가",
  thrifty: "연차 절약",
};

function styleLabel(style: string): string {
  return STYLE_LABELS[style] ?? style;
}

export function VacationPage() {
  const { range, refreshToken } = usePeriod();
  const { data, loading, error } = useAdminQuery(
    () => fetchVacationAnalysis(range.from, range.to),
    [range.from.getTime(), range.to.getTime(), refreshToken],
  );

  const byYear = data?.by_year ?? [];
  const buckets = data?.leave_buckets ?? [];
  const styles = data?.styles ?? [];
  const combos = data?.top_combos ?? [];
  const yearTotal = byYear.reduce((acc, row) => acc + Number(row.count), 0);

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          휴가 분석
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          사용자가 어떤 연도를, 며칠의 연차로, 어떤 전략으로 계산했는지 봅니다.
        </p>
      </div>

      <div className={`${ui.grid} ${ui.kpiGrid}`}>
        <Kpi icon="🪙" label="평균 입력 연차" value={formatDays(data?.avg_leave_days)} accent />
        <Kpi icon="🌴" label="평균 결과 휴식일" value={formatDays(data?.avg_result_days)} />
        <Kpi
          icon="⚡"
          label="평균 연차 효율"
          value={data?.avg_efficiency ? `${Number(data.avg_efficiency).toFixed(2)}x` : "—"}
          hint="휴식일 ÷ 연차"
          accent
        />
        <Kpi
          icon="🎯"
          label="가장 많은 전략"
          value={styles[0] ? styleLabel(styles[0].style) : "—"}
          hint={styles[0] ? `${formatNumber(Number(styles[0].count))}회` : undefined}
        />
      </div>

      <div className={`${ui.grid} ${ui.cols2}`}>
        <Card title="연도별 시뮬레이션 비중">
          <DataState loading={loading} error={error} empty={byYear.length === 0} height={150}>
            <BarList
              data={byYear.map((row) => ({
                label: `${row.target_year}년`,
                value: Number(row.count),
              }))}
              total={yearTotal}
              color="var(--a-s1)"
              format={(v) => `${v.toLocaleString("ko-KR")}회`}
            />
          </DataState>
        </Card>

        <Card title="입력 연차 분포">
          <DataState loading={loading} error={error} empty={buckets.length === 0} height={150}>
            <BarList
              data={buckets.map((row) => ({ label: row.bucket, value: Number(row.count) }))}
              color="var(--a-s3)"
              format={(v) => `${v.toLocaleString("ko-KR")}명`}
            />
          </DataState>
        </Card>

        <Card title="휴가 스타일 선호도">
          <DataState loading={loading} error={error} empty={styles.length === 0} height={150}>
            <BarList
              data={styles.map((row) => ({
                label: styleLabel(row.style),
                value: Number(row.count),
              }))}
              color="var(--a-s2)"
              format={(v) => `${v.toLocaleString("ko-KR")}회`}
            />
          </DataState>
        </Card>

        <Card title="인기 추천 조합 TOP 10" sub="가장 많이 나온 결과">
          <DataState loading={loading} error={error} empty={combos.length === 0} height={150}>
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th className={ui.rankCell}>#</th>
                    <th>조합</th>
                    <th className={ui.numCell}>효율</th>
                    <th className={ui.numCell}>횟수</th>
                  </tr>
                </thead>
                <tbody>
                  {combos.map((row, index) => {
                    const leave = Number(row.leave_days);
                    const result = Number(row.result_days);
                    return (
                      <tr key={`${row.leave_days}-${row.result_days}`}>
                        <td className={ui.rankCell}>{index + 1}</td>
                        <td>
                          연차 {leave}일 → <strong>{result}일 휴식</strong>
                        </td>
                        <td className={ui.numCell}>
                          {leave > 0 ? `${(result / leave).toFixed(1)}x` : "—"}
                        </td>
                        <td className={ui.numCell}>{formatNumber(Number(row.count))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DataState>
        </Card>
      </div>
    </>
  );
}
