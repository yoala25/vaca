import { useState, type FormEvent } from "react";
import styles from "./AdminLogin.module.css";
import { useAdminAuth } from "./AdminAuthContext";
import { appIcon } from "../../assets/mascot";

/**
 * 관리자 로그인.
 *
 * 로그인하지 않은 사람에게는 이 화면만 보인다.
 * 다만 "화면을 숨기는 것"은 보안이 아니다 — 실제 방어는 Supabase RLS 와
 * admin_guard() 다. 이 화면을 우회해 API 를 직접 불러도 데이터는 나오지 않는다.
 */
export function AdminLogin() {
  // signedInEmail = 이미 로그인된 계정, email = 폼에 입력 중인 값
  const {
    signIn,
    signInWithGoogle,
    signOut,
    pending,
    configured,
    email: signedInEmail,
    role,
  } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const message = await signIn(email, password);
    if (message) setError(message);
  };

  /*
   * 로그인은 됐는데 관리자가 아닌 경우.
   * 빈 로그인 폼을 다시 보여주면 "왜 안 들어가지" 싶으므로 이유를 말해 준다.
   */
  if (role === "user") {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <img className={styles.icon} src={appIcon} alt="" />
          <h1 className={styles.title}>권한이 없습니다</h1>
          <p className={styles.desc}>
            <strong>{signedInEmail}</strong> 계정에는
            <br />
            관리자 권한이 없습니다.
          </p>
          <p className={styles.warn}>
            Supabase SQL Editor 에서 아래를 실행하면 관리자가 됩니다.
            <br />
            <code>
              update public.profiles set role = 'admin' where email = '{signedInEmail}';
            </code>
          </p>
          <button type="button" className={styles.submit} onClick={() => void signOut()}>
            다른 계정으로 로그인
          </button>
          <a className={styles.backLink} href="#/">
            ← 휴가요정으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <img className={styles.icon} src={appIcon} alt="" />
        <h1 className={styles.title}>휴가요정 관리자</h1>
        <p className={styles.desc}>관리자 계정으로 로그인하세요.</p>

        {!configured && (
          <p className={styles.warn}>
            서버 연결이 설정되지 않았습니다. <code>.env.local</code> 의 Supabase 값을 확인하세요.
          </p>
        )}

        <label className={styles.field}>
          <span className={styles.label}>이메일</span>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
            disabled={!configured || pending}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>비밀번호</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={!configured || pending}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={!configured || pending}>
          {pending ? "확인 중…" : "로그인"}
        </button>

        <div className={styles.divider}>
          <span>또는</span>
        </div>

        {/* 구글로 가입한 계정은 비밀번호가 없으므로 이 경로가 필요하다. */}
        <button
          type="button"
          className={styles.googleBtn}
          disabled={!configured || pending}
          onClick={() => void signInWithGoogle()}
        >
          <svg className={styles.googleIcon} viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
          </svg>
          구글 계정으로 로그인
        </button>

        <a className={styles.backLink} href="#/">
          ← 휴가요정으로 돌아가기
        </a>
      </form>
    </div>
  );
}
