import { useEffect, useState } from "react";
import { Card, Kpi, DataState, BarList, uiStyles as ui } from "../../features/admin/components/Primitives";
import { TrendChart } from "../../features/admin/components/TrendChart";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import {
  fetchDailyTrend,
  fetchFunnel,
  fetchKpiSummary,
  fetchTodaySnapshot,
  fetchTopPages,
} from "../../features/admin/adminApi";
import { formatNumber, formatPercent, resolvePeriod, usePeriod } from "../../features/admin/usePeriod";

/** "9/1" 처럼 짧게. 축 라벨이 겹치지 않아야 한다. */
function shortDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/**
 * 오늘 현황 카드.
 *
 * Realtime 구독 대신 60초 폴링을 쓴다.
 * 구독은 연결을 계속 물고 있어야 하고 요금·부하가 붙는데,
 * "오늘 방문자" 는 초 단위로 볼 필요가 없는 숫자다.
 * 탭이 백그라운드일 때는 아예 요청하지 않아 낭비를 더 줄인다.
 */
function TodayCard() {
  const [tick, setTick] = useState(0);
  const { data, loading, error } = useAdminQuery(fetchTodaySnapshot, [tick]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((n) => n + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Card
      title="오늘 현황"
      sub={data?.last_event_at ? `마지막 이벤트 ${new Date(data.last_event_at).toLocaleTimeString("ko-KR")}` : undefined}
      actions={
        <span className={ui.liveTag}>
          <span className={`${ui.statusDot} ${ui.dotOk}`} />
          60초마다 갱신
        </span>
      }
    >
      <DataState loading={loading} error={error} height={90}>
        <div className={`${ui.grid} ${ui.kpiGrid}`}>
          <Kpi icon="👥" label="오늘 방문자" value={formatNumber(data?.visitors)} accent />
          <Kpi icon="📄" label="오늘 페이지뷰" value={formatNumber(data?.page_views)} />
          <Kpi icon="✅" label="계산 완료" value={formatNumber(data?.sim_completed)} />
          <Kpi icon="🔗" label="공유" value={formatNumber(data?.shares)} />
        </div>
      </DataState>
    </Card>
  );
}

export function DashboardPage() {
  const { range, refreshToken } = usePeriod();
  const deps = [range.from.getTime(), range.to.getTime(), refreshToken];

  const kpi = useAdminQuery(() => fetchKpiSummary(range.from, range.to), deps);
  const trend = useAdminQuery(() => fetchDailyTrend(range.from, range.to), deps);
  const funnel = useAdminQuery(() => fetchFunnel(range.from, range.to), deps);
  const pages = useAdminQuery(() => fetchTopPages(range.from, range.to, 5), deps);

  // 7일·30일은 상단 기간 필터와 무관하게 항상 같은 기준으로 보여 준다.
  const last7 = resolvePeriod("7d");
  const last30 = resolvePeriod("30d");
  const kpi7 = useAdminQuery(() => fetchKpiSummary(last7.from, last7.to), [refreshToken]);
  const kpi30 = useAdminQuery(() => fetchKpiSummary(last30.from, last30.to), [refreshToken]);

  const summary = kpi.data;
  const rows = trend.data ?? [];

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          휴가요정 관리자 대시보드
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          익명 이용 통계입니다. 개인을 식별하는 정보는 수집하지 않습니다.
        </p>
      </div>

      <TodayCard />

      <div className={`${ui.grid} ${ui.kpiGrid}`}>
        <Kpi
          icon="👥"
          label="기간 내 방문자"
          value={formatNumber(summary?.visitors)}
          hint={`세션 ${formatNumber(summary?.sessions)}회`}
          accent
        />
        <Kpi icon="📄" label="페이지뷰" value={formatNumber(summary?.page_views)} />
        <Kpi
          icon="✅"
          label="시뮬레이션 완료"
          value={formatNumber(summary?.sim_completed)}
          hint={`시작 ${formatNumber(summary?.sim_started)}명`}
        />
        <Kpi icon="🔗" label="공유" value={formatNumber(summary?.shares)} />
        <Kpi
          icon="📈"
          label="시뮬레이션 전환율"
          value={summary ? formatPercent(summary.sim_completed, summary.visitors) : "—"}
          hint="완료 / 방문자"
          accent
        />
        <Kpi
          icon="📣"
          label="공유율"
          value={summary ? formatPercent(summary.share_visitors, summary.sim_completed) : "—"}
          hint="공유 / 완료"
        />
        <Kpi icon="🗓️" label="최근 7일 방문자" value={formatNumber(kpi7.data?.visitors)} />
        <Kpi icon="🗓️" label="최근 30일 방문자" value={formatNumber(kpi30.data?.visitors)} />
      </div>

      <Card title="방문자 추세" sub={`${rows.length}일`}>
        <DataState
          loading={trend.loading}
          error={trend.error}
          empty={rows.length === 0}
          emptyHint="아직 수집된 이벤트가 없습니다. 사이트를 방문하면 몇 초 안에 기록됩니다."
          height={240}
        >
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
          />
        </DataState>
      </Card>

      <div className={`${ui.grid} ${ui.cols2}`}>
        <Card title="퍼널 요약" sub="이전 단계 대비">
          <DataState
            loading={funnel.loading}
            error={funnel.error}
            empty={(funnel.data?.length ?? 0) === 0}
            height={160}
          >
            <BarList
              data={(funnel.data ?? []).map((step) => ({
                label: step.step_name,
                value: Number(step.visitors),
              }))}
              total={Number(funnel.data?.[0]?.visitors ?? 0)}
              format={(v) => `${v.toLocaleString("ko-KR")}명`}
            />
          </DataState>
        </Card>

        <Card title="인기 페이지 TOP 5">
          <DataState
            loading={pages.loading}
            error={pages.error}
            empty={(pages.data?.length ?? 0) === 0}
            height={160}
          >
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>페이지</th>
                    <th className={ui.numCell}>PV</th>
                    <th className={ui.numCell}>방문자</th>
                  </tr>
                </thead>
                <tbody>
                  {(pages.data ?? []).map((row) => (
                    <tr key={row.page_path}>
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
      </div>
    </>
  );
}
