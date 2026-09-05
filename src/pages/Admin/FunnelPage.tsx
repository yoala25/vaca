import { Card, DataState, uiStyles as ui } from "../../features/admin/components/Primitives";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import { fetchFunnel } from "../../features/admin/adminApi";
import { formatNumber, usePeriod } from "../../features/admin/usePeriod";

/**
 * 퍼널.
 *
 * 단계마다 색을 바꾸지 않는다 — 단계는 서로 다른 "정체"가 아니라
 * 같은 흐름의 진행이므로, 한 가지 색의 밝기 단계(순서형 램프)로 표현한다.
 * 이탈이 큰 구간만 눈에 띄도록 이탈률을 직접 라벨로 붙인다.
 */
const STEP_COLORS = ["#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef"];

export function FunnelPage() {
  const { range, refreshToken } = usePeriod();
  const { data, loading, error } = useAdminQuery(
    () => fetchFunnel(range.from, range.to),
    [range.from.getTime(), range.to.getTime(), refreshToken],
  );

  const steps = data ?? [];
  const first = Number(steps[0]?.visitors ?? 0);

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          퍼널 분석
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          사용자가 어느 단계에서 가장 많이 빠져나가는지 봅니다.
        </p>
      </div>

      <Card title="단계별 전환" sub="막대 길이 = 첫 단계 대비 비율">
        <DataState
          loading={loading}
          error={error}
          empty={steps.length === 0 || first === 0}
          emptyHint="아직 방문 기록이 없습니다."
          height={260}
        >
          <div className={ui.funnel}>
            {steps.map((step, index) => {
              const visitors = Number(step.visitors);
              const previous = index > 0 ? Number(steps[index - 1].visitors) : visitors;
              const fromFirst = first > 0 ? (visitors / first) * 100 : 0;
              const fromPrev = previous > 0 ? (visitors / previous) * 100 : 0;
              const dropped = previous - visitors;

              return (
                <div key={step.step_order}>
                  {index > 0 && (
                    <div className={ui.funnelGap}>
                      <span />
                      <span className={ui.funnelGapText}>
                        ↓ 이전 대비 <strong>{fromPrev.toFixed(1)}%</strong>
                        {dropped > 0 && (
                          <>
                            {" · "}
                            <span className={ui.funnelDropText}>
                              {formatNumber(dropped)}명 이탈
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  <div className={ui.funnelStep}>
                    <span className={ui.funnelName}>{step.step_name}</span>
                    <span className={ui.funnelBarWrap}>
                      <span
                        className={ui.funnelBar}
                        style={{
                          width: `${Math.max(8, fromFirst)}%`,
                          background: STEP_COLORS[index] ?? STEP_COLORS[STEP_COLORS.length - 1],
                        }}
                      >
                        {formatNumber(visitors)}명
                      </span>
                      <span className={ui.funnelMeta}>{fromFirst.toFixed(1)}%</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </DataState>
      </Card>

      <Card title="표로 보기">
        <DataState loading={loading} error={error} empty={steps.length === 0} height={140}>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>단계</th>
                  <th className={ui.numCell}>인원</th>
                  <th className={ui.numCell}>전체 대비</th>
                  <th className={ui.numCell}>이전 단계 대비</th>
                  <th className={ui.numCell}>이탈</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, index) => {
                  const visitors = Number(step.visitors);
                  const previous = index > 0 ? Number(steps[index - 1].visitors) : visitors;
                  return (
                    <tr key={step.step_order}>
                      <td>{step.step_name}</td>
                      <td className={ui.numCell}>{formatNumber(visitors)}</td>
                      <td className={ui.numCell}>
                        {first > 0 ? `${((visitors / first) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className={ui.numCell}>
                        {index === 0
                          ? "—"
                          : previous > 0
                            ? `${((visitors / previous) * 100).toFixed(1)}%`
                            : "—"}
                      </td>
                      <td className={ui.numCell}>
                        {index === 0 ? "—" : formatNumber(Math.max(0, previous - visitors))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
    </>
  );
}
