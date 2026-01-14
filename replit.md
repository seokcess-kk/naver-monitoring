# SEARCH SCOPE

**Slogan:** "See the Share. Shape the Strategy."

## Overview

**SEARCH SCOPE** is a Naver search monitoring service that combines API search and SmartBlock crawling. Users register their own Naver API keys, search keywords, and view real-time results across 4 channels (Blog, Cafe, KnowledgeiN, News) plus SmartBlock sections (Places, News blocks, VIEW). The platform also includes SOV (Share of Voice) analysis for measuring brand exposure across search results.

점유율을 파악하고 전략을 설계하는 네이버 검색 통합 모니터링 서비스입니다.

**Core Features:**
- Per-user Naver API key registration with AES-256-GCM encryption
- Unified search across 4 Naver API channels
- Puppeteer-based SmartBlock crawling
- SOV brand exposure analysis with OpenAI embeddings
- SOV verified/unverified exposure split for accurate SOV calculation
- User profile page with account info, API key status, and SOV history
- Keyword template management (save/load frequently used brand+keyword combinations)
- Email/password authentication with SendGrid verification
- Reusable EmptyState component for consistent empty/error/not-configured states

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight React router)
- **State Management:** TanStack Query for server state, React hooks for local state
- **UI Components:** shadcn/ui component library with Radix UI primitives
- **Styling:** Tailwind CSS with custom design tokens (CSS variables for theming)
- **Build Tool:** Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime:** Node.js with Express
- **Language:** TypeScript (ESM modules)
- **Session Management:** express-session with connect-pg-simple (PostgreSQL-backed sessions)
- **Rate Limiting:** express-rate-limit with per-endpoint configurations
- **Crawling:** Puppeteer with concurrency control (p-limit) and LRU caching
- **Security:** AES-256-GCM encryption for secrets, bcryptjs for password hashing

### Data Storage
- **Database:** PostgreSQL via Drizzle ORM
- **Schema Location:** `shared/schema.ts` (shared between client/server)
- **Key Tables:** users, sessions, api_keys, verification_tokens, sov_runs, sov_exposures, sov_scores, sov_results, sov_templates, search_logs
- **Migrations:** Drizzle Kit (`npm run db:push`)

### Authentication
- Email/password authentication with 3-step registration flow:
  1. Email input and verification email sent
  2. Email verification via token link
  3. Password setup and account creation
- SendGrid integration for email verification and password reset
- Session-based auth with PostgreSQL session store
- Rate-limited auth endpoints (10 requests/15 minutes for auth, 3 requests/minute for resend)
- verification_tokens table supports both registration and password_reset types
- Users are only created after email verification is complete
- Re-registration allowed for unverified emails with expired tokens

### API Structure
- `/api/auth/*` - Authentication endpoints:
  - `POST /api/auth/start-registration` - Initiate registration with email
  - `GET /api/auth/verify-registration` - Verify token validity
  - `POST /api/auth/complete-registration` - Set password and create account
  - `POST /api/auth/resend-registration` - Resend verification email
  - `POST /api/auth/login` - User login
  - `POST /api/auth/logout` - User logout
  - `GET /api/auth/user` - Get current user
  - `POST /api/auth/forgot-password` - Request password reset
  - `POST /api/auth/reset-password` - Reset password with token
- `/api/api-keys` - User API key management (CRUD)
- `/api/search` - Unified Naver search (4 channels + SmartBlock)
- `/api/search/channel` - Individual channel pagination
- `/api/sov/*` - Share of Voice analysis runs and results

### Caching Strategy
- Naver API responses: LRU cache with 3-minute TTL
- SmartBlock crawl results: LRU cache with 5-minute TTL
- Maximum 100-500 cached entries depending on endpoint

## External Dependencies

### Third-Party Services
- **Naver Search API:** Blog, Cafe, KnowledgeiN, News search (user-provided credentials)
- **SendGrid:** Email verification and password reset emails (Replit Connector)
- **OpenAI API:** text-embedding-3-small for semantic relevance scoring in SOV analysis

### Database
- **PostgreSQL:** Primary data store (Replit-provisioned, connection via DATABASE_URL)

### Key Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session signing key
- `ENCRYPTION_KEY` - AES-256 key for API secret encryption (optional, derives from SESSION_SECRET)
- `OPENAI_API_KEY` - OpenAI API for SOV embeddings

### NPM Dependencies (Notable)
- `puppeteer` - Headless browser for SmartBlock crawling
- `drizzle-orm` + `drizzle-kit` - Type-safe ORM and migrations
- `@tanstack/react-query` - Server state management
- `@sendgrid/mail` - Email delivery
- `openai` - OpenAI API client
- `lru-cache` - Response caching
- `p-limit` - Concurrency control

## Deployment Configuration

### Important Notes
- **Single .replit file**: Only the root `.replit` file is used for deployment. Do NOT create `.replit` files in subdirectories as they will be ignored and cause confusion.
- **Deployment Type**: VM (Reserved VM) - Always running, no cold start issues
- **Build Command**: `npm run deploy:build --prefix Naver-Monitor` (installs deps + builds)
- **Run Command**: `npm run deploy:start --prefix Naver-Monitor` (runs migrations + starts server)
- **Production URL**: https://naver-monitor--inner1.replit.app (set via APP_BASE_URL env var)
- **Health Check**: `/health` and `/` endpoints respond immediately before any middleware for fast health checks
- **Split Build Architecture**: 
  - `dist/index.cjs` (bootstrap) - Minimal server, starts HTTP listener immediately
  - `dist/app.cjs` - Heavy initialization (DB, session, routes) loaded asynchronously after server starts
- **Puppeteer Chrome**: Installed during build via `npx puppeteer browsers install chrome`
- **drizzle-kit**: Moved to dependencies for runtime migration support

### Deploy Scripts (Naver-Monitor/package.json)
- `deploy:build`: `npm install --include=dev && npm run build` (DB migration removed from build to avoid timeout)
- `deploy:start`: `NODE_ENV=production node dist/index.cjs`
- Note: DB migrations are handled by Replit's deployment platform automatically

### Cold Start Optimization
The server uses a two-phase startup:
1. **Phase 1 (Immediate)**: HTTP server starts, `/health` and `/` return 200 OK
2. **Phase 2 (Deferred)**: DB pool, session store, routes, and static files are initialized asynchronously
This ensures health checks pass within the Replit timeout window even during cold starts.

## 개발/배포 전 체크리스트

기능 변경 시 반드시 아래 항목들을 확인:

### 환경 설정
- Puppeteer Chrome 브라우저 설치 확인 (`npx puppeteer browsers install chrome`)
- 워크플로우 재시작 및 서버 정상 동작 확인
- 콘솔 로그에 에러 없는지 확인

### 핵심 기능 테스트
- 스마트블록 크롤링 정상 동작 (검색 시 smartBlock 결과 확인)
- API 결과 4채널(블로그, 카페, 지식iN, 뉴스) 정상 표시
- 키워드 검색량(PC/MO) 표시 확인

### UI/UX
- 모바일 반응형 레이아웃 정상 동작
- 데스크톱 레이아웃 정상 동작
- 탭/그리드 전환이 md 브레이크포인트에서 올바르게 동작

### 배포 전
- `npm run build` 성공 확인
- 환경 변수 설정 확인 (DATABASE_URL, SESSION_SECRET 등)