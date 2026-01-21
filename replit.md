# SearchBrand (Search Scope)

**Slogan:** "See the Share. Shape the Strategy."

네이버 검색 점유율을 파악하고 전략을 설계하는 통합 모니터링 서비스

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **통합검색** | 4채널(블로그, 카페, 지식iN, 뉴스) + 스마트블록 실시간 검색 |
| **SOV 분석** | 브랜드 노출 점유율 분석 (OpenAI 임베딩 기반) |
| **플레이스 리뷰** | 리뷰 수집 및 감성 분석 (Redis/BullMQ 백그라운드 처리), 플레이스명 자동 추출 |
| **관리자 콘솔** | 사용자/로그 관리, 시스템 상태 모니터링, 역할 기반 접근 제어 |

## 기술 스택

### Frontend
- React 18 + TypeScript + Vite
- TanStack Query (서버 상태), Wouter (라우팅)
- shadcn/ui + Tailwind CSS

### Backend
- Node.js + Express + TypeScript (ESM)
- PostgreSQL + Drizzle ORM
- Puppeteer (크롤링), Redis/BullMQ (백그라운드 작업)
- AES-256-GCM (API 키 암호화), bcryptjs (비밀번호)

### 외부 서비스
- **Naver API**: 검색 (사용자 키)
- **OpenAI**: 임베딩 (SOV 분석)
- **SendGrid**: 이메일 인증

## 페이지 라우트

| 경로 | 페이지 |
|------|--------|
| / | 통합검색 대시보드 |
| /sov | SOV 분석 |
| /place-review | 플레이스 리뷰 분석 |
| /profile | 사용자 프로필 |
| /admin | 관리자 콘솔 (admin/superadmin) |

## 환경 변수

| 변수 | 설명 |
|------|------|
| DATABASE_URL | PostgreSQL 연결 |
| SESSION_SECRET | 세션 서명 키 |
| OPENAI_API_KEY | OpenAI API |
| ENCRYPTION_KEY | API 키 암호화 (선택, SESSION_SECRET에서 파생) |

## 배포 설정

- **타입**: VM (Reserved VM) - 항상 실행
- **빌드**: npm run deploy:build (의존성 설치 + 빌드)
- **실행**: npm run deploy:start (DB 마이그레이션 + Redis 시작 + Chrome 설치 + 서버 시작)

### 프로덕션 서비스 가용성

| 서비스 | 필수 | 비활성화 시 영향 |
|--------|------|-----------------|
| PostgreSQL | 필수 | 앱 시작 불가 |
| Redis | 선택 | 플레이스 리뷰 분석 비활성화 |
| Chrome/Puppeteer | 선택 | 스마트블록 크롤링 비활성화 |
| OPENAI_API_KEY | 선택 | SOV 분석 비활성화 |

## 핵심 기능 의존성

| 기능 | 의존 시스템 | 핵심 파일 |
|------|------------|----------|
| **스마트블록** | Puppeteer + Chrome | server/crawler.ts |
| **통합검색** | Naver API | server/routes.ts, server/naver-api.ts |
| **SOV 분석** | OpenAI API | server/sov-service.ts |
| **플레이스 리뷰** | Redis + BullMQ | server/queue/place-review-queue.ts, server/services/place-review-scraper.ts |
| **인증** | PostgreSQL | server/auth-routes.ts, server/storage.ts |
| **관리자** | 역할 기반 접근 제어 | server/admin-routes.ts |
| **서비스 상태** | 헬스체크 | server/services/service-status.ts |

## 파일 구조

Search_Scope/
├── client/src/
│   ├── components/      # UI 컴포넌트
│   ├── pages/           # 페이지 컴포넌트
│   └── lib/             # 유틸리티
├── server/
│   ├── routes.ts        # API 라우트
│   ├── storage.ts       # DB 접근 레이어
│   ├── sov-service.ts   # SOV 분석 서비스
│   ├── queue/           # BullMQ 작업 큐
│   └── services/        # 비즈니스 로직
├── shared/
│   └── schema.ts        # DB 스키마 + 타입
└── dist/                # 빌드 결과물

## 배포 시 자주 발생하는 문제

| 문제 | 원인 | 해결 방법 |
|------|------|----------|
| 스마트블록 안 나옴 | Chrome 미설치 | npx puppeteer browsers install chrome |
| SOV 분석 실패 | OpenAI API 키 누락 | 환경변수 OPENAI_API_KEY 확인 |
| 플레이스 리뷰 멈춤 | Redis 연결 실패 | Redis 서버 상태 확인 |

## 사용자 선호

- 간단하고 일상적인 언어로 소통
- 기술 용어보다 이해하기 쉬운 설명 선호
