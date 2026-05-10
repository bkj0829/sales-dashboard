# 통합 매출 대시보드 v2 (clean build)

7개 채널 (카페24·샵바이·무신사·에이블리·스마트스토어·쿠팡·카카오스타일) 매출을 GitHub Actions가 자동 수집해서 PWA 대시보드로 보여주는 깨끗한 새 빌드입니다.

> 누적된 작은 수정들이 다 반영된 *최신 버전 한 번에 묶음*. 새 저장소에 통째로 올리시면 됩니다.

---

## 1. 5분 배포

### 1-1. 새 GitHub 저장소 만들기
1. <https://github.com/new>
2. Repository name: `sales-dashboard` (또는 자유)
3. Public/Private 자유 (Public 추천 — Actions 무제한 무료)
4. **Create repository**

### 1-2. 이 폴더 *전체* 업로드
저장소 메인 화면 → **Add file → Upload files** → 바탕화면 `매출보고\sales-dashboard-v2` 폴더의 *모든 항목* (`.github` 폴더 포함) 끌어다 놓기 → *Commit changes*

> 💡 윈도우 탐색기에서 `.github` 같은 *점으로 시작하는* 폴더가 안 보이면: 탐색기 → 보기 → *숨긴 항목* 체크.

### 1-3. GitHub Pages 활성화
저장소 → **Settings → Pages → Source** 드롭다운 → **GitHub Actions** 선택

### 1-4. Actions 권한 풀기
저장소 → **Settings → Actions → General**:
- Actions permissions: *Allow all actions*
- Workflow permissions: ✅ *Read and write permissions*
- ✅ *Allow GitHub Actions to create and approve pull requests*

→ Save

이 시점에 [https://(아이디).github.io/sales-dashboard/](https://github.io) 접속하면 빈 대시보드가 보입니다 (모든 채널 ₩0 정상).

---

## 2. 채널별 키 등록 (*받은 채널부터 자유롭게*)

저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| 채널 | Secret 이름 | 발급 |
|---|---|---|
| 카페24 | `CAFE24_MALL_ID`, `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `CAFE24_REFRESH_TOKEN` | [developers.cafe24.com](https://developers.cafe24.com) Private App |
| 쿠팡 | `COUPANG_VENDOR_ID`, `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY` | wing.coupang.com → MY정보 → Open API |
| 카카오스타일 | `KAKAOSTYLE_API_KEY` | partners.kakaostyle.com → 설정 → API 관리 |
| 무신사 | `MUSINSA_PARTNER_ID`, `MUSINSA_API_KEY` | 파트너 매니저 문의 |
| 에이블리 | `ABLY_API_KEY` | my.a-bly.com/seller/info → 셀러 정보 → API Token 발급 |
| 샵바이 | `SHOPBY_MALL_ID`, `SHOPBY_CLIENT_ID`, `SHOPBY_CLIENT_SECRET` | admin.shopby.co.kr/pro → 설정 → 외부 서비스 |
| **스마트스토어 (특수)** | `SMARTSTORE_CLIENT_ID`, `SMARTSTORE_CLIENT_SECRET` | apicenter.commerce.naver.com (★ 아래 별도 절차) |

선택 변수 (Variables 탭):
- `DAILY_GOAL_KRW` — 일 매출 목표 (예: `12000000`)

> 💡 Secret 입력 시 **앞뒤 공백/줄바꿈 주의**. 메모장에서 복사할 때 *Shift+End* 로 정확히 끝까지만 선택하세요.

---

## 3. 첫 실행

저장소 → **Actions** 탭 → 좌측 **Collect Sales** → **Run workflow** → 초록 버튼

1~2분 후 페이지 새로고침 → 등록한 채널은 매출, 안 한 채널은 *연동오류* 표시.

화면 맨 아래에 *🟡 진단 패널* 이 떠서 **각 채널이 뭐 때문에 막혔는지 한국어로 안내** 합니다.

---

## 4. 스마트스토어 — 특별 처리 (선택)

네이버 커머스 API는 **국내 IP + 고정 IP 화이트리스트** 만 허용해서 GitHub 무료 서버로 호출 불가. 본인 PC를 *self-hosted runner* 로 등록해야 합니다.

**필요한 거**: 항상 켜져 있는 본인 PC + Node.js 22

### 4-1. 본인 PC에 Node.js 22 설치
[nodejs.org](https://nodejs.org) → LTS 버전 설치

### 4-2. 본인 PC IP 네이버에 등록
1. [whatismyip.com](https://www.whatismyip.com) 으로 IPv4 주소 확인
2. [apicenter.commerce.naver.com](https://apicenter.commerce.naver.com) → 내 스토어 애플리케이션 → 수정 → API 호출 IP 추가 → 저장
3. **API 그룹 5개 모두** 체크 — 특히 *주문(조회 + 발주/발송 처리)*

### 4-3. self-hosted runner 설치
1. 저장소 → **Settings → Actions → Runners → New self-hosted runner**
2. **Windows + x64** 선택
3. 화면에 보이는 PowerShell 명령들 그대로 실행 (관리자 권한)
4. config.cmd 실행 시 질문은 모두 *Enter*
5. 설치 후 `./run.cmd` 실행 → "Listening for Jobs" 표시 → 그 PowerShell 창 *닫지 마세요*

### 4-4. 워크플로우 실행
저장소 → Actions → **Collect Smartstore (self-hosted)** → Run workflow

스마트스토어 카드만 진짜 매출 받기 시작. 나머지 6개 채널은 GitHub 무료 서버에서 그대로 동작.

---

## 5. 운영 메모

### 자동 갱신 주기
- **Collect Sales** (6채널): 매 15분
- **Collect Smartstore** (1채널): 매 30분 (본인 PC 켜져있을 때만)
- 매일 23:55 KST: 일/월/연 집계
- 모든 갱신 후 페이지 자동 재배포

### 휴대폰에서 보기
- 크롬/사파리로 페이지 접속 → 메뉴 → *홈 화면에 추가*

### 새로고침
- 우측 상단 ⟳ 버튼
- 모바일에서 위로 당기기

---

## 6. 폴더 구조

```
sales-dashboard-v2/
├─ index.html / app.js / style.css     ← 대시보드
├─ manifest.json / service-worker.js   ← PWA
├─ assets/                             ← 아이콘
├─ data/                               ← 매출 JSON (자동 갱신됨)
├─ scripts/
│  ├─ collect.js                       ← 6채널 통합 수집기
│  ├─ collect-smartstore.js            ← 스마트스토어 단독 (self-hosted)
│  ├─ aggregate.js                     ← 일/월/연 집계
│  └─ collectors/                      ← 채널별 모듈
└─ .github/workflows/
   ├─ collect-sales.yml                ← 15분 cron + Pages 자동 배포
   ├─ collect-smartstore.yml           ← 30분 cron, self-hosted runner 전용
   └─ pages.yml                        ← 수동 배포용 (선택)
```

---

## 7. 적용된 핵심 패치 (참고용)

이번 v2에 누적된 fix들:
- 쿠팡: HMAC 서명 *2자리 연도* (yyMMdd) + `searchType=timeFrame` 필수 파라미터
- 스마트스토어: 2단계 호출 (last-changed-statuses → query) + 필드명 `productOrderNos`
- 샵바이: 헤더 `Version: 1.0` + `AccessToken` (외부 API 연동 Key)
- 워크플로우: Node 22, 락파일 자동 처리, GH_TOKEN 명시 인증, cmd 셸 (Windows 호환)
- 대시보드: 인라인 진단 패널 (각 채널 에러 → 한국어 해결 안내)

---

## 문제 발생 시

페이지 맨 아래 **🟡 진단 패널** 이 어떤 채널이 왜 막혔는지 직접 알려줍니다. 거기 글자 그대로 복사해서 클로드에게 던지시면 보통 1~2줄 수정으로 풀려요.

새 폴더 / 새 저장소로 시작하셨으니 *과거 흔적 없이 깨끗* 합니다. 이제 진짜로 한 채널씩 풀어보세요!
