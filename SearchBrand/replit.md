# SEARCH SCOPE

**Slogan:** "See the Share. Shape the Strategy."

## Overview
네이버 검색 결과를 분석하고 전략을 설계하는 통합 모니터링 서비스입니다.
키워드를 검색하여 블로그, 카페, 지식iN, 뉴스 4개 채널의 검색 결과와 스마트블록(플레이스, 뉴스 등) 노출 현황을 실시간으로 확인할 수 있습니다. 시스템 API 키 풀을 통해 관리자가 중앙에서 네이버 API 키를 관리합니다.

## Recent Changes

### 2026-01-29 관리자 콘솔 UI/UX 간소화
- **시스템 API 키 탭**: 7개 요약 카드 → 2개 컴팩트 카드 (검색 API/트렌드 API)
- **API 사용량 탭**: 4개 카드 → 인라인 배지 형태, 쿼터 테이블 접기 가능
- **인사이트 탭**: 3개 요약 카드 → 1개 인라인 요약으로 통합
- **사이드바 정리**: 레거시 "사용자 API 키" 탭 제거, "시스템 API 키" → "API 키"로 명칭 단순화

### 2026-01-29 시스템 API 키 풀 아키텍처 도입
- **중앙 집중식 API 키 관리**: 사용자별 API 키 대신 관리자가 등록한 시스템 API 키 풀 사용
- **듀얼 쿼터 추적**: 동일 자격증명에 대해 검색 API와 트렌드 API를 별도로 추적
  - 검색 API: 일일 25,000건 기본 한도, 24,000건(임계값) 도달 시 자동 순환
  - 트렌드 API: 일일 1,000건 기본 한도, 950건(임계값) 도달 시 자동 순환
- **관리자 기능**:
  - 시스템 API 키 CRUD (슈퍼관리자 전용)
  - 검색/트렌드 API 사용량 분리 모니터링
  - 키별 듀얼 상태 표시: 검색 쿼터 + 트렌드 쿼터 각각
- **보안**: 
  - Client Secret AES-256-GCM 암호화 저장
  - 관리자 API 응답에서 Secret 노출 방지 (hasClientSecret 플래그만 반환)
- **에러 처리**: 모든 키 소진 시 503 NO_AVAILABLE_API_KEY 반환
- **사용자 프로필**: API 키 섹션 제거 (시스템 키 사용으로 불필요)
- **통합검색 UI**: API 키 설정 섹션 제거 (시스템 키로 자동 처리)
- **관련 파일**:
  - shared/schema.ts: systemApiKeys 테이블 스키마 (trendDailyLimit 필드)
  - server/services/system-api-key-service.ts: 키 관리 및 듀얼 순환 로직
  - server/services/quota-service.ts: 검색/트렌드 사용량 추적
  - server/naver-datalab-api.ts: 트렌드 API 시스템 키 연동
  - server/admin-routes.ts: 관리자 API 엔드포인트
  - client/src/pages/admin/SystemApiKeysTab.tsx: 관리자 UI (듀얼 쿼터 표시)

### 2026-01-27 키워드 인사이트 기능 추가
- **검색량 분석**: 네이버 광고 API를 통한 월간 검색량 (PC/모바일) 표시
- **트렌드 분석**: 네이버 데이터랩 API를 통한 13개월 검색 추이
  - MoM (전월 대비) 성장률 계산
  - YoY (전년 대비) 성장률 계산
- **경쟁도 지수**: 높음/중간/낮음 수준 표시
- **UI 컴포넌트**:
  - KeywordInsightCard: 검색량, PC/모바일 비율, 성장률 카드
  - KeywordTrendChart: Recharts 기반 월별 트렌드 차트
- **관련 파일**:
  - server/naver-datalab-api.ts: 데이터랩 API 클라이언트
  - client/src/components/keyword-insight-card.tsx
  - client/src/components/keyword-trend-chart.tsx

### 2026-01-27 모바일 스마트블록 기능 제거
- 스마트블록 크롤링이 PC 환경만 지원하도록 변경
- 모바일 관련 코드 및 UI 요소 완전 제거

### 2026-01-28 SOV 코드 정리 완료
- storage.ts: SOV 헬퍼 함수 및 import 제거
- audit-service.ts: sov_run, sov_run_delete 타입 제거
- AuditLogsTab.tsx: 'SOV 실행' 필터 옵션 제거
- SearchLogsTab.tsx: sov 배지 특수 처리 제거
- schema.ts: searchType 주석 업데이트

### 2026-01-27 SOV 분석 기능 제거
- SOV(Share of Voice) 분석 기능이 프로젝트에서 완전히 제거되었습니다.
- 제거된 파일: sov-service.ts, content-extractor.ts, sov-analysis.tsx, sov-panel.tsx, SovRunsTab.tsx
- 관리자 콘솔에서 SOV 관련 탭, 인사이트, 내보내기 기능 제거
- 데이터베이스의 sov_* 테이블은 기존 데이터 보존 및 계정 익명화를 위해 유지됨

### 2026-01-26 API 안정성 강화
- **Quota 관리**: 네이버 검색 API 일일 한도(25,000건/Client ID) 추적
  - `quota-service.ts`: 실시간 사용량 집계 및 한도 체크
  - 상태 레벨: ok(정상) / warning(80%+) / critical(90%+) / exceeded(100%)
  - 검색 응답에 quota 정보 포함, 초과 시 429 에러 반환
- **Rate Limiting**: bottleneck 라이브러리 기반 요청 제어
  - 네이버 광고 API: 20 req/sec
  - Browserless: 동시 2개 연결
- **Exponential Backoff 재시도**: 일시적 오류 자동 복구
  - Browserless: 3회 재시도 (1s, 2s, 4s 대기)
  - 타임아웃 포함 안전한 실패 처리
- **프론트엔드 표시**: 
  - 대시보드: 검색 결과 옆에 quota 사용률 배지
  - 관리자 콘솔: Client ID별 실시간 한도 현황 테이블
- **DB 스키마**: `apiUsageLogs.clientId` 컬럼 추가

### 2026-01-26 스마트블록 크롤링 로직 개선
- **헤더 셀렉터 일반화**: 다양한 템플릿 구조 대응
  - `[data-template-id*="Header"] h2` 및 `.sds-comps-text-type-headline1` (span) 추가
  - 인플루언서 블록 헤더(span 기반) 정상 추출
- **2단계 아이템 추출 전략**: 기존 호환성 + 확장성
  - 1단계: 기존 템플릿 셀렉터 (ugcItem, ugcItemDesk, webItem, li.bx)
  - 2단계: 확장 셀렉터 (.fds-ugc-item-list > [data-template-id], [data-template-id*="Item"])
- **데스크톱 인플루언서 블록**: `ugcItemDesk` 템플릿 대응
- **인플루언서 블록 제목/설명**: profile 외부 `.fds-comps-text.ellipsis2` 최우선 선택, `[class*="title"]` fallback도 profile 제외
- **모바일 인플루언서 블록**: `ugcItemMo` 템플릿 대응
- **중복 URL 자동 제거**: Set 기반 중복 체크
- **제목 추출 우선순위**: 제목 요소 → 링크 텍스트 → title 속성

### 2026-01-26 회원 탈퇴 기능 구현
- **3단계 탈퇴 프로세스**: Soft Delete → 익명화 → 완전 삭제
  - 1단계: `status='withdrawn'` + `deletedAt` 기록, 30일 유예 기간
  - 2단계: 30일 후 배치 작업으로 개인정보 익명화 (이메일, 이름 마스킹)
  - 3단계: 로그 데이터 userId를 'ANONYMIZED'로 변경
- **탈퇴 유예 기간 중 복구**: 로그인 시 "계정 복구하시겠습니까?" 안내
  - `/api/auth/restore` API로 즉시 복구 가능
- **재가입 방지**: 탈퇴한 이메일 해시 저장 (`withdrawn_emails` 테이블)
  - 30일간 동일 이메일 재가입 차단
  - 차단 기간 만료 시 자동 해제
- **프로필 페이지 UI**: 탈퇴 버튼, 비밀번호 확인 모달, 주의사항 안내
- **배치 스케줄러**: 24시간마다 만료된 계정 자동 익명화 (`account-cleanup.ts`)

### 2026-01-23 보안 및 성능 개선
- **XSS 방지**: DOMPurify로 외부 HTML sanitization (허용: b, strong, em, i, mark, br)
- **레이스 컨디션 방지**: AbortController로 빠른 연속 검색 시 이전 요청 취소
- **성능 최적화**: 스마트블록 URL 매칭 O(N*M) → O(1) Set 조회, useMemo 캐싱
- **프로덕션 보안 강화**: SESSION_SECRET 필수화, 민감 API 응답 로깅 제외
- **서비스 상태 API**: /api/services/quick-status 관리자 인증 추가
- **검색 실패 피드백**: toast 알림, 채널 페이지 자동 복원
- **CSV 내보내기**: 범위 명확화 ("현재 페이지 CSV")
- **코드 정리**: 미사용 디버그 파일 삭제, 서버 엔트리포인트 단일화

## Project Architecture

### Frontend (React + Vite)
```
/client/src/
├── pages/
│   ├── landing.tsx       # 비로그인 랜딩
│   ├── auth.tsx          # 로그인/회원가입
│   ├── dashboard.tsx     # 메인 대시보드
│   ├── place-review.tsx  # 플레이스 리뷰
│   ├── profile.tsx       # 사용자 프로필
│   └── admin/            # 어드민 모듈 (17개 파일)
├── components/
│   ├── header.tsx        # 공통 헤더
│   ├── search-panel.tsx  # 검색 입력
│   ├── smart-block-section.tsx
│   ├── api-results-section.tsx
│   └── ui/               # shadcn/ui 컴포넌트
├── hooks/
│   └── use-auth.ts       # 인증 훅
└── lib/
    ├── utils.ts          # 유틸리티
    └── sanitize.ts       # HTML sanitization
```

### Backend (Express + PostgreSQL)
```
/server/
├── bootstrap.ts          # 엔트리포인트
├── app.ts                # Express 앱 설정
├── routes.ts             # API 라우트
├── auth-routes.ts        # 인증 API
├── admin-routes.ts       # 어드민 API
├── storage.ts            # DB CRUD
├── naver-api.ts          # 네이버 API
├── crawler.ts            # Puppeteer 크롤링
├── crypto.ts             # 암호화
├── services/
│   ├── api-usage-logger.ts  # API 사용량 로깅
│   └── service-status.ts    # 서비스 상태 체크
├── queue/                # BullMQ 작업 큐
└── utils/
    └── browserless.ts    # Browserless 연결
```

### Database Schema
| 테이블 | 설명 |
|--------|------|
| users | 사용자 (email, password_hash, role) |
| sessions | 세션 저장소 |
| verification_tokens | 이메일 인증/비밀번호 재설정 |
| api_keys | 네이버 API 키 (암호화) |
| search_logs | 검색 로그 |
| place_review_analyses/results | 플레이스 리뷰 분석 |
| api_usage_logs | API 사용량 로그 |
| audit_logs | 감사 로그 |

## API Endpoints

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/user` - 현재 사용자
- `GET /api/auth/verify-email` - 이메일 인증
- `POST /api/auth/forgot-password` - 비밀번호 재설정 요청

### 검색
- `GET /api/search` - 통합 검색 (스마트블록 + API 4채널)
- `GET /api/search/channel` - 채널별 단일 검색

### 플레이스 리뷰
- `POST /api/place-review/analyze` - 분석 시작
- `GET /api/place-review/status/:analysisId` - 상태 조회
- `GET /api/place-review/analyses` - 분석 목록

### 어드민
- `GET /api/admin/users` - 사용자 목록
- `GET /api/admin/search-logs` - 검색 로그
- `GET /api/admin/audit-logs` - 감사 로그
- `GET /api/admin/api-usage/stats` - API 사용량 통계
- `GET /api/services/quick-status` - 서비스 상태 (관리자 전용)

## Environment Variables

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | 필수 | PostgreSQL 연결 |
| `SESSION_SECRET` | 필수 | 세션 암호화 키 (프로덕션 필수) |
| `ENCRYPTION_KEY` | 선택 | API 키 암호화 (미설정 시 SESSION_SECRET 파생) |
| `BROWSERLESS_API_KEY` | 선택 | 클라우드 브라우저 |
| `SENDGRID_API_KEY` | 선택 | 이메일 발송 |

**주의:** 프로덕션에서 `SESSION_SECRET` 미설정 시 앱 시작 실패

## Development Commands
```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run db:push      # DB 스키마 동기화
```

## User Preferences
- 한국어 UI
- Noto Sans KR 폰트
- 간결하고 일상적인 언어로 소통
