import { Card, Kpi, DataState, BarList, Banner, uiStyles as ui } from "../../features/admin/components/Primitives";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import { fetchMonetization } from "../../features/admin/adminApi";
import { formatNumber, formatPercent, usePeriod } from "../../features/admin/usePeriod";

const TYPE_LABELS: Record<string, string> = {
  flight: "항공권",
  hotel: "호텔",
  package: "여행상품",
  other: "기타",
};

export function RevenuePage() {
  const { range, refreshToken } = usePeriod();
  const { data, loading, error } = useAdminQuery(
    () => fetchMonetization(range.from, range.to),
    [range.from.getTime(), range.to.getTime(), refreshToken],
  );

  const impressions = Number(data?.ad_impressions ?? 0);
  const clicks = Number(data?.ad_clicks ?? 0);
  const affiliate = Number(data?.affiliate_clicks ?? 0);
  const hasAnyData = impressions + clicks + affiliate > 0;

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          수익화
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          광고와 제휴 링크 성과입니다. 아직 붙이지 않았다면 값이 0으로 보입니다.
        </p>
      </div>

      {!hasAnyData && !loading && (
        <Banner tone="warn">
          <strong>아직 수익화 데이터가 없습니다.</strong>
          <br />
          광고나 제휴 링크를 붙이면 여기에 자동으로 쌓입니다. 기록 함수는 이미 준비돼 있습니다:
          <br />
          <code className={ui.bannerCode}>
            trackAffiliateClick({"{"} provider: "booking", type: "hotel", destination: "tokyo" {"}"})
          </code>
          {"  "}
          <code className={ui.bannerCode}>trackAd("impression", "sidebar")</code>
        </Banner>
      )}

      <div className={`${ui.grid} ${ui.kpiGrid}`}>
        <Kpi
          icon="💰"
          label="AdSense 예상 수익"
          value="—"
          hint="AdSense API 연동 전"
        />
        <Kpi icon="👁️" label="광고 노출" value={formatNumber(impressions)} />
        <Kpi icon="🖱️" label="광고 클릭" value={formatNumber(clicks)} />
        <Kpi
          icon="📊"
          label="CTR"
          value={impressions > 0 ? formatPercent(clicks, impressions, 2) : "—"}
          hint="클릭 / 노출"
          accent
        />
        <Kpi icon="✈️" label="제휴 링크 클릭" value={formatNumber(affiliate)} accent />
      </div>

      <div className={`${ui.grid} ${ui.cols2}`}>
        <Card title="제휴 클릭 — 유형별">
          <DataState
            loading={loading}
            error={error}
            empty={(data?.affiliate_by_type.length ?? 0) === 0}
            emptyHint="항공권 · 호텔 · 여행상품 버튼을 붙이면 여기에 나뉘어 표시됩니다."
            height={150}
          >
            <BarList
              data={(data?.affiliate_by_type ?? []).map((row) => ({
                label: TYPE_LABELS[row.type] ?? row.type,
                value: Number(row.count),
              }))}
              color="var(--a-s1)"
              format={(v) => `${v.toLocaleString("ko-KR")}회`}
            />
          </DataState>
        </Card>

        <Card title="제휴 클릭 — 제공사별">
          <DataState
            loading={loading}
            error={error}
            empty={(data?.affiliate_by_provider.length ?? 0) === 0}
            emptyHint="아직 데이터가 없습니다."
            height={150}
          >
            <BarList
              data={(data?.affiliate_by_provider ?? []).map((row) => ({
                label: row.provider,
                value: Number(row.count),
              }))}
              color="var(--a-s3)"
              format={(v) => `${v.toLocaleString("ko-KR")}회`}
            />
          </DataState>
        </Card>
      </div>

      <Card title="붙이는 방법">
        <div style={{ fontSize: 13, lineHeight: 1.85, color: "var(--a-ink-2)" }}>
          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: "var(--a-ink)" }}>제휴 버튼</strong> — 클릭 핸들러에 한 줄만
            추가하면 됩니다. 통계 전송이 실패해도 링크 이동은 그대로 동작합니다.
          </p>
          <pre className={ui.bannerCode} style={{ display: "block", padding: 12, margin: "0 0 16px", overflowX: "auto" }}>
{`import { trackAffiliateClick } from "@/features/analytics";

<a href={bookingUrl} target="_blank" rel="noopener noreferrer"
   onClick={() => trackAffiliateClick({
     provider: "booking", type: "hotel", destination: "tokyo", targetYear: 2027,
   })}>
  도쿄 호텔 보기
</a>`}
          </pre>

          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: "var(--a-ink)" }}>AdSense</strong> — 광고 슬롯이 화면에
            들어올 때 <code className={ui.bannerCode}>trackAd("impression", "슬롯이름")</code>,
            클릭 시 <code className={ui.bannerCode}>trackAd("click", "슬롯이름")</code> 을
            호출하면 위 카드가 채워집니다. 실제 수익 금액은 AdSense 쪽 데이터라
            별도 API 연동이 필요합니다.
          </p>
        </div>
      </Card>
    </>
  );
}
