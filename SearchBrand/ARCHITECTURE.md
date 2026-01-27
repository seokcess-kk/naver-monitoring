# SEARCH SCOPE - Architecture

## Overview

**SEARCH SCOPE** - "See the Share. Shape the Strategy."

네이버 검색 통합 모니터링 및 플레이스 리뷰 분석 서비스입니다. 회원별로 네이버 API 키를 등록하고, 키워드를 검색하여 블로그, 카페, 지식iN, 뉴스 4개 채널의 검색 결과와 스마트블록 노출 현황을 실시간으로 확인할 수 있습니다. 시장 키워드 점유율을 파악하고 전략을 설계하세요.

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query (server state), React hooks (local state)
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **ORM**: Drizzle ORM with PostgreSQL
- **Session**: express-session with connect-pg-simple
- **Crawling**: Puppeteer with p-limit concurrency control
- **Background Jobs**: BullMQ with Redis
- **Caching**: LRU cache for API responses

### Database
- **Primary**: PostgreSQL (Replit-provisioned via DATABASE_URL)
- **Session Store**: PostgreSQL (sessions table)
- **Job Queue**: Redis (for BullMQ)

### External Services
- **Naver Search API**: Blog, Cafe, KnowledgeiN, News search
- **SendGrid**: Email verification and password reset
- **OpenAI API**: Place review sentiment analysis (optional)

## Directory Structure

```
SearchBrand/
├── client/                     # Frontend application
│   ├── public/                 # Static assets
│   │   └── favicon.png
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── api-key-setup.tsx
│   │   │   ├── api-results-section.tsx
│   │   │   ├── header.tsx
│   │   │   ├── search-panel.tsx
│   │   │   └── smart-block-section.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── use-auth.ts
│   │   │   ├── use-mobile.tsx
│   │   │   └── use-toast.ts
│   │   ├── lib/                # Utility functions
│   │   │   ├── auth-utils.ts
│   │   │   ├── queryClient.ts
│   │   │   └── utils.ts
│   │   ├── pages/              # Page components
│   │   │   ├── admin/          # Admin console modules
│   │   │   ├── auth.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── landing.tsx
│   │   │   ├── place-review.tsx
│   │   │   ├── profile.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── reset-password.tsx
│   │   ├── App.tsx             # Main app component with routing
│   │   ├── index.css           # Global styles
│   │   └── main.tsx            # Entry point
│   └── index.html              # HTML template
│
├── server/                     # Backend application
│   ├── middleware/             # Express middleware
│   │   └── observability.ts    # Request logging, error handling
│   ├── queue/                  # BullMQ job queues
│   │   └── place-review-queue.ts
│   ├── services/               # Business logic services
│   │   ├── place-review-scraper.ts
│   │   ├── place-review-analyzer.ts
│   │   ├── service-status.ts
│   │   └── rate-limiter.ts
│   ├── utils/                  # Utility functions
│   │   └── browserless.ts
│   ├── auth-routes.ts          # Authentication endpoints
│   ├── auth-service.ts         # Auth business logic
│   ├── admin-routes.ts         # Admin console endpoints
│   ├── crawler.ts              # Puppeteer SmartBlock crawler
│   ├── crypto.ts               # AES-256-GCM encryption
│   ├── db.ts                   # Database connection pool
│   ├── email-service.ts        # SendGrid email service
│   ├── bootstrap.ts            # Server entry point
│   ├── app.ts                  # Express app setup
│   ├── naver-api.ts            # Naver Search API client
│   ├── routes.ts               # API route definitions
│   ├── static.ts               # Static file serving
│   ├── storage.ts              # Database CRUD operations
│   └── vite.ts                 # Vite dev server setup
│
├── shared/                     # Shared code between client/server
│   ├── models/
│   │   └── auth.ts             # Auth request/response types
│   └── schema.ts               # Drizzle database schema
│
├── script/                     # Build scripts
│   └── build.ts                # Production build script
│
├── ARCHITECTURE.md             # This file
├── replit.md                   # Project documentation
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── drizzle.config.ts           # Drizzle ORM configuration
└── components.json             # shadcn/ui configuration
```

## Layer Architecture

### 1. Presentation Layer (client/)

**Responsibilities:**
- User interface rendering
- User input handling
- Client-side routing
- API communication via TanStack Query

**Key Patterns:**
- Pages are in `/pages/`, components in `/components/`
- Custom hooks abstract API calls and state management
- UI components from shadcn/ui are in `/components/ui/`

### 2. API Layer (server/routes.ts, server/auth-routes.ts, server/admin-routes.ts)

**Responsibilities:**
- HTTP request handling
- Input validation (Zod schemas)
- Rate limiting (express-rate-limit)
- Response formatting

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | User registration |
| POST | /api/auth/login | User login |
| POST | /api/auth/logout | User logout |
| GET | /api/auth/user | Current user info |
| GET | /api/auth/verify-email | Email verification |
| POST | /api/auth/forgot-password | Password reset request |
| POST | /api/auth/reset-password | Password reset |
| GET | /api/api-keys | Get user's API keys |
| POST | /api/api-keys | Create API key |
| PUT | /api/api-keys | Update API key |
| DELETE | /api/api-keys | Delete API key |
| GET | /api/search | Unified search (SmartBlock + 4 channels) |
| GET | /api/search/channel | Single channel search |
| POST | /api/place-review/analyze | Start place review analysis |
| GET | /api/place-review/status/:analysisId | Get analysis status |
| GET | /api/place-review/analyses | Get user's analyses |

### 3. Service Layer (server/*-service.ts, server/services/)

**Responsibilities:**
- Business logic implementation
- External API integration
- Data transformation

**Services:**
- `auth-service.ts`: User registration, login, email verification, password reset
- `email-service.ts`: SendGrid email delivery
- `place-review-analyzer.ts`: Place review sentiment analysis with OpenAI
- `place-review-scraper.ts`: Place review data scraping
- `naver-api.ts`: Naver Search API client with caching
- `crawler.ts`: Puppeteer-based SmartBlock crawler
- `service-status.ts`: System health checks

### 4. Data Layer (server/storage.ts, shared/schema.ts)

**Responsibilities:**
- Database CRUD operations
- Schema definition
- Data validation

**Tables:**
| Table | Description |
|-------|-------------|
| users | User accounts (email, password_hash, email_verified) |
| sessions | Session storage for express-session |
| verification_tokens | Email verification and password reset tokens |
| api_keys | User's Naver API credentials (encrypted) |
| search_logs | Search history logs |
| place_review_analyses | Place review analysis records |
| place_review_results | Place review analysis results |
| api_usage_logs | API usage tracking |
| audit_logs | Admin audit trail |

**Archived Tables (데이터 보존용):**
| Table | Description |
|-------|-------------|
| sov_runs | SOV 분석 실행 기록 (읽기 전용) |
| sov_exposures | SOV 콘텐츠 노출 데이터 (읽기 전용) |
| sov_scores | SOV 브랜드 관련성 점수 (읽기 전용) |
| sov_results | SOV 결과 데이터 (읽기 전용) |

*Note: SOV 기능은 2026-01-27에 제거되었지만, 기존 데이터 보존을 위해 테이블은 유지됩니다. 새로운 SOV 데이터는 생성되지 않습니다.*

## Security Architecture

### Authentication
- **Password Hashing**: bcryptjs with 12 salt rounds
- **Session Management**: PostgreSQL-backed sessions with 7-day expiry
- **Email Verification**: Required before login, 24-hour token expiry

### Data Protection
- **API Secrets**: AES-256-GCM encryption for stored Naver client secrets
- **Session Cookies**: HttpOnly, SameSite=Lax, Secure in production
- **Input Validation**: Zod schemas for all API inputs

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| /api/auth/* | 10 requests / 15 minutes |
| /api/auth/resend-verification | 3 requests / 15 minutes |
| /api/search | 30 requests / minute |
| /api/place-review/* | 10 requests / minute |

## Caching Strategy

| Cache | TTL | Max Entries |
|-------|-----|-------------|
| Naver API responses | 3 minutes | 100 |
| SmartBlock crawl results | 5 minutes | 500 |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| SESSION_SECRET | Express session signing key | Yes |
| ENCRYPTION_KEY | AES-256 key for API secrets | No (derives from SESSION_SECRET) |
| BROWSERLESS_API_KEY | Cloud browser for crawling | No |
| SENDGRID_API_KEY | Email delivery | No |

## Development Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run db:push    # Sync database schema
```

## Deployment

- **Platform**: Replit Deployments
- **Type**: VM (Reserved VM)
- **Port**: 5000
- **Build**: `npm run deploy:build`
- **Run**: `npm run deploy:start`

## Future Improvements

1. **Performance**: Redis cache for session storage
2. **Monitoring**: Structured logging with log aggregation
3. **Testing**: Unit tests for services, E2E tests for auth flows
4. **Features**: Scheduled keyword monitoring, alert notifications
