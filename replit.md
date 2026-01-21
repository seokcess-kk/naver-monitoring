# SearchBrand (Search Scope)

**Slogan:** "See the Share. Shape the Strategy."

네이버 검색 점유율을 파악하고 전략을 설계하는 통합 모니터링 서비스

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **통합검색** | 4채널(블로그, 카페, 지식iN, 뉴스) + 스마트블록 실시간 검색 |
| **SOV 분석** | 브랜드 노출 점유율 분석 (OpenAI 임베딩 기반) |
| **플레이스 리뷰** | 리뷰 수집 및 감성 분석 (Redis/BullMQ 백그라운드 처리) |
| **관리자 콘솔** | 사용자/로그 관리, 역할 기반 접근 제어 |

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
| `/` | 통합검색 대시보드 |
| `/sov` | SOV 분석 |
| `/place-review` | 플레이스 리뷰 분석 |
| `/profile` | 사용자 프로필 |
| `/admin` | 관리자 콘솔 (admin/superadmin) |

## 환경 변수

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 |
| `SESSION_SECRET` | 세션 서명 키 |
| `OPENAI_API_KEY` | OpenAI API |
| `ENCRYPTION_KEY` | API 키 암호화 (선택, SESSION_SECRET에서 파생) |

## 배포 설정

- **타입**: VM (Reserved VM) - 항상 실행
- **빌드**: `npm run deploy:build` (의존성 설치 + 빌드)
- **실행**: `npm run deploy:start` (DB 마이그레이션 + Redis 시작 + Chrome 설치 + 서버 시작)
- **Cold Start 최적화**: 2단계 부팅 (헬스체크 먼저, 앱 초기화 나중)

### 프로덕션 서비스 가용성

| 서비스 | 필수 | 비활성화 시 영향 |
|--------|------|-----------------|
| PostgreSQL | 필수 | 앱 시작 불가 |
| Redis | 선택 | 플레이스 리뷰 분석 비활성화 (다른 기능 정상) |
| Chrome/Puppeteer | 선택 | 스마트블록 크롤링 비활성화 (다른 기능 정상) |
| OPENAI_API_KEY | 선택 | SOV 분석 비활성화 |

### 배포 스크립트 동작
1. `npm run db:push` - DB 마이그레이션
2. `redis-server --daemonize yes` - Redis 백그라운드 시작 (실패 시 경고만)
3. `npx puppeteer browsers install chrome` - Chrome 설치 (실패 시 경고만)
4. `node dist/index.cjs` - 서버 시작

## 개발/배포 체크리스트

### 코드 변경 시

1. **스키마 변경 시**
   - [ ] `shared/schema.ts` 수정
   - [ ] 관련 API 응답에 새 필드 포함 확인 (`routes.ts` 매핑 확인)
   - [ ] 클라이언트 타입/인터페이스 동기화

2. **API 변경 시**
   - [ ] 요청/응답 타입 정의
   - [ ] 클라이언트 쿼리/뮤테이션 업데이트
   - [ ] 에러 처리 확인

3. **UI 변경 시**
   - [ ] 모바일/데스크톱 반응형 확인
   - [ ] 로딩/에러 상태 처리

### 빌드 전

- [ ] `npm run build` 성공
- [ ] 콘솔 에러 없음
- [ ] 워크플로우 재시작 후 정상 동작

### 배포 전 테스트 (개발 환경)

- [ ] **통합검색**: 4채널 결과 + 스마트블록 표시
- [ ] **SOV 분석**: 진행 상태 메시지 표시, 결과 저장
- [ ] **플레이스 리뷰**: 크롤링 + 분석 정상 동작
- [ ] **인증**: 로그인/로그아웃 정상

### 배포 후 확인

- [ ] 프로덕션 DB 마이그레이션 적용 확인
- [ ] 주요 기능 프로덕션에서 테스트
- [ ] 에러 로그 모니터링

## 핵심 기능 의존성

수정 작업 시 기존 기능이 영향받지 않도록 아래 의존성을 확인하세요.

| 기능 | 의존 시스템 | 핵심 파일 | 수정 시 확인 사항 |
|------|------------|----------|------------------|
| **스마트블록 크롤링** | Puppeteer + Chrome | `server/crawler.ts` | Chrome 설치 상태, 로그에서 `[Crawler] Using` 메시지 확인 |
| **통합검색 API** | Naver API + 사용자 키 | `server/routes.ts`, `server/naver-api.ts` | API 키 설정 여부, 4채널 결과 반환 |
| **SOV 분석** | OpenAI API + 임베딩 | `server/sov-service.ts` | OPENAI_API_KEY, statusMessage 포함 여부 |
| **플레이스 리뷰** | Redis + BullMQ + Puppeteer | `server/queue/place-review-queue.ts` | Redis 연결, 워커 시작 로그 확인 |
| **인증/세션** | PostgreSQL + 세션 | `server/auth.ts`, `server/storage.ts` | SESSION_SECRET, DB 연결 |
| **관리자 콘솔** | 역할 기반 접근 제어 | `server/admin-routes.ts` | superadmin/admin 권한 확인 |

### 파일별 영향 범위

| 파일 수정 시 | 영향받는 기능 | 필수 테스트 |
|-------------|-------------|------------|
| `shared/schema.ts` | 전체 DB 관련 기능 | DB push, API 응답 매핑 확인 |
| `server/routes.ts` | 모든 API 엔드포인트 | 해당 API 호출 테스트 |
| `server/crawler.ts` | 스마트블록 | 검색 후 스마트블록 표시 확인 |
| `server/sov-service.ts` | SOV 분석 | SOV 실행 및 진행 상태 확인 |
| `server/queue/*.ts` | 플레이스 리뷰 | 리뷰 크롤링 및 분석 작동 확인 |
| `client/src/pages/*.tsx` | 해당 페이지 UI | 페이지 렌더링 및 기능 확인 |

### 배포 시 자주 발생하는 문제

| 문제 | 원인 | 해결 방법 |
|------|------|----------|
| 스마트블록 안 나옴 | Chrome 미설치 | `npx puppeteer browsers install chrome` 실행 |
| SOV 분석 실패 | OpenAI API 키 누락 | 환경변수 OPENAI_API_KEY 확인 |
| 플레이스 리뷰 멈춤 | Redis 연결 실패 | Redis 서버 상태 확인 |
| API 필드 누락 | routes.ts 매핑 누락 | 스키마 필드가 응답에 포함되는지 확인 |

## 주의사항

### 흔한 실수
1. **API 응답 매핑 누락**: 스키마에 필드 추가 후 `routes.ts`에서 반환하지 않음
2. **DB 마이그레이션 누락**: 배포 시 `db:push` 실행 확인 필요
3. **타입 불일치**: 서버/클라이언트 간 타입 동기화 필수
4. **Chrome 캐시 초기화**: 배포 환경에서 Chrome 재설치 필요할 수 있음

### 파일 구조
```
Search_Scope/
├── client/src/          # React 프론트엔드
│   ├── components/      # UI 컴포넌트
│   ├── pages/           # 페이지 컴포넌트
│   └── lib/             # 유틸리티
├── server/              # Express 백엔드
│   ├── routes.ts        # API 라우트
│   ├── storage.ts       # DB 접근 레이어
│   ├── sov-service.ts   # SOV 분석 서비스
│   └── services/        # 비즈니스 로직
├── shared/              # 공유 코드
│   └── schema.ts        # DB 스키마 + 타입
└── dist/                # 빌드 결과물
```

## 사용자 선호

- 간단하고 일상적인 언어로 소통
- 기술 용어보다 이해하기 쉬운 설명 선호

## 최근 변경사항 (2026년 1월)

### 스마트블록 크롤링 (1/21)
- Chrome 경로 검증 로직 강화 (`existsSync`로 실제 파일 존재 확인)
- 명확한 경고 메시지 추가 (Chrome 미설치 시 원인 파악 용이)
- 핵심 기능 의존성 문서화 추가

### SOV 분석
- 상세 진행 상태 메시지 표시 ("크롤링 중...", "3/50 분석 완료")
- 다단계 타임아웃: 전체 10분, 개별 30초, 임베딩 20초
- API 응답에 `statusMessage`, `processedExposures`, `errorMessage` 포함

### 플레이스 리뷰
- statusMessage 필드 추가 (진행 상태 표시)
- 날짜 필터링 버그 수정 (DATE 모드 정상 동작)
- 강화된 날짜 추출 로직
- 프로덕션 디버그 로그 추가

### 일반
- 핵심 기능 의존성 테이블 추가
- 파일별 영향 범위 문서화
- 배포 시 자주 발생하는 문제 가이드 추가
