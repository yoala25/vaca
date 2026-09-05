import { useState } from "react";
import { Card, Kpi, DataState, uiStyles as ui } from "../../features/admin/components/Primitives";
import { TrendChart } from "../../features/admin/components/TrendChart";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import { fetchDailyTrend, fetchKpiSummary, fetchTopPages } from "../../features/admin/adminApi";
import { formatNumber, formatPercent, usePeriod } from "../../features/admin/usePeriod";

function shortDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function VisitorsPage() {
  const { range, refreshToken } = usePeriod();
  const deps = [range.from.getTime(), range.to.getTime(), refreshToken];

  const kpi = useAdminQuery(() => fetchKpiSummary(range.from, range.to), deps);
  const trend = useAdminQuery(() => fetchDailyTrend(range.from, range.to), deps);
  const pages = useAdminQuery(() => fetchTopPages(range.from, range.to, 10), deps);

  // 색 대비가 낮은 슬롯이 있어 표 보기를 항상 함께 제공한다(접근성 규칙).
  const [showTable, setShowTable] = useState(false);
  const rows = trend.data ?? [];
  const summary = kpi.data;

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          방문자
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          방문자는 브라우저마다 하나씩 만들어지는 익명 ID 기준입니다.
        </p>
      </div>

      <div className={`${ui.grid} ${ui.kpiGrid}`}>
        <Kpi icon="👥" label="고유 방문자" value={formatNumber(summary?.visitors)} accent />
        <Kpi icon="🔁" label="세션" value={formatNumber(summary?.sessions)} />
        <Kpi icon="📄" label="페이지뷰" value={formatNumber(summary?.page_views)} />
        <Kpi
          icon="📊"
          label="방문자당 페이지뷰"
          value={
            summary && summary.visitors > 0
              ? (summary.page_views / summary.visitors).toFixed(1)
              : "—"
          }
        />
        <Kpi
          icon="📈"
          label="시뮬레이션 전환율"
          value={summary ? formatPercent(summary.sim_completed, summary.visitors) : "—"}
        />
      </div>

      <Card
        title="일별 추세"
        sub={`${rows.length}일`}
        actions={
          <button
            type="button"
            className={`${ui.ghostBtn} ${showTable ? ui.ghostBtnActive : ""}`}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? "차트 보기" : "표 보기"}
          </button>
        }
      >
        <DataState
          loading={trend.loading}
          error={trend.error}
          empty={rows.length === 0}
          emptyHint="선택한 기간에 기록된 이벤트가 없습니다."
          height={240}
        >
          {showTable ? (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th className={ui.numCell}>방문자</th>
                    <th className={ui.numCell}>페이지뷰</th>
                    <th className={ui.numCell}>계산 완료</th>
                    <th className={ui.numCell}>공유</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((row) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td className={ui.numCell}>{formatNumber(Number(row.visitors))}</td>
                      <td className={ui.numCell}>{formatNumber(Number(row.page_views))}</td>
                      <td className={ui.numCell}>{formatNumber(Number(row.sim_completed))}</td>
                      <td className={ui.numCell}>{formatNumber(Number(row.shares))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <TrendChart
              labels={rows.map((row) => shortDay(row.day))}
              series={[
                {
                  key: "visitors",
                  label: "고유 방문자",
                  color: "var(--a-s1)",
                  values: rows.map((r) => Number(r.visitors)),
                },
                {
                  key: "pv",
                  label: "페이지뷰",
                  color: "var(--a-s2)",
                  values: rows.map((r) => Number(r.page_views)),
                },
                {
                  key: "sim",
                  label: "시뮬레이션 완료",
                  color: "var(--a-s3)",
                  values: rows.map((r) => Number(r.sim_completed)),
                },
                {
                  key: "share",
                  label: "공유",
                  color: "var(--a-s4)",
                  values: rows.map((r) => Number(r.shares)),
                },
              ]}
              height={260}
            />
          )}
        </DataState>
      </Card>

      <Card title="인기 페이지 TOP 10" sub="page_path 기준 자동 집계">
        <DataState
          loading={pages.loading}
          error={pages.error}
          empty={(pages.data?.length ?? 0) === 0}
          height={200}
        >
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.rankCell}>#</th>
                  <th>페이지</th>
                  <th className={ui.numCell}>PV</th>
                  <th className={ui.numCell}>고유 방문자</th>
                </tr>
              </thead>
              <tbody>
                {(pages.data ?? []).map((row, index) => (
                  <tr key={row.page_path}>
                    <td className={ui.rankCell}>{index + 1}</td>
                    <td className={ui.pathCell}>{row.page_path}</td>
                    <td className={ui.numCell}>{formatNumber(Number(row.page_views))}</td>
                    <td className={ui.numCell}>{formatNumber(Number(row.visitors))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
    </>
  );
}
