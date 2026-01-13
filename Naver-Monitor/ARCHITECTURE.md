# Naver Integrated Monitoring Platform - Architecture

## Overview

네이버 검색 API와 스마트블록 크롤링을 통한 통합 모니터링 서비스입니다. 회원별로 네이버 API 키를 등록하고, 키워드를 검색하여 블로그, 카페, 지식iN, 뉴스 4개 채널의 검색 결과와 스마트블록 노출 현황을 실시간으로 확인할 수 있습니다.

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
- **Caching**: LRU cache for API responses

### Database
- **Primary**: PostgreSQL (Replit-provisioned via DATABASE_URL)
- **Session Store**: PostgreSQL (sessions table)

### External Services
- **Naver Search API**: Blog, Cafe, KnowledgeiN, News search
- **SendGrid**: Email verification and password reset
- **OpenAI API**: text-embedding-3-small for SOV semantic analysis

## Directory Structure

```
Naver-Monitor/
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
│   │   │   ├── smart-block-section.tsx
│   │   │   └── sov-panel.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── use-auth.ts
│   │   │   ├── use-mobile.tsx
│   │   │   └── use-toast.ts
│   │   ├── lib/                # Utility functions
│   │   │   ├── auth-utils.ts
│   │   │   ├── queryClient.ts
│   │   │   └── utils.ts
│   │   ├── pages/              # Page components
│   │   │   ├── auth.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── landing.tsx
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
│   ├── auth-routes.ts          # Authentication endpoints
│   ├── auth-service.ts         # Auth business logic
│   ├── crawler.ts              # Puppeteer SmartBlock crawler
│   ├── crypto.ts               # AES-256-GCM encryption
│   ├── db.ts                   # Database connection pool
│   ├── email-service.ts        # SendGrid email service
│   ├── index.ts                # Server entry point
│   ├── naver-api.ts            # Naver Search API client
│   ├── routes.ts               # API route definitions
│   ├── sov-service.ts          # SOV analysis service
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
├── design_guidelines.md        # UI/UX design guidelines
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

### 2. API Layer (server/routes.ts, server/auth-routes.ts)

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
| POST | /api/sov/run | Start SOV analysis |
| GET | /api/sov/status/:runId | Get analysis status |
| GET | /api/sov/result/:runId | Get analysis result |

### 3. Service Layer (server/*-service.ts)

**Responsibilities:**
- Business logic implementation
- External API integration
- Data transformation

**Services:**
- `auth-service.ts`: User registration, login, email verification, password reset
- `email-service.ts`: SendGrid email delivery
- `sov-service.ts`: SOV analysis with OpenAI embeddings
- `naver-api.ts`: Naver Search API client with caching
- `crawler.ts`: Puppeteer-based SmartBlock crawler

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
| sov_runs | SOV analysis run records |
| sov_exposures | Analyzed content exposures |
| sov_scores | Brand relevance scores |
| sov_results | Final SOV percentages |

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
| /api/sov/* | 10 requests / minute |

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
| OPENAI_API_KEY | OpenAI API for SOV embeddings | Yes (for SOV) |

## Development Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run db:push    # Sync database schema
```

## Deployment

- **Platform**: Replit Deployments
- **Type**: Autoscale
- **Port**: 5000
- **Build**: `npm run build`
- **Run**: `npm run start`

## Future Improvements

1. **Performance**: Redis cache for session storage
2. **Monitoring**: Structured logging with log aggregation
3. **Testing**: Unit tests for services, E2E tests for auth flows
4. **Features**: Scheduled keyword monitoring, alert notifications
