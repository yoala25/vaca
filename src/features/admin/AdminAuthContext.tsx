import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminSupabase, isAdminBackendConfigured } from "./adminClient";

/**
 * 관리자 인증 상태.
 *
 * 중요한 점: 여기서 role 을 읽는 것은 **화면을 그리기 위해서일 뿐**이다.
 * 실제 보호는 Supabase RLS 와 admin_guard() 가 한다.
 * 이 값을 개발자도구에서 true 로 바꿔도 통계 데이터는 한 줄도 나오지 않는다
 * (모든 RPC 가 서버에서 다시 검사하므로).
 */

export type AdminRole = "admin" | "user" | null;

interface AdminAuthValue {
  /** Supabase 설정 자체가 없는 상태 */
  configured: boolean;
  /** 세션 복구 중 */
  loading: boolean;
  /** 로그인/로그아웃 처리 중 */
  pending: boolean;
  email: string | null;
  role: AdminRole;
  /** 로그인했고 role 이 admin 인가 (화면 전환용) */
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

/** 로그인 오류 원문을 그대로 노출하지 않는다(계정 존재 여부 탐색 방지). */
function translate(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (lower.includes("email not confirmed")) return "메일 인증이 완료되지 않은 계정입니다.";
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (import.meta.env.DEV) console.warn("[admin-auth]", message);
  return "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isAdminBackendConfigured);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole>(null);

  /**
   * 로그인한 계정의 role 을 profiles 에서 읽는다.
   * profiles 의 RLS 가 "본인 행만" 허용하므로 남의 role 은 조회할 수 없다.
   */
  const loadRole = useCallback(async (userId: string): Promise<AdminRole> => {
    if (!adminSupabase) return null;
    try {
      const { data, error } = await adminSupabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        if (import.meta.env.DEV) console.warn("[admin-auth] role 조회 실패:", error.message);
        return "user";
      }
      return data?.role === "admin" ? "admin" : "user";
    } catch {
      return "user";
    }
  }, []);

  // 새로고침해도 세션이 유지되도록 복구한다.
  useEffect(() => {
    if (!adminSupabase) return;
    let active = true;

    const apply = async (session: { user: { id: string; email?: string } } | null) => {
      if (!active) return;
      if (!session?.user) {
        setEmail(null);
        setRole(null);
        setLoading(false);
        return;
      }
      setEmail(session.user.email ?? null);
      setRole(await loadRole(session.user.id));
      if (active) setLoading(false);
    };

    void adminSupabase.auth.getSession().then(({ data }) => void apply(data.session));

    const { data: sub } = adminSupabase.auth.onAuthStateChange((_event, session) => {
      void apply(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadRole]);

  const signIn = useCallback(
    async (inputEmail: string, password: string): Promise<string | null> => {
      if (!adminSupabase) return "서버 연결이 설정되지 않았습니다.";
      setPending(true);
      try {
        const { data, error } = await adminSupabase.auth.signInWithPassword({
          email: inputEmail.trim(),
          password,
        });
        if (error) return translate(error.message);
        if (!data.user) return "로그인에 실패했습니다.";

        const nextRole = await loadRole(data.user.id);
        setEmail(data.user.email ?? null);
        setRole(nextRole);

        if (nextRole !== "admin") {
          // 관리자가 아니면 세션을 남겨 둘 이유가 없다.
          await adminSupabase.auth.signOut();
          setEmail(null);
          setRole(null);
          return "이 계정에는 관리자 권한이 없습니다.";
        }
        return null;
      } catch {
        return "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      } finally {
        setPending(false);
      }
    },
    [loadRole],
  );

  const signOut = useCallback(async () => {
    if (!adminSupabase) return;
    setPending(true);
    try {
      await adminSupabase.auth.signOut();
    } finally {
      setEmail(null);
      setRole(null);
      setPending(false);
    }
  }, []);

  const value = useMemo<AdminAuthValue>(
    () => ({
      configured: isAdminBackendConfigured,
      loading,
      pending,
      email,
      role,
      isAdmin: role === "admin",
      signIn,
      signOut,
    }),
    [loading, pending, email, role, signIn, signOut],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return value;
}
