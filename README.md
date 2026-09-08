# LIVE RANKING BOARD V3.4 (안정화 + 4개 보드 복원판)

스파르타 / 유니버스 / 데스레이블 남자 / 데스레이블 여자 — 4개 독립 보드 +
랭킹 URL 자동 연동 + 배틀점수(팀전) URL 연동 + OBS 송출까지 되는 통합판입니다.

## 이번 버전의 핵심 (그동안의 에러가 왜 계속 났는지)

지금까지 겪으신 "no valid credentials available" / 500 / 502 에러의 진짜 원인은
**브라우저에서 Supabase Realtime(WebSocket)에 직접 접속하는 방식** 때문이었어요.
이 방식은 최신 Supabase 키 형식과 궁합이 안 맞는 경우가 있어서 계속 실패했던 거예요.

이번 버전은 그 방식을 아예 걷어냈습니다:

- 브라우저는 이제 Supabase에 직접 연결하지 않고, **우리 서버(`/api/state`)에만** 물어봅니다.
- `/api/state`가 서버에서(Node 기본 HTTPS로) Supabase와 직접 통신합니다 — 훨씬 안정적입니다.
- 환경변수 값에 실수로 따옴표나 공백, `/rest/v1` 같은 접미사가 붙어도 서버가 자동으로 정리합니다.
- 문제가 있으면 관리자 화면에 **경고 배너로 원인을 바로 보여줍니다** (예: "동기화 서버 확인 필요").
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`는 더 이상 필요 없습니다.** (Realtime을 안 쓰기 때문)
  → 환경변수가 5개에서 **4개**로 줄었습니다.

## 환경변수 (Vercel Settings → Environment Variables) — 이제 4개만

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://프로젝트ID.supabase.co` (뒤에 `/rest/v1` 등 절대 붙이지 마세요) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Legacy 탭의 service_role 키 (`eyJ...`) — 새 형식(`sb_secret_...`)도 이제 문제없이 동작합니다 |
| `ADMIN_KEY` | 원하는 관리자 비밀번호 |
| `CRON_SECRET` | 임의의 긴 문자열 |

(이미 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넣어두셨다면 지우지 않고 그냥 두셔도 무해합니다. 안 쓰일 뿐이에요.)

## 배포 순서

1. Supabase SQL Editor에서 `supabase.sql` 실행 (테이블 없으면 처음부터 실행)
2. GitHub 저장소에 이 폴더 전체 업로드/반영
3. Vercel에서 새 프로젝트로 Import (또는 기존 Git 연결 프로젝트라면 그대로 push)
4. 위 4개 환경변수 입력 → Deploy

## OBS 주소

배포 도메인이 `https://example.vercel.app`이면:

- 스파르타: `/sparta/obs`
- 유니버스: `/universe/obs`
- 데스레이블 남자: `/death-male/obs`
- 데스레이블 여자: `/death-female/obs`

관리자 화면(`/스파르타` 등) 안에도 실제 배포 도메인을 포함한 주소가 표시되고, "주소 복사" 버튼으로 바로 복사할 수 있어요.

## 새로 추가된 기능: 배틀점수(팀전) 연결

관리자 화면에 "배틀점수 · 팀전 연결" 섹션이 추가됐어요. 랭킹 URL과는 별개로
팀전 대결용 URL을 하나 더 연결할 수 있고, 팀명/팀색상/인원수를 지정하면
OBS 화면에 팀 대 팀 점유율·점수차가 함께 표시됩니다. 안 쓰셔도 되고, 필요할 때만 채우면 돼요.

## 표 구조가 사이트마다 달라서 확인이 필요해요

`app/api/data`(단순 fetch)와 `app/api/cron-scrape`(헤드리스 브라우저, JS 렌더링 사이트용)
둘 다 표에서 "숫자로 끝나는 셀 = 점수, 그 앞의 닉네임 같은 셀 = 이름"이라는 규칙으로
자동 인식합니다. 공지문이나 안내 문구를 스트리머로 잘못 인식하지 않도록 필터링도 들어있어요.
그래도 특정 사이트에서 계속 이상하게 인식되면, 그 페이지를 캡처해서 보내주시면 규칙을 맞춰드릴게요.
