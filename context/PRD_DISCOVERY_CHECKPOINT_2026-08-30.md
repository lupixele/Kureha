# Kureha PRD Discovery Checkpoint

**Status:** PRD drafting paused for a bounded anime-metadata spike  
**Date:** 2026-08-30  
**Purpose:** Durable continuation state. This records product decisions and hypotheses made during PRD interrogation. It is not yet the approved PRD or architecture specification.

## 1. Product definition

Kureha v1 is an online-only, responsive community media tracker for movies, television series, and anime. It has no torrent functionality, streaming engine, or built-in player.

### Authentication and community

- Google OAuth only for v1 mutations and account features; anonymous visitors may browse catalogue search, media details, and public profiles.
- Usernames are unique lowercase Discord-style handles; display names are separate, non-unique Unicode names with emoji/special-character support, subject to SFW rules.
- Profiles and activity are private by default.
- Users can explicitly set visibility to private, friends-only, or public.
- Activity history follows profile visibility.
- Playback position is always private.
- Mutual friendships require an accepted friend request; one-way following is out of v1.
- Community v1 includes username search, friend requests, and visibility-controlled profile, library, and activity views.
- No global activity feed in v1.
- Authenticated account deletion permanently removes profile, social, tracking, and playback-position data. No data export in v1.

## 2. Home and library surfaces

### New Releases

A highest-priority release queue containing canonical episodes released for a show the user had previously caught up with, plus the first canonical release of a title already added while unreleased. A series falls to Continue Watching when the oldest pending episode reaches seven days or two unwatched canonical episodes accumulate, whichever occurs first. An unwatched movie falls to Haven’t Started after seven days. A show with an older existing backlog does not re-enter merely because another episode airs.

### Continue Watching

Active titles with released, unfinished canonical episodes. Ordered by the user's most recent relevant activity. Episodes can be marked directly from this surface.

### Haven't Started

Released titles present in the user's library with zero watched progress.

### Upcoming

A filterable, library-scoped calendar of future release events. It includes:

- titles in the library that have not yet premiered;
- future episodes of currently airing library titles.

Behavior:

- chronological ordering;
- default next-seven-days view;
- day/week/month filters;
- media-type and title filters;
- provider release times converted to the user's local timezone;
- uncertain times explicitly labelled;
- never invent an exact time when only a date is known.

### Watch Later

A separate stored intent for deliberately deferred titles.

### Responsive presentation

Desktop presents the principal collections as horizontal rows. Mobile uses a vertical layout. Exact UI design remains a later design phase.

## 3. Tracking semantics

- Progress is computed; intent is stored.
- Marking an episode can automatically add its title to the user's library.
- Removing a title from the library hides it from the profile/library but preserves watch history.
- Deleting a title wipes that user's progress and removes it from their profile/library.
- Users can mark or unmark any episode independently and leave intentional gaps.
- Marking any canonical episode after the first always opens a confirmation prompt, even if earlier episodes are already watched.
- `Mark earlier episodes` is selected by default but must be explicitly confirmed every time; its default scope is `Current season`, with `All seasons` available. `This episode only` preserves gaps.
- Unmarking a canonical episode with later watched episodes always prompts whether to unmark only it or it plus later episodes; cascade scope can be current season or all seasons and never includes extras.
- Current-season and all-seasons bulk scopes never include extras or episodes outside the chosen direction.
- For an ongoing title, watching the latest known released canonical episode produces `caught_up` even if earlier gaps remain.
- Group release state is derived independently as `upcoming`, `airing`, `between_seasons`, `hiatus`, `future_unknown`, or `ended`.
- Anime evidence priority is AniList status/schedule, accepted upcoming sequel relations, centralized anime schedule fallback, then positively mapped TMDB status as supporting evidence only.
- A finished season does not mean the franchise ended. Unknown or conflicting continuation evidence becomes `future_unknown`; latest watched then means caught up, not finished.
- `finished` requires the final canonical episode watched plus reliable whole-group `ended` evidence.
- Watched count and progress frontier are distinct; e.g. `5 watched · through episode 12 / ?`.
- Specials, OVAs, ONAs, recaps, and Season 0 remain separately trackable but do not affect canonical caught-up/completed state.

## 4. External playback-position integration

- Kureha has no built-in player.
- An authenticated external API may write optional private playback state: media/episode identity, position seconds, duration seconds, and timestamp.
- Latest valid position wins.
- Playback position does not determine binary watched history or computed tracker progress.

## 5. Explicit v1 non-goals

- Streaming, torrents, or built-in playback.
- Ratings and reviews.
- Comments.
- Recommendations.
- Imports from MAL, AniList, Trakt, or other tracking accounts.
- Collaborative lists.
- Notifications.
- One-way following.
- Offline mode or installable PWA behavior.
- Global public activity feed.

## 6. Infrastructure and quality direction

Current candidate stack remains TanStack Start, React, Drizzle ORM, Supabase Postgres, and Supabase Google OAuth. This remains open to architecture review but no concrete conflict presently justifies replatforming.

Testing direction:

1. Fast deterministic unit tests run by default.
2. PGlite database tests cover deterministic repository/schema behavior without Docker.
3. Opt-in real-Postgres tests use a dedicated `TEST_DATABASE_URL` for Postgres-specific constraints, transactions, and concurrency.

Candidate v1 NFRs accepted during interrogation:

- p95 authenticated reads under 500 ms and mutations under 750 ms, excluding third-party provider latency;
- WCAG 2.2 AA;
- latest Chrome, Firefox, Edge, and Safari plus current mobile browsers;
- 99.5% monthly availability after launch;
- privacy enforced server-side and through database/RLS policy, not merely UI;
- account deletion completed within 24 hours;
- provider outages degrade to cached metadata and never block tracking existing library titles;
- initial validation target of 10,000 users and at least 100 concurrently active users; this is not a hard cap;
- primary Supabase/Postgres data residency in Mumbai, India (`ap-south-1`);
- adaptive provider refresh: airing/schedule data every 15 minutes, upcoming every 6 hours, uncertain/between-seasons daily, recent finished weekly, long-finished monthly;
- launch abuse limits are configurable: anonymous search 30/min/IP, username search 20/min/account+IP, friend requests 5/min and 20/day, tracking mutations 120/min/account, playback writes 30/min/integration+account.

## 7. Locked anime metadata architecture

**Decision status:** Approved and locked on 2026-08-30 after AniList grouping, Shiru relation-tree, and Ani.zip reliability spikes.

- Kureha owns stable canonical group, continuity-track, installment, and episode identities.
- AniList is the canonical external source for anime installment identity, typed relations, release status, titles, and future airing schedules.
- Ani.zip is optional, non-blocking enrichment for MAL/AniDB/TVDB/TMDB mappings and episode titles, dates, runtimes, summaries, and optional images. It never defines canonical identity or progress.
- TMDB remains canonical for movies and non-anime television. It may provide confidently mapped anime artwork, but does not define anime hierarchy or episode structure.
- Anime search starts with AniList. TMDB anime duplicates are suppressed only through positive AniList↔TMDB mappings; uncertain TMDB results remain visible.
- High-confidence `PREQUEL`/`SEQUEL` chains form a clean Kureha group hierarchy. Branching continuities become separate tracks. Specials, OVAs, ONAs, recaps, and side stories attach as extras and do not affect canonical completion.
- Kureha exposes direct AniList relations for manual exploration and correction. Ambiguous relations are not silently merged.
- User-facing provider switching for anime is removed. Corrections use versioned grouping/episode mappings with previews and preserve history through stable Kureha episode IDs.

### Automatic new-season behavior

When AniList exposes a new high-confidence sequel/prequel installment connected to a group already in a user's library:

1. Kureha automatically attaches the installment to that existing group; the user does not add the season as a separate title.
2. Before release, its scheduled events appear in the library-scoped Upcoming calendar.
3. Once canonical episodes release, they enter New Releases only if the user was previously caught up with the group; otherwise the title remains in Continue Watching/backlog.
4. New installments never silently mark episodes watched or change user intent.
5. Ambiguous branches, alternatives, spin-offs, and uncertain mappings require review and remain in Relations until accepted into a track.

### Activity-event behavior

- One user-confirmed bulk operation produces one summarized activity event, e.g. `watched 12 episodes in Season 1`.
- Twelve separately confirmed marks produce twelve separate activity events.
- Completing a season adds a season-completed milestone to the same user operation.

### Reliability requirements

- Provider updates are cached and refreshed in background jobs.
- Provider outages never block existing-library tracking.
- Release processing must be idempotent and deduplicate schedule events.
- Unknown episode totals remain `null`; caught-up is based on known released canonical episodes.
- Notification delivery is still out of v1, but the New Releases eligibility/feed engine is in scope and can later drive notifications.

## 8. Completed spike evidence

The architecture was validated against ten representative franchise graphs and a 12-title Ani.zip reliability sample. Corrected traversal tests passed, and Ani.zip passed only as optional enrichment. Durable evidence lives under `P:/Silas/.opencode-spikes/kureha-anilist/`.

## 9. Superseded historical decisions

These older project statements must not silently override this checkpoint:

- “Kureha is personal-only” is superseded by the community product definition.
- “AniList is dropped” is superseded by the current spike candidate.
- “No playback-position state” is superseded by optional private state received from an external integration; the no-player boundary remains.
- Direct provider-coupled `media_id` identity is incompatible with the internal canonical identity candidate and requires architecture review/migration planning.

## 10. Continuation protocol

1. Read this checkpoint before resuming PRD work.
2. Run and document the anime metadata spike; do not implement production schema changes during the spike.
3. Present evidence and a recommendation to the user; do not silently lock the provider architecture.
4. After explicit provider decision, finish the canonical PRD with stable `US-*`, `FR-*`, `NFR-*`, and `AC-*` IDs.
5. Present the PRD draft for explicit approval before writing or implementing production changes.
