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
- **실행**: `npm run deploy:start` (DB 마이그레이션 + 서버 시작)
- **Cold Start 최적화**: 2단계 부팅 (헬스체크 먼저, 앱 초기화 나중)

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

## 주의사항

### 흔한 실수
1. **API 응답 매핑 누락**: 스키마에 필드 추가 후 `routes.ts`에서 반환하지 않음
2. **DB 마이그레이션 누락**: 배포 시 `db:push` 실행 확인 필요
3. **타입 불일치**: 서버/클라이언트 간 타입 동기화 필수

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

### SOV 분석
- 상세 진행 상태 메시지 표시 ("크롤링 중...", "3/50 분석 완료")
- 다단계 타임아웃: 전체 10분, 개별 30초, 임베딩 20초
- API 응답에 `statusMessage`, `processedExposures`, `errorMessage` 포함

### 플레이스 리뷰
- 날짜 필터링 버그 수정 (DATE 모드 정상 동작)
- 강화된 날짜 추출 로직
- 프로덕션 디버그 로그 추가

### 일반
- 배포 전 체크리스트 강화
