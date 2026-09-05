import { Card, Kpi, DataState, BarList, uiStyles as ui } from "../../features/admin/components/Primitives";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import { fetchSystemStatus } from "../../features/admin/adminApi";
import { formatNumber, usePeriod } from "../../features/admin/usePeriod";
import { useAdminAuth } from "../../features/admin/AdminAuthContext";
import { isGa4Configured } from "../../features/analytics";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR");
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <tr>
      <td>
        <span
          className={`${ui.statusDot} ${ok ? ui.dotOk : ui.dotOff}`}
          style={{ marginRight: 8 }}
        />
        {label}
      </td>
      <td style={{ color: "var(--a-ink-2)" }}>{detail}</td>
    </tr>
  );
}

export function SystemPage() {
  const { refreshToken } = usePeriod();
  const { email, role } = useAdminAuth();
  const { data, loading, error } = useAdminQuery(fetchSystemStatus, [refreshToken]);

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          시스템
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          수집 상태와 연동 설정을 확인합니다.
        </p>
      </div>

      <div className={`${ui.grid} ${ui.kpiGrid}`}>
        <Kpi icon="🗂️" label="전체 이벤트" value={formatNumber(data?.total_events)} accent />
        <Kpi icon="🕐" label="최근 24시간" value={formatNumber(data?.events_24h)} />
        <Kpi icon="👥" label="누적 방문자" value={formatNumber(data?.total_visitors)} />
        <Kpi icon="💾" label="테이블 크기" value={data?.table_size ?? "—"} />
        <Kpi icon="🔑" label="관리자 계정" value={formatNumber(data?.admin_count)} />
        <Kpi icon="🙋" label="가입 사용자" value={formatNumber(data?.user_count)} />
      </div>

      <div className={`${ui.grid} ${ui.cols2}`}>
        <Card title="연동 상태">
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <tbody>
                <StatusRow ok label="Supabase 연결" detail="publishable(anon) 키 사용 · RLS 적용" />
                <StatusRow
                  ok={isGa4Configured}
                  label="Google Analytics 4"
                  detail={
                    isGa4Configured
                      ? "VITE_GA_MEASUREMENT_ID 설정됨"
                      : "미설정 (없어도 앱은 정상 동작)"
                  }
                />
                <StatusRow ok label="관리자 권한" detail={`${email ?? "—"} · role=${role ?? "—"}`} />
                <StatusRow
                  ok={Boolean(data)}
                  label="집계 함수(RPC)"
                  detail={data ? "정상 응답" : "admin-analytics.sql 실행 필요"}
                />
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="수집 기간">
          <DataState loading={loading} error={error} height={130}>
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <tbody>
                  <tr>
                    <td>첫 이벤트</td>
                    <td className={ui.numCell}>{formatDateTime(data?.oldest_event ?? null)}</td>
                  </tr>
                  <tr>
                    <td>마지막 이벤트</td>
                    <td className={ui.numCell}>{formatDateTime(data?.newest_event ?? null)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DataState>
        </Card>
      </div>

      <Card title="이벤트별 수집량" sub="최근 30일">
        <DataState
          loading={loading}
          error={error}
          empty={(data?.event_names.length ?? 0) === 0}
          emptyHint="아직 수집된 이벤트가 없습니다."
          height={220}
        >
          <BarList
            data={(data?.event_names ?? []).map((row) => ({
              label: row.event_name,
              value: Number(row.count),
            }))}
            color="var(--a-s1)"
            format={(v) => `${v.toLocaleString("ko-KR")}건`}
          />
        </DataState>
      </Card>

      <Card title="개인정보 처리 방침 (수집 항목)">
        <div style={{ fontSize: 13, lineHeight: 1.9, color: "var(--a-ink-2)" }}>
          <p style={{ margin: "0 0 8px", color: "var(--a-ink)", fontWeight: 700 }}>
            수집하는 것
          </p>
          <p style={{ margin: "0 0 14px" }}>
            브라우저가 만든 랜덤 ID(visitor_id · session_id), 페이지 경로, 이벤트 이름,
            선택한 연도 · 연차 일수 · 휴가 전략 · 결과 휴식일, 유입 도메인과 UTM 값,
            화면 폭으로 판단한 기기 구분(모바일/태블릿/데스크톱).
          </p>
          <p style={{ margin: "0 0 8px", color: "var(--a-ink)", fontWeight: 700 }}>
            수집하지 않는 것
          </p>
          <p style={{ margin: 0 }}>
            이름, 전화번호, 이메일, IP 주소, 정확한 위치, 입력 텍스트 전문, 브라우저 fingerprint.
            visitor_id 는 랜덤 UUID 라서 다른 서비스의 기록과 연결할 수 없고, 사용자가 브라우저
            저장소를 지우면 이전 기록과의 연결도 끊어집니다.
          </p>
        </div>
      </Card>
    </>
  );
}
