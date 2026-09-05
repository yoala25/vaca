import { Card, Kpi, DataState, BarList, uiStyles as ui } from "../../features/admin/components/Primitives";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import { fetchShareAnalysis } from "../../features/admin/adminApi";
import { formatNumber, formatPercent, usePeriod } from "../../features/admin/usePeriod";

const CHANNEL_LABELS: Record<string, string> = {
  share_click: "공유 버튼",
  share_kakao: "카카오톡",
  share_link: "링크 복사",
  share_image: "이미지 저장",
};

export function SharePage() {
  const { range, refreshToken } = usePeriod();
  const { data, loading, error } = useAdminQuery(
    () => fetchShareAnalysis(range.from, range.to),
    [range.from.getTime(), range.to.getTime(), refreshToken],
  );

  const byChannel = data?.by_channel ?? [];
  const byYear = data?.by_year ?? [];
  const topResults = data?.top_shared_results ?? [];

  const find = (name: string) =>
    Number(byChannel.find((row) => row.channel === name)?.count ?? 0);

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          공유 분석
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          어떤 결과가 공유될 만한지 보면 콘텐츠 방향을 잡을 수 있습니다.
        </p>
      </div>

      <div className={`${ui.grid} ${ui.kpiGrid}`}>
        <Kpi icon="🔗" label="전체 공유" value={formatNumber(data?.total)} accent />
        <Kpi icon="💬" label="카카오톡" value={formatNumber(find("share_kakao"))} />
        <Kpi icon="📋" label="링크 복사" value={formatNumber(find("share_link"))} />
        <Kpi icon="🖼️" label="이미지 저장" value={formatNumber(find("share_image"))} />
        <Kpi
          icon="📣"
          label="공유율"
          value={
            data ? formatPercent(Number(data.share_visitors), Number(data.complete_visitors)) : "—"
          }
          hint="공유한 사람 / 계산 완료한 사람"
          accent
        />
      </div>

      <div className={`${ui.grid} ${ui.cols2}`}>
        <Card title="공유 채널">
          <DataState loading={loading} error={error} empty={byChannel.length === 0} height={150}>
            <BarList
              data={byChannel.map((row) => ({
                label: CHANNEL_LABELS[row.channel] ?? row.channel,
                value: Number(row.count),
              }))}
              color="var(--a-s2)"
              format={(v) => `${v.toLocaleString("ko-KR")}회`}
            />
          </DataState>
        </Card>

        <Card title="공유가 많은 연도">
          <DataState loading={loading} error={error} empty={byYear.length === 0} height={150}>
            <BarList
              data={byYear.map((row) => ({
                label: `${row.target_year}년`,
                value: Number(row.count),
              }))}
              color="var(--a-s1)"
              format={(v) => `${v.toLocaleString("ko-KR")}회`}
            />
          </DataState>
        </Card>
      </div>

      <Card title="가장 많이 공유된 결과" sub="공유를 부르는 조합">
        <DataState
          loading={loading}
          error={error}
          empty={topResults.length === 0}
          emptyHint="아직 공유 기록이 없습니다. 공유 버튼을 붙이면 여기에 쌓입니다."
          height={160}
        >
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.rankCell}>#</th>
                  <th>결과</th>
                  <th className={ui.numCell}>공유 수</th>
                </tr>
              </thead>
              <tbody>
                {topResults.map((row, index) => (
                  <tr key={`${row.leave_days}-${row.result_days}`}>
                    <td className={ui.rankCell}>{index + 1}</td>
                    <td>
                      연차 {Number(row.leave_days)}일 →{" "}
                      <strong>{Number(row.result_days)}일 휴식</strong>
                    </td>
                    <td className={ui.numCell}>{formatNumber(Number(row.count))}</td>
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
