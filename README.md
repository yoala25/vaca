# 휴가요정

내 연차를 가장 잘 쓰는 방법을 달력 위에서 바로 비교하는 반응형 웹앱.

## 실행 방법

### 1) 그냥 열어보고 싶다면 (가장 간단)

```bash
npm install
npm run build:standalone
```

생성된 **`dist-standalone/index.html` 파일을 더블클릭**하면 바로 실행됩니다.
JS·CSS·이미지를 전부 한 파일에 넣어두었기 때문에 서버가 필요 없습니다.

> ⚠️ 일반 빌드(`dist/index.html`)는 더블클릭해도 흰 화면만 나옵니다.
> 브라우저가 `file://` 에서 외부 스크립트·스타일시트를 CORS 정책으로 차단하기 때문입니다.
> 파일로 직접 열 때는 반드시 `build:standalone` 결과물을 사용하세요.

### 2) 개발할 때

```bash
npm run dev
```

터미널에 표시되는 `http://localhost:5173` 주소를 **브라우저 주소창에 입력**해서 접속합니다.

### 3) 실제 배포할 때

`main` 에 푸시하면 GitHub Actions 가 자동으로 배포합니다.

| | 주소 |
|---|---|
| 서비스 | https://yoala25.github.io/vaca/ |
| 관리자 | https://yoala25.github.io/vaca/#/admin |

```bash
npm run build      # dist/ 생성 (수동 배포용)
npm run preview    # 빌드 결과를 로컬 서버로 확인
```

빌드에 필요한 값은 저장소 Secrets 에서 주입됩니다
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, 선택적으로 `VITE_GA_MEASUREMENT_ID`).

> 배포 주소가 바뀌면 Supabase → **Authentication → URL Configuration** 의
> Site URL 과 Redirect URLs 도 함께 바꿔야 소셜 로그인이 동작합니다.

## 명령어

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 일반 빌드 → `dist/` |
| `npm run build:standalone` | 단일 HTML 빌드 → `dist-standalone/index.html` |
| `npm test` | 휴가 계산 엔진 · 연도별 시뮬레이션 테스트 (107개) |
| `npm run lint` | 린트 |

## 구조

```
src/
  domain/vacation/   휴가 최적화 엔진 (UI 비의존 · 순수 도메인 로직)
    models/          LocalDate · WorkSchedule · LeaveType · DayInfo · Candidate
    calendar/        달력 생성 + 인덱싱
    candidates/      후보 생성 · 중복 제거
    constraints/     회사 규칙 검증
    scoring/         전략별 점수 (가중치는 scoring-config.ts에서만 조정)
    optimizer/       포트폴리오 최적화 (DP)
    overlays/        UI가 그대로 칠할 수 있는 오버레이 데이터
    explanations/    결정적 템플릿 기반 설명 생성
  components/        SimulatorCalendar · StrategyTabs · Sidebar · BottomNav
  pages/             Home(시뮬레이터) · Company · Favorites · Settings · Onboarding
  data/              공휴일 · 회사 휴가제도 (엔진에 주입되는 어댑터)
```

### 엔진 설계 원칙

- **AI를 호출하지 않습니다.** 전부 결정적(deterministic) 규칙 기반 계산이라 같은 입력이면 항상 같은 결과가 나옵니다.
- **날짜에 `Date` 객체를 쓰지 않습니다.** 정수 기반 civil-date 연산이라 실행 환경 타임존과 무관하게 결과가 동일합니다.
- **계산 단위는 '일'이 아니라 '분'입니다.** 반차·시간차·근무시간 차이를 정확히 다루기 위함입니다.
- **UI는 날짜 계산을 하지 않습니다.** 엔진이 만든 오버레이 데이터를 색칠만 합니다.

### 라우팅

`HashRouter`를 사용합니다(`/#/company` 형태).
`file://` 에서도 동작하고, 정적 호스팅에서 서버 rewrite 설정 없이 새로고침이 항상 정상 동작합니다.
백엔드에 rewrite 규칙을 붙일 수 있게 되면 `src/main.tsx`에서 `BrowserRouter`로 바꾸면 됩니다.

## 계정 · 데이터 저장 (Supabase)

게스트는 로그인 없이 바로 쓸 수 있고, 데이터는 브라우저에만 남습니다.
**MY** 메뉴에서 가입하면 계정에 저장돼 다른 기기에서도 이어집니다.

연결 정보는 `.env.local` 에 둡니다 (`.env.example` 참고, git에 올라가지 않음):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> publishable(anon) 키는 브라우저에 노출되는 것을 전제로 만들어진 공개 키입니다.
> 실제 데이터 보호는 이 키가 아니라 **RLS 정책**이 담당하므로 아래 SQL을 반드시 실행하세요.

### 1. 테이블 만들기 (필수)

Supabase 대시보드 → **SQL Editor** 에서 아래 두 파일을 **둘 다** 실행합니다(순서 무관, 여러 번 실행해도 안전).

| 파일 | 만드는 것 |
|---|---|
| [`supabase/schema.sql`](supabase/schema.sql) | 로그인 사용자의 휴가 설정 동기화(`planner_states`) |
| [`supabase/admin-analytics.sql`](supabase/admin-analytics.sql) | 관리자 권한(`profiles`) · 익명 통계(`analytics_events`) · 집계 함수 |

테이블이 없어도 휴가 계산은 브라우저 안에서 그대로 동작하고, 로그인·통계·관리자 기능만 꺼집니다.

> **프로젝트를 새로 만들어 옮길 때** 바꿀 곳은 네 군데입니다:
> `.env.local`, GitHub Secrets 두 개, Supabase **URL Configuration**,
> 그리고 구글 로그인을 쓴다면 Google Cloud OAuth 클라이언트의 리디렉션 URI
> (`https://<새 프로젝트>.supabase.co/auth/v1/callback`).

### 2. 이메일 가입 설정

기본값은 **이메일 인증 필수**라 가입 직후 로그인되지 않고 확인 메일이 갑니다.
바로 로그인되게 하려면 **Authentication → Providers → Email → Confirm email** 을 끄세요.

### 3. 구글 로그인 켜기

**Authentication → Providers → Google** 에서 켜야 버튼이 활성화됩니다.
앱은 시작할 때 실제 활성 상태를 조회해서, 꺼져 있으면 버튼을 "준비 중"으로 표시합니다.

1. Google Cloud 콘솔 → OAuth 클라이언트(웹) 생성
2. 승인된 리디렉션 URI 등록:
   ```
   https://<project>.supabase.co/auth/v1/callback
   ```
3. Client ID / Secret 을 Supabase 대시보드에 입력 (Secret 은 코드나 .env 에 두지 않는다)
4. **Authentication → URL Configuration** 에 서비스 주소 등록
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/**`

배포 후에는 Google 콘솔의 승인된 원본·리디렉션과 Supabase 의 URL Configuration 양쪽에
실제 도메인을 추가해야 합니다.

> 카카오·네이버 로그인은 현재 제공하지 않습니다.
> 필요해지면 `socialConfig.ts` 에 버튼 정의를 추가하고 Supabase 에서 해당 제공자를 켜면 됩니다
> (네이버는 Supabase 기본 지원이 없어 Edge Function 등 별도 연동이 필요합니다).

## 연도별 시뮬레이션 (내년·내후년 미리 짜기)

앱 전체가 **선택한 연도(`selectedYear`)** 를 기준으로 동작합니다.
연도 탭에서 2027년을 고르면 추천·TOP3·효율점수·레이더·달력이 전부 그 해 기준으로 다시 계산됩니다.
현재 주소는 `?year=2027` 로 유지되므로 링크를 그대로 공유·북마크할 수 있습니다.

### 연차 지갑

연차는 **연도별로 완전히 분리해서** `leaveWallet: Record<year, {days, type}>` 에 저장합니다.

| | 올해 이하 | 내년 이후 |
|---|---|---|
| 라벨 | 남은 연차 🪙 | 예상 연차 ✨ |
| 값이 없을 때 | 0일 | **입력 화면을 먼저 보여줌** (빈 추천 화면 대신) |

올해 값을 미래 연도로 자동 복사하지 않습니다. 연도마다 실제로 입력한 값만 씁니다.
(1년치 연차와 "올해 남은 연차"는 전혀 다른 숫자라 자동 복사하면 추천이 조용히 틀어집니다.)

### 공휴일 데이터

`src/data/holidays.ts` 의 `HOLIDAYS_BY_YEAR` 에 **2026 · 2027 · 2028년** 대한민국 공휴일
(대체공휴일 포함)을 정적으로 담고 있습니다.

**2029년을 추가하려면** `HOLIDAYS_BY_YEAR` 에 연도 키 하나만 넣으면 됩니다:

```ts
2029: [
  { monthDay: "01-01", name: "신정" },
  { monthDay: "02-13", name: "설날" },
  // ...
  { monthDay: "10-04", name: "개천절 대체공휴일", substitute: true },
],
```

연도 탭 · 데이터 커버리지 · URL 허용값이 모두 이 객체에서 자동으로 파생되므로
**다른 파일은 손대지 않아도 됩니다.**

> 설날·추석·부처님오신날은 음력 기반이라 양력 날짜를 규칙으로 계산할 수 없고,
> 대체공휴일도 예외가 있어(2028년 개천절이 추석과 겹쳐 10/5로 밀림) 규칙만으로는 틀립니다.
> 정부 관보로 확정된 값을 데이터로 두는 편이 정확합니다.

데이터가 없는 연도를 요청하면 `HolidayDataStatus.Incomplete` 로 표시되어 UI가 안내합니다.

네이버는 공휴일 조회용 공개 API를 제공하지 않으며, 국내 표준은 공공데이터포털의
"한국천문연구원 특일 정보" API입니다. 다만 브라우저에서 직접 호출하면 CORS로 차단되어
서버 프록시가 필요합니다. 엔진은 `HolidayProvider` 인터페이스만 알고 있으므로,
백엔드가 생기면 `src/data/holidayProvider.ts` 하나만 API 호출로 교체하면 됩니다.

## 보안 원칙

이 앱은 GitHub Pages 정적 호스팅입니다. **번들에 들어간 모든 값은 공개된다고 전제합니다.**

- 브라우저에는 공개 전제인 **publishable(anon) 키만** 둡니다.
  `service_role` 키·DB 비밀번호는 코드·`.env`·저장소 어디에도 두지 않습니다.
- 실제 데이터 보호는 키가 아니라 **RLS**가 합니다 → [`supabase/schema.sql`](supabase/schema.sql) 실행 필수.
- 권한은 프론트엔드에서 판단하지 않습니다. `isAdmin` 같은 값은 저장하지도, 읽지도 않습니다.
- 외부 입력(URL 파라미터 · localStorage · 서버 저장본)은 전부
  [`src/lib/validation.ts`](src/lib/validation.ts) 를 거쳐 정규화합니다.
- 서버 오류 원문은 화면에 띄우지 않습니다(테이블명·제약조건이 드러남). 개발 모드 콘솔에만 남깁니다.
