# Live Ranking Board V2 (실시간 자동 연동판)

Vercel + Next.js + Supabase Realtime + Vercel Cron(헤드리스 브라우저) 기반
실시간 상벌칙 랭킹보드입니다. 모든 PC, OBS가 Supabase를 통해 실시간으로 동기화됩니다.

## ⚠️ 배포 전 꼭 확인 — "Other로 설정되어 있다" 경고

이전에 같은 이름의 Vercel 프로젝트를 정적 사이트(Other)로 만든 적이 있다면,
그 프로젝트 설정이 남아있어서 Next.js 파일을 새로 올려도 계속 "Other"로 인식되고,
디자인이 안 바뀌거나 빌드가 이상하게 동작할 수 있습니다.

**가장 확실한 해결책: 완전히 새로운 Vercel 프로젝트로 만드세요.**

1. 기존 프로젝트(`live_scoredev` 등)는 그대로 두거나 삭제하고
2. Vercel 대시보드 → **Add New → Project** → 이 코드가 든 GitHub 저장소를 **새로** Import
3. Import 화면에서 Framework Preset이 자동으로 **Next.js**로 잡히는지 확인 (자동으로 잡힙니다)
4. 그대로 Deploy

기존 프로젝트를 재사용하고 싶다면 **Settings → General → Framework Preset**을 수동으로
"Next.js"로 바꾸고, **Build & Development Settings**에 있는 모든 Override(Build Command,
Output Directory 등)를 꺼서 기본값으로 되돌린 뒤 Redeploy 해야 합니다.

## 이번에 새로 추가한 것: 진짜 자동 연동 (Vercel Cron + 헤드리스 브라우저)

`scoredev.flabs.kr`처럼 값이 자바스크립트로 나중에 채워지는 사이트는
서버가 그냥 주소만 요청해서는 값을 못 읽습니다. 그래서:

- `app/api/cron-scrape` — **Vercel Cron이 1분마다 자동 실행**하는 함수입니다.
  헤드리스 브라우저(가짜 브라우저)를 서버에서 직접 띄워서, 관리자 화면에
  등록된 "자동엑셀 연결" 주소들을 전부 열어놓고, **실행되는 동안(약 50초) 3초 간격으로
  계속 값을 읽어서 Supabase에 저장**합니다.
- 1분마다 다시 실행되면서 이 과정을 반복하기 때문에, 매 분 시작할 때 1~2초 정도의
  짧은 이음새만 있고 사실상 3초 간격 실시간에 가깝게 동작합니다.
- Supabase에 저장된 값은 Realtime으로 모든 PC/브라우저/OBS에 즉시 반영됩니다 —
  admin.html 방식과 달리 브라우저(localStorage)에 의존하지 않아서
  **다른 PC에서 열어도, OBS에서 열어도 항상 같은 값**을 보게 됩니다.

### 표 구조가 사이트마다 달라서 확인이 필요해요

`app/api/cron-scrape/route.ts` 안에서 표를 읽는 방식은 일반적인 형태(`table tr`)로
짜여 있어서, 실제 flabs.kr 표의 열 순서와 정확히 안 맞을 수 있습니다.

배포 후 확인 방법:
1. Vercel 프로젝트 → **Deployments → Functions/Logs**에서 `cron-scrape` 실행 로그 확인
2. 관리자 화면(`/스파르타` 등)에서 인원수가 0명으로 계속 뜨면, flabs.kr 페이지를
   크롬에서 열고 이름/기여도가 있는 셀을 **우클릭 → 검사(Inspect)** →
   나오는 HTML 구조를 캡처해서 알려주시면 `scrapeRows` 함수의 열 인덱스를
   정확히 맞춰드릴 수 있어요.

## 배포 순서

1. GitHub 저장소로 새 프로젝트 Import (위 경고 항목 참고)
2. Supabase 프로젝트 생성 → SQL Editor에서 `supabase.sql` 실행
3. Vercel **Settings → Environment Variables**에 입력:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_KEY` (원하는 관리키로 변경)
   - `CRON_SECRET` (임의의 긴 문자열 — Vercel이 Cron 호출 시 자동으로 이 값을 인증 헤더에 넣어줍니다)
4. **Settings → Cron Jobs**에서 `/api/cron-scrape`가 1분 간격으로 등록됐는지 확인 (Pro 플랜 필요)
5. Redeploy

## 사용 순서

1. `/스파르타`(또는 원하는 보드) 접속 → 관리키로 잠금 해제
2. "자동엑셀 연결" 칸에 `https://scoredev.flabs.kr/본인주소` 입력 후 저장
3. 1분 이내에 Cron이 실행되면서 값이 채워지기 시작합니다 (완전히 채워지기까지 최대 1분 정도 걸릴 수 있음)
4. "송출 화면"으로 OBS에 넣을 주소 확인 → OBS 브라우저 소스에 등록 (배경 투명)

## 참고

- 함수가 매 분마다 최대 50초씩 브라우저를 띄우고 있어서 Vercel 사용량(Function 실행시간)에
  영향이 있습니다. 처음 며칠은 Vercel 대시보드 Usage 탭을 확인해보세요.
- 이용약관상 "제3자 배포 금지" 조항은 본인 계정/본인 화면 용도로 쓰는 한도 내에서 참고만 해주세요.
- 순수 JSON이나 단순 HTML 표를 제공하는 소스는 `app/api/data` 프록시로도 즉시(3초 간격) 잘 동작합니다.
