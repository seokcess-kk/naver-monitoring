# Design Guidelines: SearchBrand

**Slogan:** "See the Share. Shape the Strategy."

## Design Approach: Modern Productivity Dashboard

**Selected Approach:** Design System - inspired by Linear, Notion, and Vercel's productivity-focused aesthetics
**Rationale:** This is a data-intensive monitoring tool requiring clear information hierarchy, efficient workflows, and professional credibility. Users need to quickly scan multiple data sources and manage their API credentials securely.

## Logo Concept: Scope Target
- **Symbol:** 원형 타겟(스코프) + 중앙 점(핵심 키워드)
- **Implementation:** CSS로 구현 - rounded-full border + center dot
- **Colors:** Primary gradient (violet-600 to primary)

---

## Core Design Principles

1. **Information Clarity:** Dense data presented with clear visual hierarchy
2. **Workflow Efficiency:** Minimal clicks to core functions (search, results, API management)
3. **Professional Trust:** Clean, polished interface that instills confidence in data accuracy
4. **Responsive Density:** Adapt information density based on viewport without losing functionality

---

## Typography System

**Font Families:**
- Primary: 'Noto Sans KR' for Korean content (existing)
- Interface: Inter or SF Pro for UI elements and English text
- Monospace: 'JetBrains Mono' for API keys and technical data

**Type Scale:**
- Display (Hero): 2.5rem / font-bold
- H1 (Page Title): 1.5rem / font-bold
- H2 (Section): 1.125rem / font-semibold  
- H3 (Card Header): 0.875rem / font-bold
- Body: 0.875rem / font-normal
- Caption: 0.75rem / font-medium
- Micro: 0.625rem / font-bold (badges, counts)

**Hierarchy Implementation:**
- Authentication pages: Large display type with generous spacing
- Dashboard headers: Bold H1 with subtle supporting text
- Data cards: Compact H3 headers with micro badges for counts
- Results: Medium body text with clear caption metadata

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 3, 4, 6, 8, 12, 16**
- Micro spacing: 2 (8px) - between related elements
- Standard spacing: 4 (16px) - card padding, button gaps
- Section spacing: 8 (32px) - between major sections
- Page margins: 12-16 (48-64px) - container edges

**Grid Systems:**
- Dashboard: 12-column responsive grid
- Results: 1 column (mobile) → 2 columns (tablet) → 4 columns (desktop) for API channels
- Cards: Full-width stacking with consistent 4-unit gaps

**Container Widths:**
- Authentication pages: max-w-md (centered)
- Dashboard: max-w-7xl with px-4 responsive padding
- Results grid: Full-width within container

---

## Component Library

### Navigation & Header
**Top Navigation Bar:**
- Sticky header (h-16) with shadow-sm on scroll
- Logo + app name on left
- User profile menu + server status indicator on right
- Border-bottom separator

**User Profile Menu:**
- Dropdown with avatar/initial circle
- Menu items: Dashboard, API Settings, Logout
- Clear visual separation between sections

### Authentication Components
**Login/Signup Pages:**
- Centered card layout (max-w-md)
- Large heading with welcome message
- Replit Auth buttons (Google, GitHub, Email) as primary CTAs
- Each button with icon + text, full-width
- Subtle illustration or abstract pattern background (optional decorative element)

**API Key Management Card:**
- Collapsible details element (as in existing code)
- Input fields with labels above
- Masked password input for Client Secret
- Save/Update button with loading states
- Visual feedback on successful save

### Search Interface
**Search Bar:**
- Prominent position at top of dashboard
- Icon prefix (magnifying glass)
- Large input field (h-12) with placeholder
- Dropdown for sort options (compact, aligned right)
- Primary action button (Search) - bold, stands out

**Filter Controls:**
- Inline controls below search
- Pill-style toggles for quick filters
- Clear visual states (active/inactive)

### Results Display

**SmartBlock Section:**
- Section header with icon, title, subtitle, and live badge
- Dynamic grid: 1 column if 1 result, 2 columns if 2 results, 3 columns for 3+
- Card-based layout with consistent structure:
  - Section badge (emoji + name)
  - Numbered list items with rank circles
  - Title (clickable), URL preview (truncated), summary text
  - Hover states on entire card

**API Results Section (4 Channels):**
- Fixed 4-column grid on desktop (xl:grid-cols-4)
- Each channel: distinct header with icon + badge count
- Scrollable card bodies (max-h-[600px])
- Consistent card structure across channels
- Pagination controls (compact, top-right)

**Matching Highlights:**
- Distinct visual treatment when SmartBlock and API results match
- Border emphasis + subtle fill
- Small badge indicator

**Loading States:**
- Spinner with descriptive text
- Skeleton loaders for cards (optional enhancement)
- Progress indication for multi-step operations

**Empty States:**
- Centered content with icon
- Friendly message + suggested action
- Dashed border container

### Data Cards
**Standard Card Structure:**
- Rounded corners (rounded-xl)
- Subtle border + shadow-sm
- Header section with divider
- Content padding (p-4 to p-6)
- Hover elevation change

**List Items within Cards:**
- Rank indicator (circular badge)
- Multi-line layout: Title (bold) → URL (small, muted) → Summary (normal)
- Consistent vertical spacing (space-y-3)
- Link treatment: Underline on hover only

### Interactive Elements
**Buttons:**
- Primary: Bold, medium height (h-10 to h-12), rounded-lg
- Secondary: Outlined variant
- Icon buttons: Square (w-8 h-8), subtle hover backgrounds
- Disabled states: Reduced opacity

**Form Inputs:**
- Standard height (h-10 to h-12)
- Border on default, ring on focus
- Label above input (small, semi-bold)
- Icon prefix where contextual

**Status Indicators:**
- Pill badges with dot icon
- Small, rounded-full
- Positioned in header/corner

---

## Page Layouts

### Authentication Pages
- Centered card (max-w-md) with ample padding
- Large heading + subtext
- Social login buttons stacked (gap-3)
- Minimal footer with links

### Dashboard/Main Interface
**Layout Structure:**
1. Sticky header (navigation)
2. Search panel (bg-white card, shadow-sm, mb-8)
3. Results sections (stacked vertically)
4. Footer (minimal, text-center)

**Vertical Rhythm:**
- Sections: mb-8 to mb-12
- Cards within sections: gap-6
- Content within cards: space-y-3 to space-y-4

### User Settings/Dashboard
- Sidebar navigation (optional, for future phases)
- Main content area with breadcrumb
- Form sections in cards
- Action buttons bottom-right alignment

---

## Animations & Interactions

**Use sparingly:**
- Fade-in on content load (existing fadeInUp)
- Smooth transitions on hover (0.2s ease)
- Page transitions: None (instant navigation)
- Skeleton loading: Only if performance allows

**Avoid:**
- Scroll-triggered animations
- Complex page transitions
- Auto-playing elements

---

## Accessibility Standards

- Focus rings on all interactive elements (ring-2 ring-offset-1)
- Sufficient color contrast (WCAG AA minimum)
- Descriptive link text and ARIA labels
- Keyboard navigation for all functions
- Form validation with clear error messages

---

## Responsive Behavior

**Breakpoints:**
- Mobile: base (< 768px) - Single column, stacked layout
- Tablet: md (768px+) - 2 columns for API results
- Desktop: lg/xl (1024px+) - Full 4-column grid, expanded spacing

**Mobile Optimizations:**
- Hamburger menu for navigation (if needed)
- Full-width buttons
- Reduced padding (px-4 instead of px-8)
- Collapsible sections by default

---

## Images

**No large hero images needed** - This is a utility dashboard focused on data and functionality.

**Optional Decorative Elements:**
- Login page: Subtle abstract pattern or geometric shapes in background (low opacity)
- Empty states: Simple line illustrations (icon-based)
- User avatars: Circle placeholders with initials or Replit profile images

All imagery should be minimal and functional, never distracting from the primary task of monitoring search results.