import { useEffect, useState } from "react";
import type { AdminQueryResult } from "./adminApi";

/**
 * 관리자 통계 한 건을 불러오는 훅.
 *
 * deps 가 바뀌면(기간 변경·새로고침) 다시 조회한다.
 * 응답이 늦게 도착한 이전 요청이 최신 결과를 덮어쓰지 않도록 취소 플래그를 둔다.
 */
export function useAdminQuery<T>(
  fetcher: () => Promise<AdminQueryResult<T>>,
  deps: unknown[],
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void fetcher().then((result) => {
      if (!active) return;
      setData(result.data);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      active = false;
    };
    // fetcher 는 매 렌더 새로 만들어지므로 의존성에서 뺀다.
    // 조회를 다시 할 시점은 호출부가 deps 로 명시한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
