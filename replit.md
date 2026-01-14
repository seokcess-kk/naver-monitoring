# Naver Integrated Monitoring Platform

## Overview

A Naver search monitoring service that combines API search and SmartBlock crawling. Users register their own Naver API keys, search keywords, and view real-time results across 4 channels (Blog, Cafe, KnowledgeiN, News) plus SmartBlock sections (Places, News blocks, VIEW). The platform also includes SOV (Share of Voice) analysis for measuring brand exposure across search results.

**Core Features:**
- Per-user Naver API key registration with AES-256-GCM encryption
- Unified search across 4 Naver API channels
- Puppeteer-based SmartBlock crawling
- SOV brand exposure analysis with OpenAI embeddings
- Email/password authentication with SendGrid verification

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
- **Key Tables:** users, sessions, api_keys, verification_tokens, sov_runs, sov_exposures, sov_scores, sov_results
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
- **Health Check**: `/health` endpoint responds before any middleware for fast health checks
- **Puppeteer Chrome**: Installed during build via `npx puppeteer browsers install chrome`
- **drizzle-kit**: Moved to dependencies for runtime migration support

### Deploy Scripts (Naver-Monitor/package.json)
- `deploy:build`: `npm install --include=dev && npx drizzle-kit push --config ./drizzle.config.ts && npm run build`
- `deploy:start`: `NODE_ENV=production node dist/index.cjs`