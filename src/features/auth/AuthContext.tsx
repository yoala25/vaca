import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { localAuthStore } from "./localAuthStore";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import * as supabaseAuth from "./supabaseAuth";
import { fetchEnabledSocialProviders, toAuthUser } from "./supabaseAuth";
import type { AuthUser, SocialProvider } from "./authTypes";

interface AuthContextValue {
  user: AuthUser | null;
  isSignedIn: boolean;
  pending: boolean;
  /** 세션 복구가 끝나기 전인지. 첫 렌더에서 깜빡임을 막는 데 쓴다. */
  loading: boolean;
  /** 서버(Supabase)에 연결돼 실제 계정으로 저장되는지. */
  cloudEnabled: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  startSocialSignIn: (provider: SocialProvider) => Promise<string | null>;
  isSocialAvailable: (provider: SocialProvider) => boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cloudEnabled = isSupabaseConfigured;
  const [user, setUser] = useState<AuthUser | null>(() =>
    cloudEnabled ? null : localAuthStore.getCurrentUser(),
  );
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(cloudEnabled);
  // 대시보드에서 실제로 켜진 소셜 제공자만 버튼을 활성화한다.
  const [enabledSocials, setEnabledSocials] = useState<SocialProvider[]>([]);

  useEffect(() => {
    if (!cloudEnabled) return;
    let active = true;
    void fetchEnabledSocialProviders().then((providers) => {
      if (active) setEnabledSocials(providers);
    });
    return () => {
      active = false;
    };
  }, [cloudEnabled]);

  // Supabase 세션 복구 + 이후 상태 변화 구독(소셜 리디렉션 복귀 포함).
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ? toAuthUser(data.session.user) : null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      setPending(true);
      try {
        if (cloudEnabled) {
          const result = await supabaseAuth.signUpWithEmail(email, password, displayName);
          if (!result.ok) return result.message;
          setUser(result.user);
          return null;
        }
        const result = await localAuthStore.signUpWithEmail(email, password, displayName);
        if (!result.ok) return result.message;
        setUser(result.user);
        return null;
      } finally {
        setPending(false);
      }
    },
    [cloudEnabled],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setPending(true);
      try {
        const result = cloudEnabled
          ? await supabaseAuth.signInWithEmail(email, password)
          : await localAuthStore.signInWithEmail(email, password);
        if (!result.ok) return result.message;
        setUser(result.user);
        return null;
      } finally {
        setPending(false);
      }
    },
    [cloudEnabled],
  );

  const startSocialSignIn = useCallback(
    async (provider: SocialProvider) => {
      if (!cloudEnabled) return "서버 연결이 설정되지 않아 소셜 로그인을 쓸 수 없어요.";
      if (location.protocol === "file:") {
        return "파일로 연 상태에서는 소셜 로그인을 쓸 수 없어요. 주소로 접속해 주세요.";
      }
      if (!enabledSocials.includes(provider)) {
        return "구글 로그인이 아직 켜져 있지 않아요. 이메일로 가입하거나 관리자에게 문의해 주세요.";
      }
      setPending(true);
      try {
        return await supabaseAuth.signInWithSocial(provider);
      } finally {
        setPending(false);
      }
    },
    [cloudEnabled, enabledSocials],
  );

  const isSocialAvailable = useCallback(
    (provider: SocialProvider) =>
      cloudEnabled && location.protocol !== "file:" && enabledSocials.includes(provider),
    [cloudEnabled, enabledSocials],
  );

  const signOut = useCallback(() => {
    if (cloudEnabled) void supabaseAuth.signOut();
    else localAuthStore.signOut();
    setUser(null);
  }, [cloudEnabled]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isSignedIn: user !== null,
      pending,
      loading,
      cloudEnabled,
      signUpWithEmail,
      signInWithEmail,
      startSocialSignIn,
      isSocialAvailable,
      signOut,
    }),
    [
      user,
      pending,
      loading,
      cloudEnabled,
      signUpWithEmail,
      signInWithEmail,
      startSocialSignIn,
      isSocialAvailable,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
