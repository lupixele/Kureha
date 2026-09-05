# Kureha Frontend System Design Specification [DRAFT — OPEN FOR ITERATION]

**Document Status:** Draft / Under Review (Frontend not locked; open for design iterations)
**Owner:** Gurala Ratan Teja (lupixele)
**Scope:** Stages M4 (Search & Details), M5 (Library, Up Next & Calendar), M6 (Social Feed & Maintainer UI)
**Contract Source:** [`docs/prd/PRD-001-kureha-core.md`](../prd/PRD-001-kureha-core.md) v1.2
**Tech Stack:** React 19, TanStack Start / React Router, Supabase Auth.
*(Note: No frontend code will be built until design is finalized with owner.)*

---

## 1. Visual Theme & Design Tokens

Kureha is an anime, series, and movie tracker designed to be clean, dark-mode native, high-density, and media-forward.

### 1.1 Color Palette
- **Canvas Background (`--bg-canvas`):** `#0a0b0e` (deep charcoal-black)
- **Surface Elevation 1 (`--bg-surface`):** `#12151b` (card/sidebar container)
- **Surface Elevation 2 (`--bg-elevated`):** `#1a1e27` (modals, dropdowns, hovered items)
- **Border Subtle (`--border-subtle`):** `#252b38`
- **Border Strong (`--border-strong`):** `#3a4356`
- **Accent Primary (`--accent`):** `#e63946` / `#ff4d6d` (Kureha crimson/cherry blossom)
- **Accent Muted (`--accent-muted`):** `rgba(230, 57, 70, 0.15)`
- **Text Primary (`--text-primary`):** `#f0f2f5` (high contrast white)
- **Text Secondary (`--text-secondary`):** `#9ba3b4` (slate grey)
- **Text Muted (`--text-muted`):** `#636c7e`
- **Status Badges:**
  - Watching / Airing: `#06d6a0` (emerald)
  - Completed: `#4361ee` (royal blue)
  - Paused / Hiatus: `#ffb703` (amber)
  - Dropped / Cancelled: `#ef476f` (rose)

### 1.2 Typography & Layout
- Typography: System sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) with tabular figures for numbers/episode counts.
- Navigation Shell:
  - Top Bar: Brand Logo (`Kureha`), Global Search Bar, Quick Links (`Library`, `Up Next`, `Calendar`), and User Profile / Avatar pill.
  - Responsive: Collapses into bottom navigation bar on mobile viewports (<768px).

---

## 2. Stage 1: Milestone 4 (Search & Media Details UI)

### 2.1 Route: `/search` (Unified Search & Discovery)
- **Public & Unauthenticated Support:** Anyone can search without logging in (`FR-009`, `FR-033`).
- **Interactive Search Input:**
  - Instant debounced query (250ms).
  - Filter pills: `All`, `Anime` (AniList), `Movies & TV` (TMDB).
- **Result Card Grid:**
  - **Poster & Header:** Cover image, canonical/original title, release year, media format (`TV`, `Movie`, `OVA`).
  - **Provider Tag:** AniList pill or TMDB pill.
  - **Deduplication:** TMDB item suppressed if mapped to AniList item in the same result set.
  - **`uncertain_anime` Badge:** TMDB TV items with animation indicators that lack a positive mapping are flagged `Uncertain Anime` with `Import to Kureha` disabled until reviewed.
  - **Actions:**
    - `Preview`: Opens slide-over drawer showing normalized overview, relations, and episodes without database write.
    - `Import to Library`: (Authenticated) Calls `importProviderTitleFn` to atomically persist the title into Kureha and transition to the details page.

### 2.2 Route: `/media/$id` (Franchise Media Details Page)
- **Hero Header:**
  - Backdrop image (with darkening gradient for legibility).
  - Preferred Title Logo: transparent Fanart.tv title-logo (or AniList/TMDB text title fallback).
  - Status Badge: `Airing`, `Finished`, or `Upcoming` with next episode air date countdown.
  - Action Bar: `Track / Add to Library`, Intent selector (`Active`, `Paused`, `Watch Later`), and `Artwork Selector` modal button.
- **Franchise Continuity Rail:**
  - Horizontal timeline of installments on the `mainline` continuity track:
    `[Prequel OVA] ──> [Season 1] ──> [Season 2] ──> [Upcoming Sequel]`
  - Alternate continuities and extras listed under secondary collapsible tabs.
- **Episode Grid & Tracking Controls:**
  - Installment tabs (Season 1, Season 2...).
  - Episode Card list:
    - Episode number, title, release date.
    - Watched status indicator (checkmark button with single-click toggle).
    - Rewatch count indicator (e.g. `x2`).
    - Bulk action: `Mark all up to this episode` (triggers M2 gap-fill).

### 2.3 Artwork Customizer Modal
- In-modal selector for the user's personal profile preference (`FR-032D`):
  - Tab 1: Title Logo (Transparent logos from Fanart.tv).
  - Tab 2: Cover Art (AniList & TMDB covers).
  - Tab 3: Backdrop (AniList & TMDB horizontal art).
- Real-time preview with "Save Preference" button (`setArtworkPreference`).

---

## 3. Stage 2: Milestone 5 (Library, Up Next & Release Calendar)

### 3.1 Route: `/library`
- User library split into tabs:
  1. `Watching` (`in_progress`, `active`)
  2. `Paused` (`active` or `in_progress`, intent `paused`)
  3. `Plan to Watch` (`unreleased` / `not_started`, intent `watch_later`)
  4. `Completed` (`completed`)
  5. `Dropped` (`dropped`)
- Filterable by type: `Anime`, `TV Series`, `Movie`.
- Compact list mode and Poster card grid mode.
- Progress bar showing watched episodes vs frontier: `5 watched · through episode 12 / 24`.

### 3.2 Route: `/up-next` (The Daily Driver)
- Strict PRD `FR-079`–`FR-084` rules:
  - Surfaces the **next unreleased or newly released episode** ONLY for titles the user was actively caught up on or watching.
  - Never shows unreleased future episodes as watchable.
  - One-click `Mark Watched` button per card that advances the progress frontier directly.

### 3.3 Route: `/calendar`
- Weekly & monthly agenda view of upcoming airing dates:
  - Fetches airing schedules for titles currently in the user's active library.
  - Displays episode air time in the user's local timezone (IST default).

---

## 4. Stage 3: Milestone 6 & 7 (Social Feed & Maintainer Dashboard)

### 4.1 Route: `/activity` (Social Feed)
- Strict Privacy & Batching (`FR-091`–`FR-105`):
  - No global public feed. Only shows self and mutual friends based on `visibility` (`public`, `friends_only`, `private`).
  - Summarized activity cards: `User watched 12 episodes of Solo Leveling S1` (batched within 2-hour window).

### 4.2 Route: `/admin/review` (Maintainer Queue)
- Deny-by-default access (requires user ID to be in `KUREHA_MAINTAINER_USER_IDS`).
- Review Item Inspector:
  - Table of pending items (`ambiguous_branch`, `uncertain_anime`, `unmatched_episode`).
  - Interactive relation resolver: preview proposed installment split, accept, or reject with notes.
  - Mapping version activator and one-click rollback tool.

---

## 5. Execution Strategy: Silas (Architect) + OpenClaude (Builder)

1. **Role Division:**
   - **Silas:** Defines route schemas, server functions, state models, test suites, and strict acceptance criteria.
   - **OpenClaude:** Constructs the React UI components, CSS layouts, hooks, and client views in isolated worktrees.
   - **Fallback:** If OpenClaude encounters timeouts, syntax traps, or stalls, Silas steps in to repair or steer.
2. **Step-by-Step Delivery:**
   - Step 1: M4 (Search, Previews, Details page, Artwork Modal).
   - Step 2: M5 (Library views, Up Next card queue, Release Calendar).
   - Step 3: M6/M7 (Activity feed, Privacy settings, Maintainer dashboard).
