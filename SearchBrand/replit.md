# SEARCH SCOPE

**Slogan:** "See the Share. Shape the Strategy."

## Overview
점유율을 파악하고 전략을 설계하는 네이버 검색 통합 모니터링 서비스입니다.
회원별로 네이버 API 키를 등록하고, 키워드를 검색하여 블로그, 카페, 지식iN, 뉴스 4개 채널의 검색 결과와 스마트블록(플레이스, 뉴스 등) 노출 현황을 실시간으로 확인할 수 있습니다. SOV(Share of Voice) 분석으로 브랜드 점유율을 측정하세요.

## Recent Changes

### 2026-01-26 스마트블록 크롤링 로직 개선
- **헤더 셀렉터 일반화**: 다양한 템플릿 구조 대응
  - `[data-template-id*="Header"] h2` 및 `.sds-comps-text-type-headline1` (span) 추가
  - 인플루언서 블록 헤더(span 기반) 정상 추출
- **2단계 아이템 추출 전략**: 기존 호환성 + 확장성
  - 1단계: 기존 템플릿 셀렉터 (ugcItem, ugcItemDesk, webItem, li.bx)
  - 2단계: 확장 셀렉터 (.fds-ugc-item-list > [data-template-id], [data-template-id*="Item"])
- **데스크톱 인플루언서 블록**: `ugcItemDesk` 템플릿 대응
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

### 2026-01-24 콘텐츠 추출 강화
- **SOV 타임아웃 분리**: 추출(45초) / 임베딩(15초) 단계별 독립 타임아웃
  - 추출 실패해도 임베딩 단계로 진행하지 않고 다음 항목 처리
  - 실패 원인별 통계 추적 (추출 타임아웃/실패, 임베딩 타임아웃/실패)
  - 상태 메시지에 실패 통계 포함 (예: "추출 타임아웃 3건, 임베딩 실패 1건")
- **메타데이터 fallback 신뢰도 옵션**: 브랜드 매칭 없어도 시장 키워드 매칭 시 저장
  - `success_metadata_low` 상태: 시장 키워드는 포함되나 브랜드는 미매칭
  - `needsReview` 플래그로 DB에 기록, SOV 계산에서 제외
  - "검토 필요" 목록으로 별도 표기 가능
- **OCR 적용 범위 확장**: blog, cafe, post → + news, view 추가
  - 추출 실패 시 OCR 시도
  - 콘텐츠가 200자 미만이면 OCR 보충 시도 (이미지 중심 콘텐츠 대응)
  - OCR 성공 시 기존 텍스트와 합쳐서 반환, status: "success_ocr"
- **블로그 PC fallback**: 모바일 추출 실패 시 데스크톱 버전으로 재시도
  - `extractBlogContentMobile` → `extractBlogContentPC` 순차 시도
  - PC 버전은 `iframe#mainFrame` 내부 콘텐츠 자동 탐색
- **자동 스크롤**: 페이지 하단까지 스크롤하여 동적 콘텐츠 로딩 트리거
- **더보기 버튼 클릭**: 텍스트 기반(더보기/펼치기/전체보기) + aria-label 기반 버튼 자동 클릭
- **네이버 전용 셀렉터**: .se-oglink-summary-container-toggle 등 플랫폼별 확장 버튼 처리
- **적용 범위**: extractBlogContent, extractCafeContentMobile, extractViewContent, extractNewsContent
- **콘텐츠 증가 로깅**: 스크롤/클릭 후 본문 길이 변화 추적

### 2026-01-23 보안 및 성능 개선
- **XSS 방지**: DOMPurify로 외부 HTML sanitization (허용: b, strong, em, i, mark, br)
- **레이스 컨디션 방지**: AbortController로 빠른 연속 검색 시 이전 요청 취소
- **성능 최적화**: 스마트블록 URL 매칭 O(N*M) → O(1) Set 조회, useMemo 캐싱
- **프로덕션 보안 강화**: SESSION_SECRET 필수화, 민감 API 응답 로깅 제외
- **서비스 상태 API**: /api/services/quick-status 관리자 인증 추가
- **검색 실패 피드백**: toast 알림, 채널 페이지 자동 복원
- **CSV 내보내기**: 범위 명확화 ("현재 페이지 CSV")
- **코드 정리**: 미사용 디버그 파일 삭제, 서버 엔트리포인트 단일화

### 2026-01-23 어드민 대시보드 개선
- **레이아웃 리팩토링**: 3367줄 → 130줄 + 17개 모듈 파일
- **사이드바 네비게이션**: 그룹화된 탭, 검색, 즐겨찾기(핀) 기능
- **통일된 탭 레이아웃**: 요약 → 필터 → 리스트 구조
- **공통 컴포넌트**: StateComponents, TabPageLayout, FilterRow
- **새 탭**: API 사용량 모니터링, 데이터 품질, 시스템 상태
- **Draft/Applied 필터 패턴**: 불필요한 API 호출 방지

### 2026-01-23 크롤링 안정성 개선
- **Browserless 연동**: 프로덕션에서 클라우드 브라우저 사용
- **Puppeteer 리팩토링**: withBrowserPage 헬퍼, 전략 테이블 기반 추출
- **동시성 관리**: ExtractionStatsCollector 클래스 기반 상태 격리

### 2026-01-14 이전 주요 변경
- 모바일 반응형 디자인 전면 개선
- 이메일/비밀번호 인증 시스템 (SendGrid)
- SOV 분석 기능 (OpenAI 임베딩)
- 채널별 독립 페이지네이션
- 프로덕션 보안 강화 (rate-limit, 암호화, 캐싱)

## Project Architecture

### Frontend (React + Vite)
```
/client/src/
├── pages/
│   ├── landing.tsx       # 비로그인 랜딩
│   ├── auth.tsx          # 로그인/회원가입
│   ├── dashboard.tsx     # 메인 대시보드
│   ├── sov.tsx           # SOV 분석
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
├── sov-service.ts        # SOV 분석
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
| sov_runs/exposures/scores/results | SOV 분석 데이터 |
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

### SOV 분석
- `POST /api/sov/run` - 분석 시작
- `GET /api/sov/status/:runId` - 상태 조회
- `GET /api/sov/result/:runId` - 결과 조회
- `GET /api/sov/runs` - 분석 기록

### 플레이스 리뷰
- `POST /api/place-review/analyze` - 분석 시작
- `GET /api/place-review/status/:analysisId` - 상태 조회
- `GET /api/place-review/analyses` - 분석 목록

### 어드민
- `GET /api/admin/users` - 사용자 목록
- `GET /api/admin/search-logs` - 검색 로그
- `GET /api/admin/sov-runs` - SOV 실행 기록
- `GET /api/admin/audit-logs` - 감사 로그
- `GET /api/admin/api-usage/stats` - API 사용량 통계
- `GET /api/services/quick-status` - 서비스 상태 (관리자 전용)

## Environment Variables

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | ✅ 필수 | PostgreSQL 연결 |
| `SESSION_SECRET` | ✅ 필수 | 세션 암호화 키 (프로덕션 필수) |
| `ENCRYPTION_KEY` | 선택 | API 키 암호화 (미설정 시 SESSION_SECRET 파생) |
| `OPENAI_API_KEY` | 선택 | SOV 분석용 |
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
