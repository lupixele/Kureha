# PRD-001: Kureha v1 — Community Media Tracker

**Status:** Approved — initial 2026-08-30; owner-approved revisions 2026-08-31 and 2026-09-01

**Version:** 1.2

**Owner:** Gurala Ratan Teja (lupixele)  
**Product:** Kureha  
**Draft date:** 2026-08-30  
**Scope:** Responsive web application v1  

> This document is the product contract. Implementation details may evolve, but behavior identified by `US-*`, `FR-*`, `NFR-*`, and `AC-*` must not change without updating and re-approving this PRD.

> **v1.1 change:** Added explicit `Unmark once` versus `Unmark completely` behavior for rewatched state (`FR-068H/I`, `AC-027F/G`). Unreleased titles remain addable to the library and Upcoming; only watched mutations are release-gated.

> **v1.2 change:** Added Fanart.tv as optional transparent styled title-logo artwork and per-profile provider-art preferences for title logos, covers, and backdrops. Fanart.tv is not a canonical metadata provider and does not supply Kureha cover or backdrop art in v1.

---

## 1. Problem statement

People who watch movies, television, and anime need a reliable way to understand what they are watching, what is newly available, what releases next, and what their friends have watched. Existing metadata providers represent the same media inconsistently—especially anime seasons, split cours, sequels, specials, and alternate continuities—causing duplicate titles, broken progress, and noisy “new episode” feeds. Users need a tracker that preserves accurate personal history, presents clean franchise groupings, prioritizes genuinely new episodes only when they were previously caught up, and supports privacy-controlled community discovery without becoming a streaming service.

---

## 2. Target users and core job-to-be-done

### 2.1 Primary users

- People tracking movies, television series, and anime across multiple sources.
- Anime viewers who want separate AniList installments presented as a clean grouped title.
- Friends who want to share libraries and activity under explicit privacy controls.
- Users of external players that may report private playback positions to Kureha.

### 2.2 Core job-to-be-done

> When I open Kureha, help me immediately see genuinely new episodes for shows I had caught up with, continue my active backlog, understand upcoming releases in my library, and update progress with minimal effort while preserving accurate history.

### 2.3 Secondary jobs

- Organize released-but-unstarted titles, unreleased titles, and Watch Later titles.
- Explore a title’s prequels, sequels, side stories, alternatives, and spin-offs.
- View a friend’s profile, library, and activity when their visibility permits it.
- Preserve tracking when providers rename, split, regroup, or renumber media.

---

## 3. Goals and success measures

### G-01 — Fast daily tracking
Users can identify and mark their next relevant episode directly from Home without opening a separate details workflow.

**Success indicators:**
- At least 90% of episode marks from Home complete in two user actions or fewer.
- Home classification tests cover every row transition and remain deterministic.

### G-02 — High-signal New Releases
The New Releases feed contains releases for previously caught-up groups—not every unwatched episode from a backlog.

**Success indicators:**
- Zero known false-positive backlog entries in acceptance fixtures.
- Duplicate provider release events never create duplicate feed entries.

### G-03 — Stable, correct progress
Provider changes and grouping corrections do not silently erase or reassign watched history.

**Success indicators:**
- Every watched event references a stable Kureha episode ID.
- Mapping migrations report matched and unmatched episodes before activation.
- No destructive remapping without an explicit reviewed migration.

### G-04 — Clean anime hierarchy
Separate AniList installments can appear as one Kureha group with clear continuity tracks, extras, and related works.

**Success indicators:**
- High-confidence prequel/sequel chains auto-group.
- Ambiguous branches remain reviewable instead of silently merged.
- Specials and OVAs never affect canonical completion unless explicitly reclassified.

### G-05 — Useful Upcoming calendar
Users can see future premieres and episodes for library titles in a local-time, filterable release calendar.

**Success indicators:**
- Upcoming defaults to the next seven days.
- Unknown times are labelled rather than fabricated.
- Provider outages use cached events without blocking tracking.

### G-06 — Privacy-safe community
Users can discover friends and share progress without exposing data by default.

**Success indicators:**
- New profiles default to private at both application and database-policy levels.
- Unauthorized visibility cases are covered by integration tests.
- Playback position is never returned through public/friend profile APIs.

### G-07 — Reliable v1 foundation
The product has deterministic local tests, measurable quality gates, and recoverable provider behavior.

**Success indicators:**
- Unit tests run without network or credentials.
- PGlite covers local persistence behavior.
- Real-Postgres tests are opt-in and use `TEST_DATABASE_URL` only.
- Typecheck, tests, and build are green before progression.

---

## 4. Non-goals and explicitly deferred scope

Kureha v1 will **not** include:

- Streaming, torrent discovery, torrent handling, playback, or a built-in video player.
- Automatic collection of playback position from a local player without an authenticated integration call.
- Ratings, reviews, comments, or reactions.
- Recommendation engine or personalized recommendation ranking.
- Global public activity feed.
- One-way following.
- General-purpose collaborative lists.
- Custom user lists, a dedicated Favourites section, and community-created watch-order schemes. These are future roadmap items, not v1 requirements.
- Push, email, or in-app notification delivery. The New Releases eligibility/feed engine is in scope; delivery channels are deferred.
- Imports or synchronization from MAL, AniList user lists, Trakt, TV Time, or similar trackers.
- Offline mutation queues or conflict resolution.
- Installable PWA behavior.
- Data export in v1.
- Automatic acceptance of ambiguous franchise branches.
- User-facing anime metadata-provider switching.
- Using Ani.zip, TMDB, TVDB, MAL, or AniDB as Kureha’s canonical identity.
- Treating specials, OVAs, ONAs, recaps, promotional episodes, or Season 0 as canonical completion requirements by default.

---

## 5. Product principles and domain definitions

### 5.1 Tracker-first boundary

Kureha records viewing state and optional external playback position. It does not acquire, host, distribute, or play media.

### 5.2 Stable internal identity

Kureha owns stable identifiers for:

- media groups;
- continuity tracks;
- installments;
- canonical and extra episodes;
- provider mappings;
- user tracking state;
- watched events.

Provider IDs are mappings, never Kureha’s primary identity.

### 5.3 Two-axis tracking model

**Progress** is computed from release metadata and watched events:

- `unreleased`
- `not_started`
- `in_progress`
- `caught_up`
- `finished`

**Group release state** is derived separately:

- `upcoming` — the first accepted installment has not premiered.
- `airing` — an accepted installment is currently releasing.
- `between_seasons` — the current installment finished and an accepted sequel is announced/upcoming.
- `hiatus` — an accepted installment or group is explicitly paused with expected continuation.
- `future_unknown` — currently known content finished, but no reliable evidence confirms either continuation or franchise end.
- `ended` — reliable evidence confirms the group/franchise has ended or was cancelled.

**Intent** is stored independently:

- `active`
- `paused`
- `watch_later`
- `dropped`

An episode mark may reactivate a paused, Watch Later, or dropped title when the transition rule is explicitly invoked. Progress and intent must not collapse into one status enum.

### 5.4 Canonical episode

An episode classified as part of a group’s accepted main continuity. Canonical episodes affect caught-up and finished states.

### 5.5 Extra episode

An OVA, ONA, special, recap, promotional episode, compilation, or Season 0 entry that is separately trackable but does not affect canonical completion by default.

### 5.6 Caught up

A group is caught up when its latest known released canonical episode is watched and group release state is `airing`, `between_seasons`, `hiatus`, or `future_unknown`. Earlier unwatched canonical episodes may remain intentional gaps; caught-up status must not silently mark them watched.

### 5.7 Finished

A group is finished only when its final known canonical episode is watched and group release state is reliably confirmed `ended`. A finished installment alone does not prove the group/franchise ended. Earlier gaps may remain intentional.

### 5.7A Sparse progress and progress frontier

Episode history is a sparse set: users may mark episodes in any order and leave holes. The latest watched canonical episode determines the progress frontier, while the watched count reports only episodes actually marked watched. Therefore a title may be caught up or finished while still showing earlier unwatched episodes.

### 5.8 Library membership, progress, and intent

These are independent dimensions:

- **In library / not in library** is membership only.
- **Haven’t started** is computed progress: zero watched canonical episodes on a released title.
- **Watch Later** is stored intent and may coexist with Haven’t Started.
- Watch history is independent of library membership.
- Removing from library preserves history.
- Deleting tracking data removes library membership and the user’s progress/history for that group.

---

## 6. User stories

### Account and privacy

- **US-01:** As a visitor, I want to sign in with Google, so that I can securely access my tracker without managing another password.
- **US-02:** As a new user, I want my profile private by default, so that no tracking data is exposed without my choice.
- **US-03:** As a user, I want to set my profile to private, friends-only, or public, so that I control who sees my library and activity.
- **US-04:** As a user, I want to delete my account and associated personal data, so that I can leave the service completely.

### Search and library

- **US-05:** As a user, I want to search movies, television, and anime without duplicate anime results, so that I can add the correct title.
- **US-06:** As a user, I want marking an episode to add its group to my library automatically, so that tracking is immediate.
- **US-07:** As a user, I want to remove a title from my library without deleting progress, so that I can hide it while retaining history.
- **US-08:** As a user, I want a separate destructive delete action, so that I can completely erase my progress for a title.
- **US-09:** As a user, I want to place a title in Watch Later, pause it, drop it, or reactivate it, so that intent reflects my plans independently of progress.

### Daily tracking and Home

- **US-10:** As a caught-up viewer, I want newly released canonical episodes shown first, so that I immediately know what became available.
- **US-10A:** As a user who added an unreleased title to my library, I want its first canonical release shown in New Releases when it premieres, so that it does not silently fall into Haven’t Started.
- **US-11:** As a viewer with an existing backlog, I want active titles ordered by recent activity instead of mislabelled as New Releases, so that the priority feed stays meaningful.
- **US-12:** As a user, I want to mark an episode directly from Home, so that updating progress is fast.
- **US-13:** As a user, I want released library titles with no progress under Haven’t Started, so that I can choose what to begin.
- **US-14:** As a user, I want Watch Later titles shown separately, so that intentional deferrals do not mix with active or unstarted titles.
- **US-14A:** As a user, I want a Resume Watching action on paused, dropped, or Watch Later titles that already have progress, so that I can return them to active watching without marking another episode first.
- **US-14B:** As a user, I want a Start Watching action only on a released, zero-progress Watch Later title, so that I can deliberately move it into Continue Watching before marking the first episode.

### Upcoming

- **US-15:** As a user, I want a calendar of future premieres and episodes for my library, so that I can plan what to watch.
- **US-16:** As a user, I want day/week/month and media/title filters, so that I can narrow the Upcoming calendar.
- **US-17:** As a user, I want release times in my timezone with uncertainty labels, so that the calendar is useful without pretending incomplete metadata is exact.

### Episode, season, and show tracking

- **US-18:** As a user, I want to mark or unmark episodes in any order and leave intentional gaps, so that Kureha records what I actually watched instead of assuming a contiguous sequence.
- **US-18A:** As a user marking a later episode, I want Kureha to ask whether to mark earlier episodes too, so that I can choose between sparse and contiguous progress.
- **US-19:** As a user, I want bulk options limited to the current season or all seasons, so that I can avoid wiping intentional gaps with an overly broad default.
- **US-20:** As a user, I want watching the latest released episode to make an ongoing show caught up and watching the final episode to make an ended show finished, even if earlier gaps remain.
- **US-21:** As a user, I want specials and OVAs tracked separately, so that extras do not distort canonical completion.
- **US-22:** As a user, I want unknown totals displayed honestly, so that ongoing media can show progress such as `5 / ?`.

### Anime hierarchy and metadata

- **US-23:** As an anime viewer, I want related seasons grouped under one Kureha title, so that my library is not fragmented by provider entries.
- **US-24:** As an anime viewer, I want alternative continuities represented as separate tracks, so that branches are not presented as consecutive seasons.
- **US-25:** As an anime viewer, I want to browse direct relations such as prequels, sequels, side stories, and spin-offs, so that I can understand the franchise.
- **US-26:** As a user, I want newly announced high-confidence seasons attached automatically to an existing library group, so that I do not add every season manually.
- **US-27:** As a user, I want ambiguous branches held for review, so that Kureha does not silently corrupt my group hierarchy.
- **US-28:** As a user, I want metadata regrouping to preserve watched history, so that provider corrections do not erase progress.

### Community

- **US-29:** As a user, I want to search for another user by username, so that I can find friends.
- **US-30:** As a user, I want to send, accept, decline, and remove mutual friendships, so that friends-only visibility has an explicit relationship.
- **US-31:** As an authorized viewer, I want to see another user’s profile, library, and activity according to their visibility, so that community sharing respects consent.
- **US-32:** As a user, I want my external playback position always private, so that detailed viewing behavior is never publicly exposed.

### External integration

- **US-33:** As an authenticated external player, I want to submit playback position for a mapped movie or episode, so that Kureha can resume context without hosting playback.
- **US-34:** As a user, I want tracking to remain available when metadata providers are down, so that existing-library actions are reliable.

---

## 7. Functional requirements

### 7.1 Authentication, profile, and account

- **FR-001:** The system must support Google OAuth as the only v1 authentication method.
- **FR-002:** The system must create exactly one Kureha profile for a newly authenticated account.
- **FR-003:** A new profile’s visibility must default to `private` in application logic and persistence policy.
- **FR-004:** A profile must support `private`, `friends_only`, and `public` visibility.
- **FR-005:** Each profile must have a unique username (handle) and a separate display name.
- **FR-005A:** Usernames must follow Discord-style handle rules: 2–32 characters, forced lowercase, and limited to `a-z`, `0-9`, underscore, and period; consecutive periods are invalid. Usernames must be unique case-insensitively, SFW, and must not impersonate reserved Kureha/system names.
- **FR-005B:** Display names must be 1–32 Unicode characters and may contain spaces, capitalization, emoji, and special characters comparable to Discord display names, subject to SFW and safety rules. Display names need not be unique.
- **FR-005C:** Username changes are limited to once every seven days; display-name changes are limited to five per hour.
- **FR-006:** Account deletion must require a recent authenticated session and explicit destructive confirmation.
- **FR-007:** Account deletion must remove profile, friendship, tracking, activity, playback-position, and user-owned preference data.
- **FR-008:** Account deletion must not remove shared canonical media metadata used by other users.

### 7.2 Community and authorization

- **FR-009:** The catalogue, media details, search, and public profiles must be browsable without authentication. Private and friends-only profile data must remain protected.
- **FR-009A:** Authentication is required for every state-changing action, including library changes, watched/unwatched marks, intent actions, friendships, profile edits, account deletion, and playback-position writes.
- **FR-009B:** Users must be discoverable by username according to profile/discovery policy; public profile discovery is available anonymously while private profile content remains hidden.
- **FR-010:** Friend requests must have requester, recipient, status, and timestamps.
- **FR-011:** The system must prevent self-friendship and duplicate active friend requests.
- **FR-012:** Friendship becomes mutual only after acceptance.
- **FR-013:** Either friend may remove the friendship.
- **FR-014:** Private profile content is visible only to its owner.
- **FR-015:** Friends-only profile content is visible only to its owner and accepted friends.
- **FR-016:** Public profile content is visible to authenticated and unauthenticated viewers, subject to later abuse controls.
- **FR-017:** Profile activity visibility must follow profile visibility.
- **FR-018:** Playback positions must never be returned by profile, library, activity, friendship, or public APIs.
- **FR-019:** There must be no global activity feed in v1.

### 7.3 Canonical media identity

- **FR-020:** Kureha must assign stable internal IDs to media groups, tracks, installments, and episodes.
- **FR-021:** Provider IDs must be stored in provider-mapping records with provider, media type, provider ID, confidence, source, and timestamps.
- **FR-022:** User tracking rows must reference Kureha media IDs, not provider IDs.
- **FR-023:** Watched events must reference stable Kureha episode IDs when episodic media is involved.
- **FR-024:** Mapping changes must be versioned and auditable.
- **FR-025:** Activating a mapping change must preserve matched watched events and flag unmatched events for review.

### 7.4 Metadata providers

- **FR-026:** TMDB must supply canonical external metadata for movies and non-anime television.
- **FR-027:** AniList must supply canonical external anime installment identity, typed relations, release status, titles, artwork, and future airing schedule.
- **FR-028:** Ani.zip may enrich anime with MAL, AniDB, TVDB, TMDB, and other mappings plus episode metadata.
- **FR-029:** Ani.zip failure or missing fields must not block search, library reads, episode marking, or progress derivation.
- **FR-030:** Ani.zip data must not define Kureha canonical identity or watched progress.
- **FR-031:** TMDB artwork may enrich an anime group only through a positive stored AniList-to-TMDB mapping.
- **FR-032:** Provider payloads must be normalized behind typed adapters before entering the tracking domain.
- **FR-032A:** Fanart.tv may supply transparent styled title-logo artwork only when the title has a positive stored mapping to the identifier required by Fanart.tv. Fanart.tv must not define canonical identity, relations, release state, episodes, watched progress, cover art, or backdrop art.
- **FR-032B:** Kureha must retain normalized artwork candidates with provider provenance, provider asset identifier or path, language, vote/rank metadata when available, dimensions when available, and last-successful refresh time. Full raw provider payloads must not be retained.
- **FR-032C:** Default transparent title-logo selection must prefer the viewer's configured language, then English, then language-neutral artwork, choosing the highest-ranked candidate within the first available language tier.
- **FR-032D:** Default cover and backdrop selection must use eligible AniList or TMDB artwork under canonical-provider and positive-mapping rules. Fanart.tv posters, covers, and backgrounds are outside v1 scope even if Fanart.tv exposes them.
- **FR-032E:** An authenticated user may select separate preferred title-logo, cover, and backdrop candidates for each Kureha media group from known eligible provider assets.
- **FR-032F:** A user's selected artwork preferences are part of that user's profile presentation. The owner and viewers authorized to see that profile/library must see those selections; unauthorized viewers must not receive the preference records.
- **FR-032G:** User artwork preferences must reference Kureha media-group IDs and normalized provider-asset IDs, not arbitrary external URLs. Custom URLs and user-uploaded artwork are deferred beyond v1.
- **FR-032H:** If a selected provider asset becomes unavailable or ineligible, Kureha must preserve the preference reference for audit/recovery but render the current default eligible asset until the selection becomes valid or is replaced.
- **FR-032I:** Fanart.tv unavailability, missing logos, mapping gaps, quota exhaustion, or schema changes must degrade to a text title without blocking search, details, library operations, tracking, canonical import, or AniList/TMDB refresh.

### 7.5 Unified search

- **FR-033:** Search must query AniList for anime and TMDB for movies/television.
- **FR-034:** Search results must identify source category and Kureha media type.
- **FR-035:** A TMDB result must be suppressed as a duplicate anime only when its TMDB ID positively maps to an AniList result.
- **FR-036:** Country, genre, keyword, or title similarity alone must not cause definitive suppression.
- **FR-037:** Uncertain TMDB results must remain visible rather than risk a false negative.
- **FR-038:** Selecting an existing provider mapping must resolve to the existing Kureha media group instead of creating a duplicate.

### 7.6 Anime groups, tracks, and relations

- **FR-039:** A Kureha anime group may contain one or more continuity tracks.
- **FR-040:** A track must contain an ordered list of installments.
- **FR-041:** A high-confidence uninterrupted AniList `PREQUEL`/`SEQUEL` chain may be grouped automatically.
- **FR-042:** Mainline traversal must be root-relative and must not expand unrelated edge types into the mainline.
- **FR-043:** Branching sequels, alternatives, spin-offs, or uncertain mappings must not be silently added to a mainline track.
- **FR-044:** Branching continuities may be represented as separate tracks within one group.
- **FR-045:** Specials, OVAs, ONAs, recaps, compilations, promotional content, and Season 0 must default to extras.
- **FR-046:** Extras must be separately trackable.
- **FR-047:** Extras must not affect canonical caught-up or finished states unless a reviewed mapping explicitly reclassifies them.
- **FR-048:** Media Details must show direct AniList relations excluding character-only and non-anime relations.
- **FR-049:** Relation entries must show their relation type and open the related title/group.
- **FR-050:** Relation navigation must preserve browser/navigation history.

### 7.7 Automatic new-season attachment

- **FR-051:** Background metadata refresh must detect newly added AniList relations for known groups.
- **FR-052:** A new high-confidence sequel/prequel installment must automatically attach to the existing group.
- **FR-053:** Automatic attachment must not change user intent or mark episodes watched.
- **FR-054:** Before premiere, an attached installment’s release events must appear in Upcoming for users who have the group in their library.
- **FR-055:** Once a canonical episode releases, New Releases eligibility must be evaluated against the user’s pre-release caught-up state.
- **FR-056:** An ambiguous new branch must remain in Relations/review state and must not change completion.
- **FR-057:** Relation-event ingestion must be idempotent.

### 7.8 Library and intent

- **FR-058:** A user may add a group to the library explicitly.
- **FR-059:** Marking an episode may create missing user tracking/library state transactionally.
- **FR-060:** Removing from library must preserve watched history and progress data.
- **FR-061:** Deleting tracking data must remove the user’s library membership, watched events, intent, and playback positions for that group.
- **FR-062:** Destructive deletion must require confirmation and clearly distinguish itself from removal.
- **FR-063:** The user-facing intent actions are Pause, Watch Later, and Drop. There must be no generic `Active` button or status picker. The internal `active` intent is reached only through context-specific actions such as Start Watching, Resume Watching, or marking an episode watched.
- **FR-064:** Intent transitions must not directly rewrite watched history.
- **FR-065:** Marking watched on a paused, Watch Later, or dropped group must reactivate it to `active` unless the user explicitly opts out in a later UX specification.
- **FR-065A:** A paused, dropped, or Watch Later title with existing watched progress must expose Resume Watching, changing intent to `active` without marking another episode.
- **FR-065B:** A released Watch Later title with zero watched canonical progress must expose Start Watching, changing intent to `active` without marking an episode.
- **FR-065C:** Start Watching and Resume Watching must update relevant activity recency so the title can appear in Continue Watching immediately.
- **FR-065D:** Library membership, computed Haven’t Started progress, and stored Watch Later intent must remain independent; no one dimension may overwrite another implicitly.
- **FR-065E:** A normal in-library Haven’t Started title must not show a Start Watching or Resume Watching primary action; it remains in Haven’t Started until the user marks progress or changes another explicit state.
- **FR-065F:** The system must record an explicit zero-progress Start Watching transition so that a Watch Later title can appear in Continue Watching before its first episode is marked.

### 7.9 Episode tracking and derived progress

- **FR-066:** A user must be able to mark or unmark any canonical or extra episode independently and in any order.
- **FR-066A:** Marking the first canonical episode may proceed directly. Marking any later canonical episode must always open a confirmation prompt before mutation, even when earlier episodes are already watched.
- **FR-066B:** The confirmation prompt must ask whether to mark earlier episodes too and offer `Mark earlier episodes` and `This episode only`.
- **FR-066C:** `Mark earlier episodes` must be selected by default, but the user must explicitly confirm the prompt every time; the default selection must never bypass confirmation.
- **FR-066D:** When `Mark earlier episodes` is selected, the prompt must offer `Current season` and `All seasons` scope. `Current season` must be the default scope.
- **FR-066E:** `Current season` must mark released canonical episodes through N only within N’s installment/season; it must not modify other seasons or extras.
- **FR-066F:** `All seasons` must mark released canonical episodes through N across preceding accepted mainline installments and the current season; it must not mark later episodes or extras.
- **FR-066G:** `This episode only` must mark only N and preserve every earlier gap.
- **FR-067:** Re-marking an already watched episode must update rewatch semantics without creating duplicate primary watched identity.
- **FR-068:** A user must be able to unmark any watched canonical or extra episode.
- **FR-068A:** Unmarking a canonical episode that has later watched canonical episodes must always open a confirmation prompt before mutation.
- **FR-068B:** The unwatch prompt must offer `This episode only` and `This and later episodes`.
- **FR-068C:** `This episode only` must be selected by default, and the user must explicitly confirm every time.
- **FR-068D:** `This and later episodes` must offer `Current season` and `All seasons`; `Current season` must be the default scope.
- **FR-068E:** Current-season scope must unmark the selected canonical episode and later watched canonical episodes only within that season. All-seasons scope must also unmark later watched canonical episodes in subsequent accepted mainline seasons.
- **FR-068F:** Unwatch bulk actions must not affect earlier episodes or extras.
- **FR-068G:** If no later watched canonical episodes exist, unmarking may proceed directly without the cascade prompt.
- **FR-068H:** If any selected watched episode has `rewatch_count > 1`, the confirmation must additionally offer `Unmark once` and `Unmark completely`; `Unmark once` must be selected by default.
- **FR-068I:** `Unmark once` must decrement each selected row by one and delete only rows whose count was 1. `Unmark completely` must delete each selected watched row regardless of its rewatch count.
- **FR-069:** A season-level bulk action must mark the current season’s released canonical episodes watched and must never silently expand to all seasons.
- **FR-070:** A separate explicitly labelled all-seasons bulk action may mark all currently released canonical episodes in the accepted mainline watched.
- **FR-071:** Bulk operations must execute transactionally and present their scope before confirmation.
- **FR-072:** An ongoing group must derive `caught_up` when its latest known released canonical episode is watched, even if earlier canonical gaps remain.
- **FR-073:** An ended group must derive `finished` when its final canonical episode is watched, even if earlier canonical gaps remain.
- **FR-073A:** Caught-up and finished derivation must not create watched records for earlier gaps.
- **FR-074:** A group with no watched canonical episodes and at least one released canonical episode must derive `not_started`.
- **FR-075:** A group whose latest released/final canonical episode is not watched and that has at least one watched canonical episode must derive `in_progress`.
- **FR-076:** A group with no released canonical episodes must derive `unreleased`.
- **FR-077:** Unknown lifetime episode totals must remain nullable. The UI must distinguish actual watched count from progress frontier, e.g. `5 watched · through episode 12 / ?` when gaps exist.
- **FR-078:** Progress derivation must use the known released canonical sequence and latest/final episode identity, not a guessed lifetime total or a contiguous-prefix assumption.

### 7.9A Group release-state derivation

- **FR-078A:** Group release state must be derived independently from user progress and individual-installment completion.
- **FR-078B:** Evidence priority for anime must be: AniList installment status and `nextAiringEpisode`; accepted AniList sequel relations with `NOT_YET_RELEASED`; centralized anime schedule/status fallback such as AnimeSchedule.net; positively mapped TMDB series status as supporting evidence only.
- **FR-078C:** An AniList installment marked `FINISHED` must not by itself mark its Kureha group `ended`.
- **FR-078D:** A finished current installment with an accepted upcoming sequel must derive `between_seasons`.
- **FR-078E:** Active release evidence must derive `airing`; explicit paused/returning evidence may derive `hiatus`.
- **FR-078F:** If known content is finished and no reliable source confirms continuation or franchise end, the group must derive `future_unknown`, not `ended`.
- **FR-078G:** `ended` requires reliable explicit whole-group/franchise evidence; mapped TMDB status alone is insufficient for anime.
- **FR-078H:** Conflicting provider evidence must resolve conservatively to `future_unknown` and create an observable review condition.
- **FR-078I:** `upcoming` applies only before the first accepted installment premieres; announced later seasons use `between_seasons`.
- **FR-078J:** Release-state refresh must be cached, idempotent, and retain evidence source, precision, and timestamp.

### 7.10 Home surfaces

- **FR-079:** Home must prioritize New Releases above other tracking collections.
- **FR-080:** New Releases must include a released canonical episode when the user was caught up immediately before that episode became available.
- **FR-080A:** New Releases must also include the first canonical release of a title that was already in the user’s library while unreleased, even though the user has no prior progress.
- **FR-081:** A group with an older canonical backlog must not appear in New Releases solely because a later episode released; the explicit first-release rule in FR-080A is the only zero-progress exception.
- **FR-082:** Continue Watching must contain active groups with remaining released canonical episodes, including groups explicitly started or resumed before any new episode is marked.
- **FR-083:** Continue Watching must be ordered by most recent relevant tracking activity descending, including Start Watching and Resume Watching actions.
- **FR-084:** Episode marking must be available directly from New Releases and Continue Watching.
- **FR-085:** Haven’t Started must contain in-library, released groups with zero watched canonical progress, except while a higher-priority New Releases entry is pending or after a zero-progress Watch Later title is explicitly started into Continue Watching.
- **FR-086:** Watch Later must contain groups whose stored intent is `watch_later`.
- **FR-087:** Each group must appear in only the highest-priority applicable Home tracking collection, excluding Upcoming because Upcoming is an independent calendar.
- **FR-088:** Desktop must present primary collections as horizontal rows.
- **FR-089:** Mobile must present collections vertically with touch-appropriate controls.

### 7.11 Upcoming calendar

- **FR-090:** Upcoming must be scoped to groups in the user’s library.
- **FR-091:** Upcoming must include premieres for unreleased library groups.
- **FR-092:** Upcoming must include future canonical episodes for currently airing library groups.
- **FR-093:** Upcoming must default to the next seven days.
- **FR-094:** Upcoming must support day, week, and month ranges.
- **FR-095:** Upcoming must support media-type and title filters.
- **FR-096:** Events must be ordered chronologically.
- **FR-097:** Exact release times must be displayed in the user’s local timezone.
- **FR-098:** Date-only or uncertain events must be labelled as uncertain and must not receive invented times.
- **FR-099:** Duplicate provider events for the same Kureha episode must collapse into one event.
- **FR-100:** Cached upcoming events must remain viewable during provider outages.

### 7.12 New Releases eligibility engine

- **FR-101:** Release ingestion must record an idempotent canonical release event.
- **FR-102:** Eligibility must compare the newly released episode with the user’s caught-up snapshot immediately before release.
- **FR-103:** An eligible newly released title must remain in New Releases for at most seven days from the first pending canonical release unless watched, removed from library, or reclassified earlier.
- **FR-103A:** For episodic series, the title must leave New Releases and move to Continue Watching as soon as either: the oldest pending eligible episode reaches seven days old, or two unwatched canonical episodes have accumulated—whichever happens first.
- **FR-103B:** For movies, an unwatched newly released movie must leave New Releases after seven days and move to Haven’t Started.
- **FR-103C:** A series title moved to Continue Watching must retain every unwatched episode in its backlog.
- **FR-103D:** Moving a title out of New Releases must not mark anything watched, change intent, remove library membership, or delete release history.
- **FR-103E:** Later episode releases must not return a title from Continue Watching to New Releases until the user catches up again and a subsequent canonical episode releases.
- **FR-104:** Mapping corrections must recompute eligibility without sending duplicate events.
- **FR-105:** The v1 engine must expose a feed/query API even though push/email/in-app notification delivery is deferred.

### 7.13 Activity history

- **FR-106:** The system must record user tracking actions needed to present activity history.
- **FR-106A:** Each user-confirmed tracking mutation must carry one operation/batch ID so activity can distinguish separate actions from one bulk action.
- **FR-107:** A single-episode mark must create one episode-watched activity event. Twelve episodes marked independently across twelve actions must create twelve events.
- **FR-107A:** A bulk action that marks multiple episodes in one confirmation must create one summarized event containing the affected count and scope, e.g. `watched 12 episodes in Season 1`; it must not emit twelve public activity cards.
- **FR-107B:** If a mutation causes a season to become fully watched, Kureha must create or include a season-completed activity milestone. For a bulk action, this milestone may be included in the same summarized event; for a single episode completing the season, it is recorded with that episode action.
- **FR-107C:** Activity must distinguish episode watched, bulk episodes watched, season completed, group caught up, group finished, and user-facing intent actions where applicable.
- **FR-107D:** Activity aggregation must follow the original user action boundary, not retroactively merge separate actions merely because they occurred close together.
- **FR-108:** Activity presentation must obey profile visibility.
- **FR-109:** Playback-position updates must not appear in public/friend activity.
- **FR-110:** Removing from library must not fabricate an “unwatched” event.

### 7.14 External playback position

- **FR-111:** An authenticated integration endpoint must accept Kureha media/episode ID, position seconds, duration seconds, and observed timestamp.
- **FR-112:** The endpoint must reject negative positions, non-positive durations, and positions materially beyond duration.
- **FR-113:** The latest valid update by observed timestamp must win.
- **FR-114:** Playback position must be stored separately from watched history.
- **FR-115:** Playback position must not automatically mark an episode watched in v1.
- **FR-116:** Playback-position reads must be owner-only.

### 7.15 Provider resilience and refresh

- **FR-117:** Metadata and schedule refresh must run through idempotent background jobs.
- **FR-117A:** Refresh cadence must be adaptive and centrally throttled: actively airing anime and the next 14 days of schedule events every 15 minutes; announced/upcoming installments every 6 hours; between-seasons and future-unknown groups daily; recently finished installments weekly for 90 days; long-finished stable titles every 30 days or on demand.
- **FR-117B:** TMDB metadata must refresh daily for airing/returning series, weekly for recently ended titles, every 30 days for long-finished titles, and on demand for cache misses or user-requested refresh.
- **FR-117C:** Provider requests must be batched/deduplicated where possible and globally budgeted below documented limits: AniList 90 requests/minute with burst handling, AnimeSchedule 120 requests/minute per IP/app, and TMDB conservatively below approximately 40 requests/second with `429` backoff.
- **FR-118:** Finished titles may use longer cache durations than currently airing titles.
- **FR-119:** Provider failures must retain last-known-good normalized metadata.
- **FR-120:** Existing-library tracking mutations must not require a live provider response.
- **FR-121:** Ani.zip enrichment must support timeout, retry, schema validation, disk/database cache, and graceful fallback.
- **FR-122:** Provider refresh failures must be observable without exposing secrets.
- **FR-122A:** Fanart.tv logo enrichment must run server-side with timeout, retry, schema validation, adaptive caching, documented rate-limit/backoff handling, and graceful fallback. API keys must never enter client bundles or logs.

---

## 8. Non-functional requirements

- **NFR-001 (Performance):** p95 authenticated application reads must complete under 500 ms under the initial target load, excluding live third-party provider latency.
- **NFR-002 (Performance):** p95 tracking mutations must complete under 750 ms under the initial target load.
- **NFR-003 (Scale):** Validate v1 at 10,000 registered users and at least 100 concurrently active users without architectural replacement. This is a minimum load-test target, not a hard user or concurrency cap.
- **NFR-004 (Availability):** After production launch, Kureha targets 99.5% monthly application availability excluding declared maintenance.
- **NFR-005 (Provider degradation):** Provider outages must not block existing-library reads or tracking mutations.
- **NFR-006 (Accessibility):** User-facing v1 surfaces must target WCAG 2.2 AA.
- **NFR-007 (Responsive):** Core workflows must support current desktop and mobile viewport sizes without feature loss.
- **NFR-008 (Browser support):** Support the latest stable Chrome, Firefox, Edge, and Safari, plus current Chrome Android and Safari iOS.
- **NFR-009 (Authorization):** Every user-scoped read and write must be authorized server-side; UI hiding is insufficient.
- **NFR-010 (Database security):** Supabase/Postgres RLS or equivalent server-enforced policy must protect user-scoped tables.
- **NFR-011 (Privacy):** Playback positions must be owner-only regardless of profile visibility.
- **NFR-012 (Data deletion):** Approved account deletion must complete within 24 hours.
- **NFR-013 (Data integrity):** Episode marking, bulk marking, auto-library creation, and release-event ingestion must be transaction-safe and idempotent.
- **NFR-014 (Identity stability):** Provider remapping must not change stable Kureha watched-history identifiers.
- **NFR-015 (Observability):** Authentication failures, provider refresh failures, job failures, and mutation errors must produce structured logs without secrets or sensitive payloads.
- **NFR-016 (Testing):** Default unit tests must run without network, Docker, or credentials.
- **NFR-017 (Testing):** PGlite tests must cover deterministic schema/repository behavior.
- **NFR-018 (Testing):** Real-Postgres tests must be opt-in and refuse to run without a dedicated `TEST_DATABASE_URL` safety check.
- **NFR-019 (Quality gate):** Typecheck, unit tests, database tests, and production build must pass before a feature is considered complete.
- **NFR-020 (Provider cache):** Last-known-good normalized provider data must remain available across transient provider failures.
- **NFR-021 (Timezone):** Release-event storage must preserve source timestamp/precision and render in user-local timezone.
- **NFR-022 (Uncertainty):** The system must preserve unknown or date-only release precision instead of coercing it into false exactness.
- **NFR-023 (Secrets):** Provider credentials and Supabase service secrets must remain server-only and never enter client bundles or logs.
- **NFR-024 (Rate limiting):** Authentication, username search, friend requests, and external playback writes must have abuse-resistant rate limits before production.
- **NFR-025 (Concurrency):** Concurrent episode marks must not lose rewatch updates, duplicate primary watched identity, or create duplicate release events.
- **NFR-026 (Public read abuse):** Anonymous catalogue, media-detail, and public-profile reads must be limited initially to 120 requests/minute/IP; anonymous search to 30 requests/minute/IP.
- **NFR-027 (Authenticated search abuse):** Authenticated catalogue search must be limited initially to 60 requests/minute/account and IP; username search to 20 requests/minute/account and IP.
- **NFR-028 (Friendship abuse):** Friend-request creation must be limited initially to 5/minute and 20/day/account, with at most 100 pending outgoing requests. Accept, decline, cancel, and remove operations may use a 60/hour/account limit.
- **NFR-029 (Mutation abuse):** Tracking and library mutations must be limited initially to 120/minute/account; bulk endpoints count as one request but enforce bounded payload sizes.
- **NFR-030 (Playback-write abuse):** External playback-position writes must be limited initially to 30/minute/integration and account, with repeated writes coalesced by media/episode and latest timestamp.
- **NFR-031 (Adaptive limits):** Limits are configurable launch defaults, not product caps; repeated abuse may trigger stricter temporary limits, while normal users receive clear retry information.

---

## 9. Acceptance criteria

### Authentication and privacy

- **AC-001 (US-01):** Given a logged-out visitor, when Google OAuth succeeds, then Kureha creates or resumes exactly one account and profile.
- **AC-001A:** Given a logged-out visitor, when they browse catalogue search, media details, or a public profile, then read access works; when they attempt any state-changing action, then Kureha requires Google sign-in.
- **AC-002 (US-02):** Given a new account, when another user requests its profile, then profile/library/activity content is denied because visibility defaults to private.
- **AC-003 (US-03):** Given a profile set to friends-only, when an accepted friend requests it, then permitted profile/library/activity data is returned; when a non-friend requests it, then it is denied.
- **AC-004 (US-03):** Given a public profile, when a viewer requests it, then permitted profile/library/activity data is visible but playback position is absent.
- **AC-005 (US-04):** Given an authenticated owner who confirms account deletion, when deletion completes, then their profile, social links, tracking, activity, and playback positions are removed within 24 hours while shared media metadata remains.

### Search and identity

- **AC-005A:** Given a proposed handle, when it contains uppercase letters, unsupported symbols, consecutive periods, unsafe content, a reserved system name, or conflicts case-insensitively, then it is rejected. Given a valid 2–32 character lowercase handle, then it may be saved.
- **AC-005B:** Given a 1–32 character SFW display name containing spaces, capitalization, emoji, or special characters, when saved, then it is accepted without requiring uniqueness.

- **AC-006 (US-05):** Given AniList and TMDB return the same anime with a verified TMDB mapping, when results are merged, then one Kureha anime result is shown and the duplicate TMDB result is suppressed.
- **AC-007 (US-05):** Given a Japanese live-action title with no positive AniList mapping, when results are merged, then the TMDB result remains visible.
- **AC-008 (US-05):** Given an existing provider mapping, when a user selects that result, then the existing Kureha group opens rather than a duplicate being created.

### Library lifecycle

- **AC-009 (US-06):** Given an untracked episode, when the user marks it watched, then group tracking and library membership are created transactionally and the episode is watched.
- **AC-010 (US-07):** Given a tracked title with progress, when the user removes it from library, then it disappears from library/profile surfaces while watched history remains retrievable by the owner.
- **AC-011 (US-08):** Given a tracked title with progress, when the user confirms destructive delete, then intent, library membership, watched events, and playback positions for that group are removed.
- **AC-012 (US-09):** Given a title in Watch Later, when the user uses the applicable Start Watching or Resume Watching action, then its internal intent becomes active, progress remains unchanged, and the title becomes eligible for Continue Watching. No generic Active button is shown.

### New Releases and Continue Watching

- **AC-013 (US-10):** Given a user was caught up before episode N released, when episode N releases, then the series appears in New Releases until watched, the oldest pending episode reaches seven days, or a second unwatched canonical episode accumulates—whichever happens first.
- **AC-013A (US-10A):** Given a title was added to the library while unreleased and still has zero progress, when its first canonical episode or movie release becomes available, then it appears in New Releases rather than Haven’t Started.
- **AC-014 (US-10):** Given the same release event is ingested twice, when feeds are queried, then exactly one New Releases entry exists.
- **AC-014A (US-10):** Given a series has one pending New Releases episode, when that episode reaches seven days unwatched, then the series leaves New Releases and appears in Continue Watching.
- **AC-014B (US-10):** Given a series has one unwatched episode in New Releases, when a second canonical episode releases before the seven-day limit, then the series immediately leaves New Releases and appears in Continue Watching with both episodes unwatched.
- **AC-014C (US-10A):** Given an in-library movie first appears in New Releases on release, when it remains unwatched for seven days, then it leaves New Releases and appears in Haven’t Started.
- **AC-014D:** Given a title moves out of New Releases by age or accumulation, then watched state, intent, library membership, and release history remain unchanged.
- **AC-015 (US-11):** Given a user already has an older unwatched canonical episode, when a newer episode releases, then the group does not enter New Releases and remains in Continue Watching/backlog.
- **AC-016 (US-11):** Given multiple Continue Watching groups, when Home loads, then they are ordered by latest relevant tracking activity descending.
- **AC-017 (US-12):** Given an episode in New Releases or Continue Watching, when the user marks it watched, then the mutation succeeds without leaving Home and progress updates consistently.

### Haven’t Started and Watch Later

- **AC-018 (US-13):** Given an in-library released group with zero watched canonical episodes that was not carried forward from an unreleased state with a pending first-release New Releases entry, when Home loads, then it appears in Haven’t Started and shows no Start Watching/Resume Watching primary button.
- **AC-019 (US-13):** Given an unreleased library group, when Home loads, then it does not appear in Haven’t Started and its future events may appear in Upcoming.
- **AC-020 (US-14):** Given a zero-progress group with Watch Later intent, when Home loads, then it is displayed in the Watch Later collection by Home priority while its computed progress remains Haven’t Started.
- **AC-020A (US-14A):** Given a paused, dropped, or Watch Later group with existing progress, when the user selects Resume Watching, then intent changes to active, no additional episode is marked, recency updates, and the group appears in Continue Watching when released episodes are available.
- **AC-020B (US-14B):** Given a released zero-progress Watch Later title, when the user selects Start Watching, then intent changes to active, no episode is marked, recency updates, and the group moves to Continue Watching.
- **AC-020C:** Given an in-library zero-progress title, when state is evaluated, then it may simultaneously be Haven’t Started by progress and Watch Later by intent; library membership must not be treated as either status. Start Watching is shown only in the Watch Later presentation.

### Upcoming calendar

- **AC-021 (US-15):** Given a library contains an unreleased title and an airing title, when Upcoming loads, then future premiere and episode events for both appear chronologically.
- **AC-022 (US-16):** Given events across several dates and media types, when the user selects a week range and anime filter, then only matching events are shown.
- **AC-023 (US-17):** Given a provider event with an exact timestamp, when displayed, then it is converted to the user’s timezone.
- **AC-024 (US-17):** Given a provider supplies only a date, when displayed, then the event is labelled date-only/uncertain and no arbitrary time is shown.
- **AC-025 (US-15):** Given the provider is unavailable but cached events exist, when Upcoming loads, then cached events remain visible with freshness information.

### Tracking semantics

- **AC-026 (US-18):** Given any unwatched canonical or extra episode, when the user chooses `This episode only`, then only that episode becomes watched and every earlier gap remains unchanged.
- **AC-026A (US-18):** Given episodes 1–9 include unwatched gaps, when episode 10 is marked `This episode only`, then episode 10 is watched and none of episodes 1–9 are implicitly changed.
- **AC-026B (US-18A):** Given any canonical episode after the first, when the user attempts to mark it watched, then a confirmation prompt appears every time before mutation, including when all earlier episodes are already watched.
- **AC-026C (US-18A):** Given the prompt opens, then `Mark earlier episodes` is selected by default, `Current season` is the default bulk scope, and the user must explicitly confirm or choose `This episode only`.
- **AC-026D (US-18A):** Given the user confirms `Mark earlier episodes · Current season`, then only released canonical episodes through N in N’s season are marked and earlier seasons/extras remain unchanged.
- **AC-026E (US-18A):** Given the user confirms `Mark earlier episodes · All seasons`, then released canonical episodes through N across accepted mainline seasons are marked while later episodes and extras remain unchanged.
- **AC-026F (US-18A):** Given the user chooses `This episode only`, then only N is marked and all earlier gaps remain unchanged.
- **AC-027 (US-18):** Given a watched episode with no later watched canonical episodes, when it is unmarked, then only that episode’s watched state is removed and progress recomputes.
- **AC-027A (US-18):** Given a watched canonical episode with later watched canonical episodes, when the user attempts to unmark it, then a confirmation prompt appears before mutation.
- **AC-027B (US-18):** Given the unwatch prompt opens, then `This episode only` is selected by default and the user may instead choose `This and later episodes` with `Current season` or `All seasons` scope.
- **AC-027C (US-18):** Given `This episode only` is confirmed, then later watched episodes remain watched.
- **AC-027D (US-18):** Given `This and later episodes · Current season` is confirmed, then the selected episode and later canonical episodes in that season are unmarked while other seasons and extras remain unchanged.
- **AC-027E (US-18):** Given `This and later episodes · All seasons` is confirmed, then the selected episode and later canonical episodes across subsequent accepted mainline seasons are unmarked while earlier episodes and extras remain unchanged.
- **AC-027F (US-18):** Given an affected watched episode has a rewatch count above 1, when the unwatch confirmation opens, then it offers `Unmark once` (default) and `Unmark completely`.
- **AC-027G (US-18):** Given `Unmark once` is confirmed, each affected row is decremented by one; given `Unmark completely` is confirmed, each affected row is deleted regardless of count.
- **AC-028 (US-19):** Given a season containing released canonical episodes and gaps elsewhere, when the user confirms the current-season bulk action, then only that season’s released canonical episodes are watched transactionally.
- **AC-028A (US-19):** Given a group has multiple seasons, when bulk scope is offered, then current season and all seasons are separate explicit choices; neither is silently selected from the other.
- **AC-029 (US-20):** Given an ongoing group with earlier gaps, when its latest known released canonical episode is watched, then progress derives caught up and the earlier gaps remain unwatched.
- **AC-030 (US-20):** Given an ended group with earlier gaps, when its final canonical episode is watched, then progress derives finished and the earlier gaps remain unwatched.
- **AC-031 (US-21):** Given the latest/final canonical episode is watched but an extra OVA is unwatched, when progress is derived, then the group remains caught up or finished.
- **AC-032 (US-22):** Given an airing installment with unknown lifetime total and latest known released episode 12 watched while only five episodes are actually marked watched, when progress is shown, then it derives caught up and distinguishes `5 watched` from `through episode 12 / ?`.

### Group release state

- **AC-032A:** Given AniList marks the current installment finished and an accepted sequel is `NOT_YET_RELEASED`, when state is derived, then the group is `between_seasons`, not `ended`.
- **AC-032B:** Given AniList marks the current installment finished and no source confirms a sequel or franchise end, when state is derived, then the group is `future_unknown`.
- **AC-032C:** Given AniList has a current `nextAiringEpisode`, when state is derived, then the group is `airing`.
- **AC-032D:** Given AniList lacks usable schedule evidence but a mapped centralized anime schedule source reports ongoing, when state is derived, then the group may be `airing` with fallback evidence recorded.
- **AC-032E:** Given providers conflict about continuation/end, when state is derived, then the group is `future_unknown` and a review condition is recorded.
- **AC-032F:** Given the latest known canonical episode is watched and group state is `between_seasons` or `future_unknown`, when progress is derived, then it is caught up, not finished.
- **AC-032G:** Given the final known episode is watched but no reliable whole-group `ended` evidence exists, when progress is derived, then it must not be finished.

### Anime grouping and relations

- **AC-033 (US-23):** Given an uninterrupted, high-confidence AniList sequel chain, when grouping runs, then its installments attach to one Kureha group in release order.
- **AC-034 (US-23):** Given a relation path leaves the accepted prequel/sequel chain through a character, alternative, or other edge, when grouping runs, then descendants of that off-mainline edge cannot enter the mainline.
- **AC-035 (US-24):** Given a franchise with competing alternative continuities, when grouping runs, then alternatives are separate tracks or review candidates—not consecutive mainline seasons.
- **AC-036 (US-25):** Given a media installment with direct AniList relations, when Details opens, then relation cards show relation labels and open the related media/group.
- **AC-037 (US-25):** Given a user navigates through several relation cards, when they use Back, then prior relation/detail states are restored.
- **AC-038 (US-26):** Given a library group and a newly published high-confidence sequel, when metadata refresh runs, then the sequel automatically attaches to the group without changing user intent.
- **AC-039 (US-26):** Given the attached sequel has a future premiere, when Upcoming loads, then its release events appear automatically.
- **AC-040 (US-26):** Given the user was caught up before the sequel’s first episode released, when it releases, then it appears in New Releases.
- **AC-041 (US-27):** Given a newly discovered ambiguous branch, when refresh runs, then it remains reviewable in Relations and does not affect completion.
- **AC-042 (US-28):** Given an approved regrouping with matched episode mappings, when the new mapping version activates, then watched events remain attached to the same stable Kureha episode IDs.
- **AC-043 (US-28):** Given a regrouping contains unmatched historical episodes, when preview is generated, then activation is blocked or explicitly reports unresolved records; no history is silently discarded.

### Community

- **AC-044 (US-29):** Given a valid username query, when search runs, then only permitted basic profile discovery fields are returned.
- **AC-045 (US-30):** Given no relationship, when A requests B and B accepts, then one mutual friendship exists and duplicate requests are prevented.
- **AC-046 (US-30):** Given an accepted friendship, when either user removes it, then friends-only access ends for both.
- **AC-047 (US-31):** Given profile visibility changes from public to private, when a non-owner requests it afterward, then access is denied immediately.
- **AC-048 (US-32):** Given public or friends-only visibility, when profile/activity APIs respond, then no playback position, duration, or position timestamp appears.

- **AC-048A:** Given twelve episodes are marked in one confirmed bulk operation, when activity is displayed, then one summarized `watched 12 episodes` event appears rather than twelve episode cards.
- **AC-048B:** Given twelve episodes are marked through twelve separate actions, when activity is displayed, then twelve individual episode events remain.
- **AC-048C:** Given either a single mark or bulk operation completes a season, when activity is recorded, then the same operation also records/includes a season-completed milestone without duplicating the episode marks as separate bulk cards.

### External playback position

- **AC-049 (US-33):** Given a valid authenticated integration request, when position 600 of duration 1440 is submitted with a newer timestamp, then it becomes the owner’s current private position.
- **AC-050 (US-33):** Given an older update arrives after a newer update, when processed, then the newer stored position remains.
- **AC-051 (US-33):** Given a negative position, zero duration, or unauthorized media, when submitted, then the request is rejected without changing state.
- **AC-052 (US-33):** Given position reaches the end, when submitted, then Kureha stores position but does not automatically mark watched in v1.

### Reliability and tests

- **AC-053 (US-34):** Given AniList, TMDB, or Ani.zip is unavailable, when a user marks an existing mapped episode watched, then the mutation succeeds using stored Kureha identity.
- **AC-054 (US-34):** Given Ani.zip enrichment is missing for an OVA, when Details opens, then the title remains trackable with available AniList/Kureha metadata.
- **AC-055 (US-34):** Given a fresh checkout without provider credentials, when the default unit suite runs, then it passes without network access.
- **AC-056 (US-34):** Given no `TEST_DATABASE_URL`, when real-Postgres tests are requested, then they skip or fail safely before connecting.

### Artwork and per-profile presentation

- **AC-056A:** Given a positively mapped title with eligible Fanart.tv transparent logos, when default title art is selected for a viewer, then the viewer's configured language is preferred, followed by English and language-neutral candidates, with the highest-ranked candidate selected within the first available tier.
- **AC-056B:** Given no valid Fanart.tv mapping, no eligible logo, timeout, quota exhaustion, or a malformed Fanart.tv response, when title details render, then Kureha shows a text title and search, import, library, and tracking operations remain available.
- **AC-056C:** Given Fanart.tv also returns posters or backgrounds, when its payload is normalized, then only eligible transparent title-logo candidates enter Kureha's v1 Fanart artwork catalogue.
- **AC-056D:** Given an authenticated user selects known-provider title-logo, cover, and backdrop candidates, when that user or an authorized viewer opens the user's profile/library presentation, then all three selected assets render independently.
- **AC-056E:** Given a user chooses artwork for one group, when another user views the same canonical group outside that profile context, then the second user's own preference or Kureha's default is used; canonical artwork metadata is not overwritten.
- **AC-056F:** Given a user's selected asset is removed or becomes ineligible, when the profile/library renders, then Kureha uses the current default eligible asset without deleting the stored preference reference.
- **AC-056G:** Given an unauthenticated user or unauthorized account requests a private or friends-only profile's artwork preferences, when authorization is evaluated, then no preference record or selected provider-asset identifier is returned.
- **AC-056H:** Given a production client build, when artifacts are inspected, then no Fanart.tv, TMDB, or other server-side provider API secret is present.

---

## 10. Data and event semantics

### 10.1 Required conceptual entities

The architecture phase must define typed contracts for at least:

- User/Profile
- FriendshipRequest/Friendship
- MediaGroup
- ContinuityTrack
- MediaInstallment
- Episode
- MediaRelation
- ProviderMapping
- MappingVersion/MappingReview
- UserLibraryEntry
- WatchedEpisode/WatchedMovie
- UserIntent
- PlaybackPosition
- ReleaseEvent
- NewEpisodeEligibility
- ActivityEvent

### 10.2 Release precision

Every release event must retain:

- source provider;
- source identifier;
- Kureha episode/installment identifier;
- timestamp when exact;
- date when only date is known;
- precision/uncertainty indicator;
- fetched/updated timestamp;
- mapping version.

### 10.3 Activity versus internal audit

User-visible activity and internal audit logs are distinct. Internal mapping/provider audit records must not automatically appear as social activity.

---

## 11. Testing strategy and quality gates

### 11.1 Unit layer

Must cover:

- progress derivation;
- intent transitions;
- Home row predicates and priority;
- New Releases eligibility snapshots;
- release-event deduplication;
- anime relation path provenance;
- branch/extras classification;
- provider normalization;
- visibility authorization policies;
- playback-position validation and last-write ordering.

### 11.2 PGlite layer

Must cover:

- schema constraints;
- repository operations;
- transactional episode/season/show marks;
- auto-library creation;
- removal versus deletion;
- release-event upsert behavior;
- mapping version activation;
- friendship uniqueness and self-friend rejection;
- privacy query enforcement where compatible.

### 11.3 Real Postgres layer

Must cover only behavior requiring real Postgres/Supabase semantics:

- concurrent upserts and rewatch increments;
- transaction isolation;
- RLS policies;
- deferred/advanced constraints if used;
- concurrent release ingestion;
- account deletion cascades.

### 11.4 Phase exit gates

No implementation phase is complete until:

1. requirements and acceptance criteria are linked to tests;
2. unit tests pass;
3. applicable PGlite tests pass;
4. applicable real-Postgres tests pass or are explicitly documented as not required;
5. typecheck passes;
6. production build passes;
7. a fresh-context review finds no blocking issue.

---

## 12. Dependencies and constraints

### Product stack direction

- TanStack Start and React for the web application.
- Drizzle ORM for persistence mapping.
- Supabase Postgres and Google OAuth unless architecture review finds a concrete blocker.
- AniList for anime metadata and relations.
- TMDB for movies and non-anime television.
- Ani.zip as optional non-blocking anime enrichment.
- Fanart.tv as optional transparent title-logo enrichment only.

### External dependency constraints

- Provider schemas and rate limits may change.
- AniList relations may be missing, incorrect, or branchy.
- Ani.zip can be incomplete for OVAs and must remain optional.
- TMDB artwork and anime deduplication require verified mappings.
- Fanart.tv title-logo coverage depends on TMDB/TVDB mapping quality, community submissions, access tier, and provider availability; it must remain optional.
- The implementation must cache normalized data and preserve last-known-good records.

### Legal constraint

- Provider terms, image licenses, attribution requirements, and API usage policies for TMDB, Fanart.tv, AniList, and Ani.zip must be reviewed before production launch.

Shiru was audited for behavior under GPL-3.0. Kureha may independently implement learned concepts but must not copy Shiru source, regex tables, or implementation code unless Kureha intentionally accepts GPL obligations.

---

## 13. Assumptions and open questions

### Confirmed assumptions

- **A-01:** Kureha v1 is online-only and responsive.
- **A-02:** Google OAuth is sufficient for v1 authentication.
- **A-03:** Profile and activity visibility share one profile-level setting in v1.
- **A-04:** Playback position is always private.
- **A-05:** High-confidence new anime seasons auto-attach to existing groups.
- **A-06:** Ambiguous branches require review.
- **A-07:** Notification delivery is deferred; eligibility/feed logic remains in scope.
- **A-08:** Ani.zip is optional enrichment, not canonical identity.
- **A-09:** Public catalogue, search, media details, and public profiles are browsable without login; authentication is required to mutate state.
- **A-10:** Primary Supabase/Postgres data residency is India using AWS `ap-south-1` (Mumbai), the current Supabase India region. Hyderabad is not currently a Supabase primary project region.
- **A-11:** Usernames and display names are separate and follow FR-005 through FR-005C.
- **A-12:** Rewatch behavior is defined: explicitly marking an already watched episode increments its per-episode rewatch count while preserving the first `watched_at`; season rewatch increments already watched episodes and creates first-watch records for previously skipped episodes.

### Deferred architecture/UX details—not blockers to PRD approval

- **OQ-03:** Exact retention period for internal security/audit logs after account deletion.
- **OQ-04:** Mapping-review UI means an owner/admin preview for ambiguous provider regrouping: show proposed installment/episode moves, matched history, and unmatched history before accepting a mapping version. Exact screen design is deferred.
- **OQ-05:** Community-created watch-order schemes and custom lists are explicitly deferred to the post-v1 roadmap.

### Locked activity-event behavior

- **AE-01:** One user-confirmed bulk operation produces one summarized activity event, e.g. `watched 12 episodes in Season 1`.
- **AE-02:** Twelve separately confirmed episode marks produce twelve separate events.
- **AE-03:** Completing a full season produces a season-completed milestone within the same user operation.

### Locked operational defaults subject to measurement

- **OD-01:** Provider refresh cadence follows FR-117A through FR-117C and may be tuned from observed rate limits/freshness without changing product behavior.
- **OD-02:** Abuse limits follow NFR-026 through NFR-031 and are configurable launch defaults, not account limits.

### Blockers before production—not blockers before architecture

- **PB-01:** Confirm the selected Supabase project is actually provisioned in Mumbai (`ap-south-1`) before production data is created.
- **PB-02:** Define production backup, restore, and rollback targets.
- **PB-03:** Define moderation/contact path for public profiles and usernames.
- **PB-04:** Define privacy policy, terms, and account-deletion disclosure.

---

## 14. Approval and change control

### Approval gate

This PRD becomes **Approved** only after the owner explicitly confirms:

1. product scope and non-goals;
2. Home row predicates;
3. anime metadata hierarchy;
4. privacy/community behavior;
5. acceptance criteria;
6. unresolved questions that may be deferred to architecture/UX.

### Change control

After approval:

- behavior changes require a PRD revision;
- architecture must trace contracts to `FR-*` requirements;
- tests must trace to `AC-*` criteria;
- implementation agents may not silently reinterpret requirements;
- conflicting older Kureha documents are superseded by this PRD once approved.
