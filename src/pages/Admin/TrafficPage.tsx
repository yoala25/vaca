import { Card, Kpi, DataState, BarList, uiStyles as ui } from "../../features/admin/components/Primitives";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import { fetchTrafficSources } from "../../features/admin/adminApi";
import { formatNumber, usePeriod } from "../../features/admin/usePeriod";

export function TrafficPage() {
  const { range, refreshToken } = usePeriod();
  const { data, loading, error } = useAdminQuery(
    () => fetchTrafficSources(range.from, range.to),
    [range.from.getTime(), range.to.getTime(), refreshToken],
  );

  const channels = data?.channels ?? [];
  const total = Number(data?.total_visitors ?? 0);
  const top = channels[0];

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          유입 분석
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          방문자마다 <strong>첫 유입</strong> 한 번만 셉니다. referrer 는 도메인만 남기고
          검색어 등 경로 정보는 저장하지 않습니다.
        </p>
      </div>

      <div className={`${ui.grid} ${ui.kpiGrid}`}>
        <Kpi icon="👥" label="전체 방문자" value={formatNumber(total)} accent />
        <Kpi
          icon="🥇"
          label="가장 큰 유입"
          value={top?.channel ?? "—"}
          hint={
            top && total > 0
              ? `${formatNumber(Number(top.visitors))}명 · ${((Number(top.visitors) / total) * 100).toFixed(1)}%`
              : undefined
          }
        />
        <Kpi icon="🏷️" label="UTM 캠페인" value={formatNumber(data?.utm_campaigns.length ?? 0)} />
        <Kpi icon="🔎" label="식별된 채널" value={formatNumber(channels.length)} />
      </div>

      <Card title="채널별 유입" sub="referrer · UTM 기준 자동 분류">
        <DataState
          loading={loading}
          error={error}
          empty={channels.length === 0}
          emptyHint="아직 유입 데이터가 없습니다."
          height={200}
        >
          <BarList
            data={channels.map((row) => ({ label: row.channel, value: Number(row.visitors) }))}
            total={total}
            color="var(--a-s1)"
            format={(v) => `${v.toLocaleString("ko-KR")}명`}
          />
        </DataState>
      </Card>

      <div className={`${ui.grid} ${ui.cols3}`}>
        <Card title="utm_source">
          <DataState
            loading={loading}
            error={error}
            empty={(data?.utm_sources.length ?? 0) === 0}
            emptyHint="UTM 이 붙은 링크로 들어온 방문이 아직 없습니다."
            height={130}
          >
            <BarList
              data={(data?.utm_sources ?? []).map((row) => ({
                label: row.source,
                value: Number(row.visitors),
              }))}
              color="var(--a-s2)"
              showPercent={false}
              format={(v) => `${v.toLocaleString("ko-KR")}명`}
            />
          </DataState>
        </Card>

        <Card title="utm_medium">
          <DataState
            loading={loading}
            error={error}
            empty={(data?.utm_mediums.length ?? 0) === 0}
            emptyHint="아직 데이터가 없습니다."
            height={130}
          >
            <BarList
              data={(data?.utm_mediums ?? []).map((row) => ({
                label: row.medium,
                value: Number(row.visitors),
              }))}
              color="var(--a-s3)"
              showPercent={false}
              format={(v) => `${v.toLocaleString("ko-KR")}명`}
            />
          </DataState>
        </Card>

        <Card title="utm_campaign">
          <DataState
            loading={loading}
            error={error}
            empty={(data?.utm_campaigns.length ?? 0) === 0}
            emptyHint="아직 데이터가 없습니다."
            height={130}
          >
            <BarList
              data={(data?.utm_campaigns ?? []).map((row) => ({
                label: row.campaign,
                value: Number(row.visitors),
              }))}
              color="var(--a-s4)"
              showPercent={false}
              format={(v) => `${v.toLocaleString("ko-KR")}명`}
            />
          </DataState>
        </Card>
      </div>
    </>
  );
}
