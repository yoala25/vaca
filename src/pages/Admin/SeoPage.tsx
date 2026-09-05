import { Card, DataState, Banner, uiStyles as ui } from "../../features/admin/components/Primitives";
import { useAdminQuery } from "../../features/admin/useAdminQuery";
import { fetchTopPages } from "../../features/admin/adminApi";
import { formatNumber, usePeriod } from "../../features/admin/usePeriod";

/**
 * 외부 도구 바로가기.
 *
 * Search Console / Search Advisor 는 아직 API 를 붙이지 않는다.
 * 붙일 때는 OAuth 와 서버 토큰 보관이 필요해서 Edge Function 이 있어야 하므로,
 * 지금은 링크만 두고 자리를 잡아 둔다.
 */
const TOOLS = [
  {
    icon: "🔍",
    title: "Google Search Console",
    desc: "색인 상태 · 검색 노출 · 클릭수",
    href: "https://search.google.com/search-console",
  },
  {
    icon: "🟢",
    title: "네이버 서치어드바이저",
    desc: "네이버 검색 노출 · 사이트 진단",
    href: "https://searchadvisor.naver.com/",
  },
  {
    icon: "📈",
    title: "Google Analytics 4",
    desc: "GA4 실시간 · 잠재고객 리포트",
    href: "https://analytics.google.com/",
  },
  {
    icon: "🗺️",
    title: "PageSpeed Insights",
    desc: "Core Web Vitals · 로딩 속도",
    href: "https://pagespeed.web.dev/",
  },
];

export function SeoPage() {
  const { range, refreshToken } = usePeriod();
  const pages = useAdminQuery(
    () => fetchTopPages(range.from, range.to, 30),
    [range.from.getTime(), range.to.getTime(), refreshToken],
  );

  return (
    <>
      <div>
        <h1 className={ui.cardTitle} style={{ fontSize: 20 }}>
          SEO
        </h1>
        <p style={{ fontSize: 13, color: "var(--a-ink-2)", margin: "4px 0 0" }}>
          검색 도구 바로가기와, 우리 쪽에서 집계한 페이지별 조회수입니다.
        </p>
      </div>

      <div className={`${ui.grid} ${ui.cols2}`}>
        {TOOLS.map((tool) => (
          <a
            key={tool.href}
            className={ui.linkCard}
            href={tool.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={ui.linkIcon} aria-hidden>
              {tool.icon}
            </span>
            <span className={ui.linkBody}>
              <span className={ui.linkTitle}>{tool.title}</span>
              <span className={ui.linkDesc}>{tool.desc}</span>
            </span>
            <span className={ui.linkArrow} aria-hidden>
              ↗
            </span>
          </a>
        ))}
      </div>

      <Banner>
        <strong>Search Console API 연동은 아직 붙이지 않았습니다.</strong>
        <br />
        검색 순위 데이터를 앱 안으로 가져오려면 OAuth 토큰을 서버에 보관해야 해서 Edge Function
        이 필요합니다. 지금 구조에서는 <code className={ui.bannerCode}>adminApi.ts</code> 에 조회
        함수를 하나 더 추가하는 것으로 확장할 수 있습니다.
      </Banner>

      <Card
        title="페이지별 조회수"
        sub="page_path 기준 자동 집계 — 새 SEO 페이지를 만들면 코드 수정 없이 잡힙니다"
      >
        <DataState
          loading={pages.loading}
          error={pages.error}
          empty={(pages.data?.length ?? 0) === 0}
          emptyHint="아직 페이지뷰 기록이 없습니다."
          height={220}
        >
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.rankCell}>#</th>
                  <th>페이지</th>
                  <th className={ui.numCell}>PV</th>
                  <th className={ui.numCell}>고유 방문자</th>
                  <th className={ui.numCell}>방문자당 PV</th>
                </tr>
              </thead>
              <tbody>
                {(pages.data ?? []).map((row, index) => {
                  const pv = Number(row.page_views);
                  const visitors = Number(row.visitors);
                  return (
                    <tr key={row.page_path}>
                      <td className={ui.rankCell}>{index + 1}</td>
                      <td className={ui.pathCell}>{row.page_path}</td>
                      <td className={ui.numCell}>{formatNumber(pv)}</td>
                      <td className={ui.numCell}>{formatNumber(visitors)}</td>
                      <td className={ui.numCell}>
                        {visitors > 0 ? (pv / visitors).toFixed(1) : "—"}
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
