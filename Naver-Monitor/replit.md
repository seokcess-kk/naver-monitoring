# 네이버 통합 모니터링 (Naver Integrated Monitoring)

## Overview
네이버 검색 API와 스마트블록 크롤링을 통한 통합 모니터링 서비스입니다.
회원별로 네이버 API 키를 등록하고, 키워드를 검색하여 블로그, 카페, 지식iN, 뉴스 4개 채널의 검색 결과와 스마트블록(플레이스, 뉴스 등) 노출 현황을 실시간으로 확인할 수 있습니다.

## Recent Changes
- 2026-01-14: 모바일 반응형 디자인 및 UI 개선
  - CSS 애니메이션 추가 (fadeIn, fadeInUp, scaleIn)
  - 유틸리티 클래스 추가 (glass-card, hover-lift, gradient-text, mobile-horizontal-scroll)
  - 랜딩 페이지: 데모 카드 md+ 전용, 기능 카드 모바일 가로 스크롤
  - 대시보드: 검색량 카드 인라인 레이아웃, API 결과 모바일 탭 UI
  - 스마트블록: 모바일 가로 스크롤 레이아웃
  - 검색 패널/API 키 설정: 모바일 컴팩트 레이아웃
  - 전체 컴포넌트 반응형 텍스트/패딩/아이콘 크기 적용

- 2026-01-13: 이메일/비밀번호 인증 시스템으로 변경
  - Replit Auth에서 이메일/비밀번호 기반 인증으로 전환
  - SendGrid 통합으로 이메일 인증 및 비밀번호 재설정 지원
  - bcryptjs를 사용한 비밀번호 해시
  - 새 DB 테이블: verification_tokens
  - 새 컬럼: users.password_hash, users.email_verified
  - 로그인/회원가입/비밀번호 찾기 UI 구현

- 2026-01-13: SOV 본문 추출 로직 개선
  - URL 타입별 분기 처리 (blog/view/news/other)
  - 네이버 블로그 전용 추출: 모바일 URL 변환 + 다양한 URL 형식 지원
  - VIEW 페이지 전용 추출: 모바일 UA + VIEW 셀렉터
  - 상세 로깅 추가 (URL 타입, 추출 문자 수)

- 2026-01-12: SOV (Share of Voice) 분석 기능 추가
  - 시장 키워드에서 브랜드별 노출 점유율 분석
  - 네이버 스마트블록(뉴스, VIEW, 블로그) 콘텐츠 크롤링
  - 하이브리드 콘텐츠 추출 (HTTP 우선, Puppeteer 폴백)
  - OpenAI text-embedding-3-small 기반 시맨틱 관련성 계산
  - 규칙 기반 점수(0.4) + 시맨틱 점수(0.6) 조합, 임계값 0.72
  - 백그라운드 비동기 처리로 대용량 분석 지원
  - 새 DB 테이블: sov_runs, sov_exposures, sov_scores, sov_results

- 2026-01-12: 프로덕션 보안 및 운영 강화
  - Ticket 1: API 응답에서 clientSecret 비노출 (hasClientSecret 플래그만 반환)
  - Ticket 2: Zod 스키마로 검색 파라미터 검증 (keyword, sort, page, channel)
  - Ticket 3: express-rate-limit으로 엔드포인트별 요청 제한 적용
  - Ticket 4: p-limit으로 크롤링 동시성 2개 제한 + LRU 캐시(5분 TTL)
  - Ticket 5: 네이버 API 응답 캐시(3분 TTL) + 표준화된 에러 로깅
  - Ticket 6: AES-256-GCM으로 clientSecret 암호화 저장
  - Ticket 7: requestId/latency 로깅, 민감정보 마스킹 미들웨어

- 2026-01-12: 채널별 페이지네이션 및 UI/UX 개선
  - 채널별 독립 페이지네이션: 스마트블록 재크롤링 없이 개별 채널 페이지 이동
  - GET /api/search/channel 엔드포인트 추가
  - 채널별 로딩 상태 및 오류 복구 로직 구현
  - UI/UX 전면 개선: 그라디언트 브랜딩, 섹션별 색상 코딩, 카드 레이아웃 개선
  
- 2026-01-12: 초기 MVP 구현
  - 회원별 네이버 API 키 등록/관리 기능
  - 네이버 검색 API 4채널 통합 검색
  - Puppeteer 기반 스마트블록 크롤링
  - 검색 결과 매칭 하이라이트 기능

## Project Architecture

### Frontend (React + Vite)
- `/client/src/App.tsx` - 메인 앱 컴포넌트, 라우팅
- `/client/src/pages/landing.tsx` - 비로그인 사용자용 랜딩 페이지
- `/client/src/pages/auth.tsx` - 로그인/회원가입 페이지
- `/client/src/pages/dashboard.tsx` - 로그인 사용자용 대시보드
- `/client/src/components/header.tsx` - 공통 헤더 (네비게이션, 사용자 메뉴)
- `/client/src/components/api-key-setup.tsx` - API 키 등록/수정 컴포넌트
- `/client/src/components/search-panel.tsx` - 검색 입력 패널
- `/client/src/components/smart-block-section.tsx` - 스마트블록 결과 표시
- `/client/src/components/api-results-section.tsx` - API 4채널 결과 그리드
- `/client/src/components/sov-panel.tsx` - SOV 분석 패널 (대시보드 탭)

### Backend (Express + PostgreSQL)
- `/server/routes.ts` - API 엔드포인트 정의
- `/server/auth-routes.ts` - 인증 관련 API 엔드포인트
- `/server/auth-service.ts` - 인증 서비스 (회원가입, 로그인, 이메일 인증)
- `/server/email-service.ts` - SendGrid 이메일 발송 서비스
- `/server/storage.ts` - 데이터베이스 CRUD 작업
- `/server/naver-api.ts` - 네이버 검색 API 호출
- `/server/crawler.ts` - Puppeteer 기반 스마트블록 크롤링
- `/server/sov-service.ts` - SOV 분석 서비스 (임베딩, 관련성 계산)

### Database Schema
- `users` - 사용자 정보 (email, password_hash, email_verified)
- `sessions` - 세션 저장소
- `verification_tokens` - 이메일 인증 및 비밀번호 재설정 토큰
- `api_keys` - 사용자별 네이버 API 키 저장
- `sov_runs` - SOV 분석 실행 기록
- `sov_exposures` - 분석된 콘텐츠 노출 정보
- `sov_scores` - 브랜드별 관련성 점수
- `sov_results` - 최종 SOV 퍼센트 결과

## API Endpoints

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/user` - 현재 로그인 사용자 정보
- `GET /api/auth/verify-email` - 이메일 인증
- `POST /api/auth/resend-verification` - 인증 이메일 재발송
- `POST /api/auth/forgot-password` - 비밀번호 재설정 요청
- `POST /api/auth/reset-password` - 비밀번호 재설정

### API 키 관리
- `GET /api/api-keys` - 사용자의 API 키 조회
- `POST /api/api-keys` - API 키 등록
- `PUT /api/api-keys` - API 키 수정
- `DELETE /api/api-keys` - API 키 삭제

### 검색
- `GET /api/search` - 통합 검색 (스마트블록 + API 4채널)
- `GET /api/search/channel` - 채널별 단일 검색 (페이지네이션용)

### SOV 분석
- `POST /api/sov/run` - SOV 분석 시작
- `GET /api/sov/status/:runId` - 분석 상태 조회
- `GET /api/sov/result/:runId` - 분석 결과 조회
- `GET /api/sov/runs` - 사용자의 분석 기록 목록

### 기타
- `GET /api/health` - 서버 상태 확인

## User Preferences
- 한국어 UI
- Noto Sans KR 폰트
- 다크 모드 지원 (예정)

## Development Commands
- `npm run dev` - 개발 서버 실행
- `npm run db:push` - 데이터베이스 스키마 동기화

## 개발/배포 전 체크리스트

기능 변경 시 반드시 아래 항목들을 확인하세요:

### 환경 설정
- [ ] Puppeteer Chrome 브라우저 설치 확인 (`npx puppeteer browsers install chrome`)
- [ ] 워크플로우 재시작 및 서버 정상 동작 확인
- [ ] 콘솔 로그에 에러 없는지 확인

### 핵심 기능 테스트
- [ ] 스마트블록 크롤링 정상 동작 (검색 시 smartBlock 결과 확인)
- [ ] API 결과 4채널(블로그, 카페, 지식iN, 뉴스) 정상 표시
- [ ] 키워드 검색량(PC/MO) 표시 확인
- [ ] SOV 분석 기능 동작 확인 (필요시)

### UI/UX
- [ ] 모바일 반응형 레이아웃 정상 동작
- [ ] 데스크톱 레이아웃 정상 동작
- [ ] 탭/그리드 전환이 md 브레이크포인트에서 올바르게 동작

### 인증
- [ ] 로그인/로그아웃 정상 동작
- [ ] 이메일 인증 흐름 정상 동작 (신규 가입 시)

### 배포 전 (프로덕션)
- [ ] `npm run build` 성공 확인
- [ ] 빌드 시 Chrome 자동 설치 확인
- [ ] 환경 변수 설정 확인 (DATABASE_URL, SESSION_SECRET 등)

## Architecture Documentation
자세한 아키텍처 문서는 [ARCHITECTURE.md](./ARCHITECTURE.md)를 참조하세요.
