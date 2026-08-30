import { useState, type FormEvent } from "react";
import styles from "../../pages/Settings/SettingsPage.module.css";
import { useAuth } from "./AuthContext";
import { SOCIAL_PROVIDERS } from "./socialConfig";
import { slothBeach } from "../../assets/mascot";

type Mode = "signup" | "signin";

/** 로그아웃 상태의 MY 화면. 가입 혜택을 설명하고 4가지 가입 경로를 제공한다. */
export function SignUpPanel() {
  const { signUpWithEmail, signInWithEmail, startSocialSignIn, isSocialAvailable, cloudEnabled, pending } =
    useAuth();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message =
      mode === "signup"
        ? await signUpWithEmail(email, password, displayName)
        : await signInWithEmail(email, password);
    setError(message);
  };

  return (
    <>
      <section className={styles.promoCard}>
        <img className={styles.promoMascot} src={slothBeach} alt="" />
        <h2 className={styles.promoTitle}>
          회원가입하면
          <br />
          조회한 휴가 정보를 저장할 수 있어요
        </h2>
        <p className={styles.promoDesc}>
          지금은 이 브라우저에만 임시로 남아 있어요. 가입하면 내 계정에 저장돼요.
        </p>

        <div className={styles.benefits}>
          <span className={styles.benefit}>✅ 남은 연차와 회사 휴가제도 저장</span>
          <span className={styles.benefit}>✅ 찜한 휴가 조합 보관</span>
          <span className={styles.benefit}>✅ 직접 추가한 휴가 일정 유지</span>
        </div>

        <div className={styles.socialList}>
          {SOCIAL_PROVIDERS.map((provider) => {
            const available = isSocialAvailable(provider.id);
            return (
              <button
                key={provider.id}
                type="button"
                className={`${styles.socialBtn} ${available ? "" : styles.socialUnavailable}`}
                style={{
                  background: provider.background,
                  color: provider.color,
                  borderColor: provider.border ?? "transparent",
                }}
                disabled={pending}
                onClick={async () => setError(await startSocialSignIn(provider.id))}
              >
                <span className={styles.socialMark}>{provider.mark}</span>
                {provider.label}
                {!available && <span className={styles.socialBadge}>준비 중</span>}
              </button>
            );
          })}
        </div>

        <div className={styles.divider}>또는 이메일로 가입</div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${mode === "signup" ? styles.tabActive : ""}`}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            회원가입
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === "signin" ? styles.tabActive : ""}`}
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
          >
            로그인
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>이름</span>
              <input
                className={styles.input}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="휴가요정"
                autoComplete="nickname"
              />
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>이메일</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>비밀번호</span>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "signup" ? "영문+숫자 8자 이상" : "비밀번호"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </label>

          {error && <p className={styles.formError}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={pending}>
            {pending ? "처리 중…" : mode === "signup" ? "회원가입하고 저장하기" : "로그인"}
          </button>
        </form>

        {cloudEnabled ? (
          <p className={styles.formNoticeOk}>
            🔒 가입하면 <b>내 계정에 저장</b>돼요. 다른 기기에서 로그인해도 그대로 이어집니다.
          </p>
        ) : (
          <p className={styles.formNotice}>
            ⚠️ 지금은 <b>서버 없이 이 브라우저 안에서만</b> 계정이 만들어져요. 다른 기기나 브라우저에서는
            보이지 않고, 브라우저 데이터를 지우면 사라집니다.
          </p>
        )}
      </section>
    </>
  );
}
