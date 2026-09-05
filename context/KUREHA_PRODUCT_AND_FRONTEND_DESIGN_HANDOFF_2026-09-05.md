# Kureha — Product Summary PRD & Frontend Design Handoff

**Prepared:** 2026-09-05 20:10 IST  
**Owner:** Gurala Ratan Teja (`lupixele`)  
**Canonical product contract:** [`../docs/prd/PRD-001-kureha-core.md`](../docs/prd/PRD-001-kureha-core.md), v1.2  
**Frontend draft:** [`../docs/architecture/FRONTEND-SYSTEM-DESIGN.md`](../docs/architecture/FRONTEND-SYSTEM-DESIGN.md)  
**Frontend status:** **OPEN / NOT APPROVED / DO NOT IMPLEMENT YET**

> This is a compact, design-oriented summary of the approved PRD. If this handoff conflicts with PRD-001, PRD-001 wins. The existing frontend document is only a rough draft to critique, rewrite, or discard.

---

## 1. Product in one sentence

Kureha is a responsive, privacy-first tracker for anime, television, and movies that organizes provider-fragmented media into stable Kureha identities, preserves sparse viewing history, surfaces genuinely relevant new releases, and supports private or friends-visible social activity—without becoming a streaming service.

## 2. The user problem

Existing trackers and metadata providers disagree about anime seasons, split cours, sequels, specials, alternate continuities, episode numbering, and release state. That creates duplicate titles, fragmented progress, noisy release feeds, and fragile watched history.

Kureha must make daily tracking fast while keeping these distinctions correct:

- what is in the user's library;
- what the user intends to watch;
- what the user has actually watched;
- how far their progress frontier reaches despite intentional gaps;
- whether a title is upcoming, airing, between seasons, on hiatus, uncertain, or ended;
- whether a related work is mainline, an alternate continuity, an extra, or merely related.

## 3. Product promises

1. **Fast daily tracking:** the user can see and mark the next relevant episode from Home with minimal interaction.
2. **High-signal New Releases:** only genuinely relevant releases appear—not every new episode from a title with an old backlog.
3. **Stable progress:** provider renames or regrouping never silently reassign or erase watched history.
4. **Clean anime hierarchy:** proven seasons form one group; ambiguous branches remain reviewable.
5. **Useful Upcoming calendar:** future releases for library titles appear in the user's timezone without fabricated precision.
6. **Privacy-safe community:** profile, library, and activity visibility is explicit and private by default.
7. **Resilient tracker:** existing-library tracking works even when metadata providers are unavailable.

---

## 4. Non-negotiable product boundaries

### In scope

- Google OAuth.
- Public catalogue search and media details.
- Private-by-default user profiles.
- Personal library, intent, watched history, rewatches, and sparse progress.
- Anime groups, continuity tracks, installments, canonical episodes, extras, and relation browsing.
- New Releases, Continue Watching, Haven't Started, Watch Later, and Upcoming.
- Mutual friendships and privacy-filtered profile/activity views.
- Optional private external-player playback position ingestion.
- Known-provider artwork choices for logo, cover, and backdrop.
- Maintainer review of ambiguous catalogue/mapping cases.

### Explicitly out of scope for v1

- Streaming, torrents, hosting, playback, or media acquisition.
- Ratings, reviews, comments, reactions, or recommendations.
- Global public activity feed.
- One-way following.
- General collaborative/custom lists and community-created watch orders.
- Push/email/in-app notification delivery.
- User-list imports from AniList, MAL, Trakt, TV Time, etc.
- Arbitrary custom artwork URLs or uploads.
- Offline mutation queues/PWA behavior.
- User-facing provider switching.

---

## 5. Core domain model the UI must communicate

### 5.1 Stable hierarchy

```text
Media Group
  ├─ Mainline continuity track
  │    ├─ Installment / season / cour
  │    │    └─ Canonical episodes
  │    └─ Later installment
  ├─ Alternate continuity track(s)
  ├─ Extras track
  │    └─ OVA / ONA / special / recap / Season 0
  └─ Direct relations
       └─ side story / spin-off / adaptation / source / other
```

Provider IDs are mappings to this hierarchy; they are never the user's watched-history identity.

### 5.2 Independent user-state axes

The design must not collapse these into one generic status dropdown:

| Axis | Values / meaning |
|---|---|
| **Library membership** | In library or not in library |
| **Intent** | `active`, `paused`, `watch_later`, `dropped` |
| **Computed progress** | `unreleased`, `not_started`, `in_progress`, `caught_up`, `finished` |
| **Group release state** | `upcoming`, `airing`, `between_seasons`, `hiatus`, `future_unknown`, `ended` |

There is **no generic “Active” button**. Internal `active` intent is reached through contextual actions such as **Start Watching**, **Resume Watching**, or marking an episode watched.

### 5.3 Sparse progress

Users may watch episodes out of order and retain gaps. Show both:

- actual watched count; and
- progress frontier / latest watched canonical episode.

Example: `5 watched · through episode 12 / ?`.

A user may be caught up or finished while earlier episodes remain intentionally unwatched. The UI must never imply those gaps were automatically filled.

---

## 6. Primary user journeys

### Journey A — Browse and add a title

1. Visitor searches anime, movies, and television without signing in.
2. Results identify source and media type.
3. Verified cross-provider duplicates collapse; mere title/year similarity never proves identity.
4. An uncertain TMDB television result remains visible but clearly cannot be imported until resolved.
5. Visitor can open a read-only provider preview.
6. State-changing actions require Google sign-in and a completed profile.
7. Import/add resolves an existing Kureha group or atomically creates one.

### Journey B — Daily Home tracking

Home is the daily driver, with strict priority:

1. **New Releases** — highest priority.
2. **Continue Watching**.
3. **Haven't Started**.
4. **Watch Later**.
5. **Upcoming** is a separate calendar and may overlap conceptually.

Each group appears in only its highest-priority Home tracking collection.

#### New Releases rule

Include a newly released canonical episode only if the user was caught up immediately before release. The zero-progress exception is the first release of a title already placed in the library while unreleased.

A series leaves New Releases when:

- the oldest pending eligible episode reaches seven days; or
- a second unwatched canonical episode accumulates;

whichever happens first. It then moves to Continue Watching without changing watched state, intent, membership, or history.

A newly released unwatched movie leaves New Releases after seven days and moves to Haven't Started.

### Journey C — Mark or unmark episodes

- Episode 1 may be marked directly.
- Marking any later canonical episode must always open confirmation.
- Default choice: **Mark earlier episodes**.
- Default scope: **Current season**.
- Alternative: **This episode only**, preserving all gaps.
- **All seasons** is an explicit broader scope and excludes later episodes and extras.

For unmarking:

- If later watched canonical episodes exist, confirmation is mandatory.
- Default: **This episode only**.
- Optional: **This and later episodes**, scoped to current season or all seasons.
- If rewatches are involved, show **Unmark once** (default) versus **Unmark completely**.

### Journey D — Library intent

- Remove from library: hides the title but preserves watched history and prior intent.
- Delete tracking: destructive, separately labelled, confirmed, and removes membership/progress/history for that group.
- Watch Later, Pause, and Drop are explicit intent actions.
- Resume Watching applies when paused/dropped/Watch Later already has progress.
- Start Watching applies only to released, zero-progress Watch Later titles.

### Journey E — Understand a franchise

- Media Details presents group, tracks, ordered installments, episodes, extras, and direct relations.
- High-confidence uninterrupted prequel/sequel chains may be grouped automatically.
- Alternatives, branches, spin-offs, and uncertain mappings cannot silently join mainline.
- Relation cards show relation labels, open the related title/group, and preserve browser Back history.

### Journey F — Upcoming

- Only library-scoped titles.
- Includes premieres and future canonical episodes.
- Defaults to the next seven days.
- Supports day/week/month and media/title filters.
- Exact timestamps render in user-local time.
- Date-only/uncertain events are explicitly labelled; never invent a time.
- Cached events remain visible during provider outages with freshness context.

### Journey G — Community and privacy

- Profiles default to private.
- Visibility options: private, friends-only, public.
- Friendship is mutual only after request acceptance.
- Profile, library, and activity views use the same visibility policy.
- There is no global activity feed.
- Playback position is always owner-only and must never leak through profile/activity/library APIs.
- Bulk actions produce one summarized activity event; separate actions remain separate events.

### Journey H — Personal artwork

- Title logo: eligible Fanart.tv transparent logos only; text title fallback is normal.
- Cover/backdrop: eligible AniList/TMDB assets.
- A user can select logo, cover, and backdrop independently per group.
- Preferences affect that user's profile presentation—not canonical defaults for everyone.
- If a selected asset becomes unavailable, preserve the preference reference but render a valid fallback.

### Journey I — Maintainer review

Maintainers need a secure, deny-by-default interface to:

- inspect ambiguous branch/mapping cases;
- preview proposed installment/episode movements;
- see matched and unmatched history before activation;
- accept/reject/resolve with evidence;
- activate a mapping version atomically;
- roll back by reactivating a prior valid version.

Exact review-screen design is deliberately open.

---

## 7. Required product surfaces (visual design still open)

The final information architecture may rename or combine routes, but it must cover:

1. Authentication and first-time profile setup.
2. Home daily-tracking dashboard.
3. Unified catalogue search.
4. Read-only provider preview.
5. Canonical media/franchise details.
6. Episode tracking and bulk confirmation flows.
7. Library management and intent actions.
8. Upcoming calendar.
9. User profile and privacy settings.
10. Friend search/request management.
11. Privacy-filtered activity history.
12. Personal artwork selection.
13. Maintainer review and mapping-version preview.
14. Account deletion and destructive confirmations.

---

## 8. Responsive and accessibility constraints

- No feature loss between desktop and mobile.
- Desktop primary Home collections are horizontal rows.
- Mobile collections are vertical with touch-appropriate controls.
- Support current stable Chrome, Firefox, Edge, Safari, Chrome Android, and Safari iOS.
- Do not rely on color alone for watched/release/intent state.
- Every destructive or bulk action must state its exact scope before confirmation.
- Loading, empty, partial-provider, stale-cache, unauthorized, and error states must be intentionally designed.

---

## 9. Provider behavior visible to users

| Provider | Product role | Visible degradation |
|---|---|---|
| AniList | Anime identity, relations, status, airing schedule, anime artwork | Last-known-good data; partial search if TMDB succeeds |
| TMDB | Movies, non-anime television, eligible mapped artwork | Last-known-good data; partial search if AniList succeeds |
| Ani.zip | Optional episode/cross-ID enrichment | Missing enrichment must not block use |
| Fanart.tv | Optional transparent title logos only | Text title fallback; never an error that blocks tracking |

Provider internals, credentials, raw payloads, SQL, and stack traces must never appear in the UI.

---

## 10. Design decisions intentionally still open

These require owner iteration before frontend implementation:

1. Overall visual identity, color system, typography, density, motion, and illustration style.
2. Desktop navigation: top bar, sidebar, hybrid, or another model.
3. Mobile navigation and action placement.
4. Home card anatomy and horizontal-row behavior.
5. Search result layout and preview interaction (drawer, modal, page, split view).
6. Media Details hierarchy and how continuity tracks/relations are visualized.
7. Episode-list density, controls, watched-state visuals, and bulk-confirmation presentation.
8. Library information architecture: tabs, filters, rows/cards, or combined modes.
9. Calendar visual model.
10. Profile and activity presentation.
11. Artwork selector interaction.
12. Maintainer review visualization.
13. Empty/loading/error/stale/partial states.
14. Accessibility target and keyboard navigation details.

**The current frontend draft contains suggestions for several of these. None are approved.**

---

## 11. Current implementation state

### Verified checkpoints already on GitHub default branch

- Baseline and canonical product contract.
- M1 canonical media identity and mapping history.
- M2 canonical tracking and sparse progress mutations.
- M3 additive metadata schema.
- Typed provider transport/clients and normalization boundaries.
- Headless catalogue ingestion, mapping versions, relation resolution, review queue, refresh jobs, artwork preferences, search, preview, and canonical details services.

Current Git head at handoff: `5111923` on GitHub default branch `feat/m1-canonical-media-identity`.  
Current working branch at handoff: `feat/m3-d-review-refresh-artwork`.

### Most recent verification

- `npm run typecheck`: passed.
- `npm test`: 106/106 tests passed across 8 suites.
- `npm run build`: client and SSR builds passed.
- No frontend implementation was started after the owner paused it.

### Important honesty note

“Backend checkpoints exist and tests pass” does **not** mean production readiness. Before launch, Kureha still needs a fresh adversarial acceptance review, real-Postgres concurrency/RLS coverage where required, production Supabase provisioning in `ap-south-1`, backup/restore policy, legal/provider-terms review, moderation/contact policy, and privacy/terms/account-deletion disclosures.

---

## 12. Rules for the next Hermes session

1. Read this handoff and canonical PRD-001 first.
2. Treat `FRONTEND-SYSTEM-DESIGN.md` as a disposable critique target—not an approved design.
3. **Do not build frontend code until the owner explicitly approves a frontend system design.**
4. Interrogate design decisions one dependent question at a time, with 2–4 concrete options and a recommendation.
5. Prefer visual mockups/wireframes for comparison before implementation.
6. Keep product behavior fixed unless the owner explicitly revises PRD-001.
7. Once the frontend design is approved, Silas remains architect/reviewer and OpenClaude is the primary builder.
8. Fall back to Silas/Codex implementation only if OpenClaude demonstrably fails.
9. Continue autonomously after approval unless a real product decision requires owner input.

## 13. Suggested opening prompt for the new session

> Read `context/KUREHA_PRODUCT_AND_FRONTEND_DESIGN_HANDOFF_2026-09-05.md`, `docs/prd/PRD-001-kureha-core.md`, and the unapproved draft `docs/architecture/FRONTEND-SYSTEM-DESIGN.md`. Do not code. Help me redesign the Kureha frontend from first principles. Ask one high-impact design question at a time with selectable options and your recommendation. Treat every visual/layout/navigation idea in the existing draft as open for replacement.
