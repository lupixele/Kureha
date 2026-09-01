# M3 Architecture Contract — Metadata Providers, Canonical Ingestion, and Artwork

**Status:** Approved by owner — 2026-09-01
**Draft date:** 2026-09-01
**Approval date:** 2026-09-01
**Depends on:** PRD-001 v1.2, closed M1 checkpoint `e979965`, closed M2 checkpoint `5fc22a2`
**Requirements:** `FR-026`–`FR-057`, `FR-078A`–`FR-078J`, `FR-117`–`FR-122A`, `NFR-005`, `NFR-013`–`NFR-017`, `NFR-021`–`NFR-024`, `AC-001A`, `AC-032A`–`AC-043`, `AC-053`–`AC-056H`

## 1. Simple explanation

M1 gave Kureha permanent IDs. M2 made library and watched history use those IDs. M3 safely creates and refreshes those permanent catalogue records from external metadata providers.

Searching does **not** fill Kureha's database with every result. Search results are temporary provider previews. A signed-in user's details/import or library action creates canonical Kureha records only when needed.

```text
Public search
  ├─ AniList result (anime preview)
  └─ TMDB result (movie/TV preview)
          │
          ▼ signed-in import/add
Provider clients → validated normalized DTOs → conservative graph resolver
          │
          ▼ one locked transaction
Kureha group → track → installment → episodes → mappings/evidence/artwork
```

After creation, Kureha tracking never depends on a live provider response. Provider renames, outages, or remaps cannot replace stable Kureha IDs or silently move watched history.

Fanart.tv is used only for transparent styled title-logo artwork. Covers and backdrops remain AniList/TMDB assets. A user may choose their preferred known-provider logo, cover, and backdrop for each group; those choices are visible as part of that user's permitted profile/library presentation without changing the canonical defaults for anyone else.

## 2. Locked owner decisions

1. Public unified provider search is allowed without login.
2. Anonymous users may open a live/cached provider preview, but creating durable canonical rows requires authentication.
3. Canonical creation happens when a signed-in user opens/imports a new provider result or adds it to the library; search alone never persists a full title.
4. Repeated and concurrent imports of the same provider identity return one existing Kureha group rather than creating duplicates.
5. AniList is authoritative for anime identity, installment relations, status, and future airing schedule.
6. TMDB is authoritative for movies and non-anime television.
7. Ani.zip is optional, non-blocking enrichment only; it never defines Kureha identity or watched progress.
8. M3 integrates AniList and TMDB schedules only. No AnimeSchedule client is added in M3.
9. Provider payloads are normalized behind typed, runtime-validated adapters before entering domain or persistence code.
10. Kureha stores normalized fields, provenance, and payload/content hashes; it does not retain complete raw provider payloads.
11. Anime grouping is conservative. Only proven, uninterrupted `PREQUEL`/`SEQUEL` chains auto-group.
12. Ambiguous branches stay separate and create an admin/maintainer review item.
13. Review resolution is restricted to admins/maintainers in v1; community voting is out of scope.
14. Opening/importing an anime imports the selected installment and its proven linear prequel/sequel chain. Other direct anime relations are stored as unresolved relation edges/previews, not recursively imported.
15. Ambiguous TMDB television results remain visible as `uncertain_anime` and cannot be canonically imported as general TV until a positive mapping or maintainer review resolves them.
16. A TMDB duplicate is suppressed only when a positive stored cross-provider mapping connects it to an AniList result in the same response.
17. Similar names, origin country, language, year, genre, animation genre, or keywords never prove identity and never suppress a result.
18. AniList episode count/schedule creates numbered canonical episode stubs. Ani.zip may later enrich titles, images, runtimes, dates, and cross-IDs without replacing episode UUIDs.
19. A standalone AniList anime movie becomes a movie group and uses movie tracking. A movie proven to be part of an anime franchise becomes an installment in that anime group; it gets one canonical installment episode for group traversal/tracking.
20. Interactive search/import has priority over background refresh. Background workers pause/back off when provider capacity is constrained.
21. Refresh jobs use a Postgres-backed queue and a separate lightweight worker process; no Redis dependency and no web-server timer loop.
22. Provider image paths/URLs are stored with source attribution; Kureha does not download provider artwork to Supabase Storage in v1.
23. Fanart.tv supplies transparent title-logo candidates only. Kureha deliberately ignores Fanart.tv posters/backgrounds even if its API returns them.
24. Fanart.tv lookup requires a positive stored identifier mapping: TMDB ID for movies and TVDB ID for TV/anime television. AniList title similarity is never enough.
25. The default logo preference order is viewer language, then English, then language-neutral, with highest provider votes/rank inside the first available tier.
26. Users may independently select known-provider title-logo, cover, and backdrop candidates for each group.
27. A user's chosen artwork is visible to people authorized to view that user's profile/library. It does not alter global canonical defaults or another user's view outside that profile context.
28. v1 artwork choices are limited to normalized known-provider assets. Custom URLs and uploads are future scope.
29. M3 includes idempotent adaptive refresh jobs and cadence policy, not merely interfaces.
30. Unified search returns whichever provider succeeds and marks the response partial if the other provider fails.

## 3. Scope

### 3.1 In scope

- Server-only AniList GraphQL client.
- Server-only TMDB v3 REST client.
- Server-only Ani.zip enrichment client.
- Server-only Fanart.tv transparent-logo client.
- Typed normalized provider DTOs and runtime validation.
- Public unified search and provider-preview server functions.
- Authenticated canonical import/details-persistence server function.
- Conservative anime relation graph traversal and review queue.
- Atomic, idempotent canonical group/track/installment/episode ingestion.
- Positive-mapping-only search deduplication.
- Release evidence and group release-state derivation.
- Normalized artwork catalogue and per-profile artwork preferences.
- Postgres-backed refresh queue, separate worker, adaptive cadence, retry/backoff, and observability.
- Deterministic fixture tests and PGlite migration/repository tests.

### 3.2 Explicit non-goals

- Search/details/calendar/home React UI implementation beyond typed server boundaries.
- Community-created watch orders.
- Community mapping votes.
- User-uploaded artwork or arbitrary artwork URLs.
- Downloading/proxying provider images.
- Fanart.tv posters or backgrounds.
- AnimeSchedule integration.
- Redis, BullMQ, Kafka, or another external queue.
- Live provider calls in default automated tests.
- Changing M2 watched-history IDs or semantics.

## 4. Provider authority and degradation matrix

| Provider | M3 role | Canonical authority | Authentication | Failure behavior |
|---|---|---|---|---|
| AniList | Anime search, installment metadata, relations, status, future schedule, anime cover/backdrop | Anime structure and schedule | Public reads, no user OAuth required | Use last-known-good canonical data; partial search if TMDB succeeds |
| TMDB | Movie/non-anime TV search and metadata; mapped anime cover/backdrop candidates | Movies and non-anime TV | Server-side API bearer/key | Use last-known-good data; partial search if AniList succeeds |
| Ani.zip | Cross-IDs and optional episode enrichment | None | No key currently required | Timeout/failure is swallowed after observable result; never blocks import/tracking |
| Fanart.tv | Transparent styled title-logo candidates | None | Server-side project API key; optional personal key is not accepted from users in v1 | Text-title fallback; never blocks import/search/tracking |

## 5. Server-only module boundaries

```text
src/server/providers/
  transport.ts                 FetchTransport, timeout, retry, redaction
  errors.ts                    typed provider errors
  rate-budget.ts               priority budget/backoff contracts
  anilist/client.ts            GraphQL requests only
  anilist/schemas.ts           response validation
  anilist/normalize.ts         pure normalization
  tmdb/client.ts               REST requests only
  tmdb/schemas.ts
  tmdb/normalize.ts
  anizip/client.ts
  anizip/schemas.ts
  anizip/normalize.ts
  fanart/client.ts
  fanart/schemas.ts
  fanart/normalize.ts          logos only

src/server/catalogue/
  search.ts                    parallel public search + positive dedupe
  preview.ts                   non-persistent public provider preview
  import.ts                    authenticated canonical import orchestration
  anime-graph.ts               bounded pure graph classification
  persistence.ts               locked transactional repository
  release-state.ts             pure evidence resolver
  artwork.ts                   default and per-profile selection
  review.ts                    maintainer-only review operations

src/server/jobs/
  metadata-queue.ts            enqueue/claim/complete/fail operations
  refresh-worker.ts            separately launched worker
  cadence.ts                   pure adaptive schedule selection
```

No provider module may be imported by a client route or client component. All secrets are parsed from server environment variables and redacted from errors/logs.

## 6. Typed contracts

### 6.1 Provider identity

```ts
type CanonicalProvider = 'anilist' | 'tmdb';
type EnrichmentProvider = 'anizip' | 'fanart';
type SearchMediaKind = 'anime' | 'movie' | 'series' | 'uncertain_anime';

type ProviderRef = {
  provider: CanonicalProvider | 'tvdb' | 'mal' | 'anidb';
  providerId: string;
  target: 'anime' | 'movie' | 'tv' | 'episode';
};
```

Provider IDs are preserved as exact strings at boundaries. Numeric provider IDs are validated as positive base-10 integers before requests but stored in canonical mapping records as text.

### 6.2 Unified search

```ts
type UnifiedSearchItem = {
  source: 'anilist' | 'tmdb';
  providerId: string;
  mediaKind: SearchMediaKind;
  title: string;
  alternateTitle: string | null;
  releaseYear: number | null;
  format: string | null;
  coverUrl: string | null;
  existingMediaGroupId: string | null;
  importAllowed: boolean;
  importBlockReason: 'uncertain_anime' | null;
};

type UnifiedSearchResponse = {
  query: string;
  items: UnifiedSearchItem[];
  partial: boolean;
  unavailableProviders: Array<'anilist' | 'tmdb'>;
};
```

Public search input is trimmed, normalized for transport only, and limited to 1–100 Unicode code points. It must respect the PRD anonymous search limit of 30/minute/IP. Search returns no provider secrets or raw payloads.

### 6.3 Normalized catalogue graph

```ts
type NormalizedInstallment = {
  source: 'anilist' | 'tmdb';
  providerId: string;
  title: string;
  format: string;
  status: 'not_yet_released' | 'releasing' | 'finished' | 'cancelled' | 'hiatus' | 'unknown';
  startDate: string | null;
  endDate: string | null;
  totalEpisodes: number | null;
  nextAiringEpisode: number | null;
  nextAiringTime: string | null;
  payloadHash: string;
};

type NormalizedRelation = {
  sourceProviderId: string;
  targetProviderId: string;
  relationType:
    | 'PREQUEL' | 'SEQUEL' | 'PARENT' | 'SIDE_STORY'
    | 'CHARACTER' | 'SUMMARY' | 'ALTERNATIVE' | 'SPIN_OFF'
    | 'ADAPTATION' | 'SOURCE' | 'COMPILATION' | 'CONTAINS'
    | 'SAME_UNIVERSE' | 'OTHER';
  targetFormat: string | null;
  targetIsAdult: boolean;
};

type NormalizedEpisodeSeed = {
  providerEpisodeId: string | null;
  episodeNumber: number;
  title: string | null;
  airDate: string | null;
  airTimeUtc: string | null;
  runtimeMinutes: number | null;
  imageUrl: string | null;
  isExtra: boolean;
};
```

Unknown enum values cause the affected field/edge to become `unknown`/`OTHER` with an observable schema-drift event; they do not crash unrelated search results or erase last-known-good data.

### 6.4 Artwork

```ts
type ArtworkKind = 'title_logo' | 'cover' | 'backdrop';
type ArtworkProvider = 'anilist' | 'tmdb' | 'fanart';

type NormalizedArtworkCandidate = {
  provider: ArtworkProvider;
  providerAssetId: string;
  kind: ArtworkKind;
  urlOrPath: string;
  language: string | null;
  voteScore: number | null;
  width: number | null;
  height: number | null;
  sourceMappingId: string | null;
  payloadHash: string;
};
```

Fanart normalization accepts only transparent logo fields:

- movie: `hdmovielogo`, falling back to `movielogo`;
- TV/anime television: `hdtvlogo`, falling back to `clearlogo`.

All Fanart poster/background/clear-art/disc/banner fields are ignored by design.

## 7. Database migration contract (`0003`)

### 7.1 Existing-table additions

`media_groups`:

- `canonical_title` remains the current title field; no provider may overwrite it with null.
- add `metadata_updated_at timestamptz` nullable.
- add `metadata_payload_hash text` nullable.

`installments`:

- add `metadata_updated_at timestamptz` nullable.
- add `metadata_payload_hash text` nullable.

`release_state_evidence`:

- add `payload_hash text` nullable;
- retain the legacy nullable `payload jsonb` column for additive migration compatibility, but M3 ingestion must never write complete raw provider responses to it; only narrowly normalized evidence already represented by typed columns may be stored, and new M3 writes leave `payload` null.

No existing canonical ID is regenerated. No M2 tracking table is destructively migrated.

### 7.2 `media_relations`

- `id uuid primary key default gen_random_uuid()`
- `source_installment_id uuid not null references installments(id) on delete cascade`
- `target_provider provider not null`
- `target_provider_id text not null`
- `target_installment_id uuid null references installments(id) on delete set null`
- `relation_type text not null`
- `classification text not null` in `mainline_candidate | extra | alternate | related | ignored`
- `review_state text not null` in `not_required | pending | accepted | rejected`
- `first_seen_at timestamptz not null`
- `last_seen_at timestamptz not null`
- unique `(source_installment_id, target_provider, target_provider_id, relation_type)`

Relations remain stored even when the target is only a preview and has no canonical installment yet.

### 7.3 `catalogue_review_items`

- UUID primary key.
- `media_group_id` nullable FK.
- `subject_provider`, `subject_provider_id`.
- reason enum: `ambiguous_branch | uncertain_anime | mapping_conflict | provider_conflict | unmatched_episode | schema_drift`.
- status: `pending | accepted | rejected | resolved`.
- normalized evidence JSON only, never a full raw response.
- `created_at`, `resolved_at`, `resolved_by` profile/auth UUID.
- one open item with a group via unique partial index on `(reason, subject_provider, subject_provider_id, media_group_id)` where `media_group_id is not null`;
- one open item without a group via unique partial index on `(reason, subject_provider, subject_provider_id)` where `media_group_id is null`.

Only maintainer-authorized server operations may resolve an item.

### 7.4 `artwork_assets`

- UUID primary key.
- `media_group_id` FK with cascade.
- optional `installment_id` FK with set null.
- provider uses a dedicated `artwork_provider` enum: `anilist | tmdb | fanart`; it does not reuse M1's canonical `provider` enum.
- kind: `title_logo | cover | backdrop`.
- provider asset ID, path/URL, language, vote score, width, height.
- source mapping FK nullable.
- payload hash, first/last seen, last successful refresh, `is_available`.
- unique `(provider, provider_asset_id, kind)`.

Eligibility constraints:

- Fanart rows must have kind `title_logo`.
- TMDB art on anime requires a positive active AniList↔TMDB mapping.
- Fanart movie art requires a positive active TMDB mapping.
- Fanart TV/anime art requires a positive active TVDB mapping.

### 7.5 `user_artwork_preferences`

- `user_id uuid not null references profiles(id) on delete cascade`.
- `media_group_id uuid not null references media_groups(id) on delete cascade`.
- `(user_id, media_group_id)` composite primary key.
- nullable `title_logo_asset_id`, `cover_asset_id`, `backdrop_asset_id` FKs using `ON DELETE SET NULL` only if the asset row is physically removed.
- timestamps.

Repository validation must confirm each selected asset belongs to the same media group and correct artwork kind. Profile/library authorization governs reads. The preferences never affect canonical metadata, progress, or another user's default view.

### 7.6 `metadata_refresh_jobs`

- UUID primary key.
- unique logical key `(provider, target_type, target_id, job_kind)`.
- provider uses a dedicated `refresh_job_provider` enum: `anilist | tmdb | anizip | fanart`; it does not reuse M1's canonical `provider` enum.
- `media_group_id uuid null references media_groups(id) on delete cascade`.
- priority: `interactive | background`.
- cadence tier: `airing_15m | upcoming_6h | daily | weekly | monthly | on_demand`.
- status: `queued | running | retry_wait | succeeded | dead`.
- `next_attempt_at`, lease owner, lease expiry, attempts, max attempts.
- sanitized error code/message, last successful completion, created/updated timestamps.
- indexes supporting `status + next_attempt_at + priority` claims.

Claims use one atomic transaction with `FOR UPDATE SKIP LOCKED` on real Postgres. PGlite tests validate logical claim/idempotency; a real-Postgres integration test validates concurrent claims.

`0003` must define exact Drizzle enums:

- `artworkProviderEnum = pgEnum('artwork_provider', ['anilist', 'tmdb', 'fanart'])`;
- `refreshJobProviderEnum = pgEnum('refresh_job_provider', ['anilist', 'tmdb', 'anizip', 'fanart'])`;
- `refreshCadenceTierEnum = pgEnum('refresh_cadence_tier', ['airing_15m', 'upcoming_6h', 'daily', 'weekly', 'monthly', 'on_demand'])`;
- `refreshJobStatusEnum = pgEnum('refresh_job_status', ['queued', 'running', 'retry_wait', 'succeeded', 'dead'])`.

### 7.7 `provider_sync_runs`

Stores sanitized observability only:

- provider, operation, target hash/ID, outcome, HTTP status nullable;
- retry count, duration, response content hash nullable;
- error class/code with secrets and query credentials removed;
- timestamps.

No API key, Authorization header, complete raw payload, or user-sensitive provider query is logged.

## 8. Unified search and deduplication

1. Start AniList and TMDB search concurrently under the interactive priority budget.
2. Validate each result independently.
3. Search local active provider mappings for existing canonical groups.
4. Load positive stored AniList↔TMDB mappings relevant to returned IDs.
5. Suppress a TMDB item only if its mapped AniList ID is present in the same result set.
6. Label likely anime TMDB TV items without a positive mapping `uncertain_anime`; keep them visible and set `importAllowed = false`.
7. Never use title/year/country/language/genre/keyword similarity as identity proof.
8. If one provider fails or is rate-limited, return the other's valid results with `partial = true` and identify the unavailable provider.
9. If both providers fail and no valid cached search response exists, return typed `PROVIDERS_UNAVAILABLE`.
10. Public search never creates `media_groups`, tracks, installments, episodes, mappings, or review records except bounded abuse/rate telemetry.

## 9. Provider preview and canonical import

### 9.1 Anonymous preview

A preview may fetch/cache a provider detail DTO but performs no canonical catalogue write. It exposes only normalized safe fields. A cached preview is not Kureha canonical identity.

### 9.2 Authenticated import

`importProviderTitle({ provider, providerId, operationId })`:

1. Authenticate and require completed profile setup.
2. Reject TMDB `uncertain_anime` until a positive mapping/review resolution exists.
3. Acquire transaction-scoped advisory locks in lexical order for every known provider identity participating in the import.
4. Recheck `provider_mappings` after locking; return the existing group if found.
5. Fetch/normalize authoritative provider data outside the write transaction when safe; carry hashes and timestamps into the transaction.
6. For anime, build the bounded relation plan described below.
7. In one transaction, create/reuse group, tracks, installments, episode stubs, provider mappings, mapping-version audit, relation edges, release evidence, artwork assets, and refresh jobs.
8. Store an idempotent operation receipt. A replay with the same request returns the same group; mismatched payload under the same operation ID conflicts.
9. Ani.zip and Fanart enrichment run after core commit as optional jobs and cannot roll back the canonical import.

If a provider request fails before a new title has any canonical record, import fails cleanly with no partial canonical rows. If refresh of an existing title fails, last-known-good normalized rows remain unchanged.

## 10. Anime graph resolver

### 10.1 Bounds and cycle safety

- Maintain a visited set keyed by exact AniList ID.
- Maximum auto-plan: 25 fetched relation nodes and depth 8 across prequel/sequel edges.
- Repeated IDs terminate traversal without error.
- Exceeding a bound imports the selected proven portion only and creates a review item.

### 10.2 Mainline rule

An edge may extend the auto-mainline only when all are true:

- relation is exactly `PREQUEL` or `SEQUEL` in the appropriate direction;
- both endpoints are anime media, not manga/characters;
- there is exactly one continuation candidate at that step;
- reciprocal/adjacent relation evidence is not contradictory;
- the candidate is not format-classified as recap, special, OVA, ONA, music, promotional, or obvious compilation;
- no active mapping places the candidate in a conflicting group;
- ordering from explicit relation and dates is deterministic.

Otherwise, keep titles separate and open a review item. Ambiguity is not resolved through title similarity.

### 10.3 Extras and other relations

- `SPECIAL`, `OVA`, `ONA`, recap, compilation, promotional media, and Season 0 default to extras.
- `ALTERNATIVE`, `SPIN_OFF`, `SIDE_STORY`, `PARENT`, `SOURCE`, `ADAPTATION`, `SAME_UNIVERSE`, and `OTHER` are stored as related edges, not auto-mainline.
- `CHARACTER` and non-anime relation targets are ignored for Details relation cards per PRD.
- A maintainer-approved review may create an alternate track or reclassify an extra through a new mapping version.

Relation classification maps to canonical tracks exactly as follows:

- `mainline_candidate` → `mainline` track only after all auto-mainline checks pass;
- `alternate` → `alternate` track only after maintainer acceptance;
- `extra` → `extras` track;
- `related` and `ignored` → relation edges only, with no track/installment created.

### 10.4 Ordering and split cours

Installment sequence is derived first from explicit prequel/sequel topology and then from start date/provider ID as deterministic tie-breakers. Split cours remain distinct installments with ascending sequence numbers. Refresh may append an unambiguous new season but never renumber existing installments destructively when that would affect stable tracking references.

### 10.5 Episode stubs

- Known finite total `N`: create episodes `1..N`.
- Releasing title with unknown total: create every known scheduled/released episode through `max(nextAiringEpisode, known enrichment episode)` without marking future episodes released.
- Newly discovered numbers are appended idempotently.
- A decrease in provider total never deletes an episode referenced by tracking. It creates a review item if reconciliation is unsafe.
- Ani.zip enrichment updates nullable descriptive fields by exact validated episode mapping; it cannot replace episode UUIDs or mainline classification.

## 11. Movie/series classification

- TMDB movie → standalone `movie` group, no episode rows.
- TMDB TV proven non-anime → `series` group with TMDB seasons/installments and episodes.
- TMDB TV likely anime without positive mapping → preview-only `uncertain_anime`, import blocked.
- Standalone AniList `MOVIE` with no proven franchise chain → `movie` group.
- AniList `MOVIE` on a proven anime continuity → installment in an `anime` group with one canonical installment episode.
- Live-action adaptations remain separate from anime groups.

## 12. Release evidence and group state

Every normalized schedule/status update records source, source ID, exact UTC timestamp or date-only value, precision, fetch/cache timestamps, payload hash, and mapping version.

State derivation:

1. Valid future AniList `nextAiringEpisode` → `airing`.
2. No released installment and at least one accepted upcoming installment → `upcoming`.
3. Finished current installment plus accepted unreleased sequel → `between_seasons`.
4. Explicit hiatus → `hiatus`.
5. Reliable whole-group end evidence → `ended`.
6. Finished current material without reliable sequel or franchise-end evidence → `future_unknown`.
7. Contradictory authoritative evidence → `future_unknown` plus review item.

A transient failure or malformed refresh never replaces valid evidence with null and never changes state merely because the latest call failed.

## 13. Artwork resolution

### 13.1 Canonical defaults

- Anime cover/backdrop: AniList first; TMDB may contribute only through a positive active AniList↔TMDB mapping.
- Movie/non-anime TV cover/backdrop: TMDB.
- Transparent title logo: Fanart.tv only in v1; if none is eligible, render text.

### 13.2 Fanart identifiers

- Movies use a positively mapped TMDB movie ID.
- TV uses a positively mapped TVDB show ID.
- Anime TV therefore requires an AniList→TVDB mapping, normally introduced as validated enrichment; Fanart has no direct AniList lookup in this contract.
- The Fanart movie endpoint may also accept IMDb IDs, but Kureha standardizes on TMDB movie IDs to keep one deterministic lookup path.
- A mapping confidence below the accepted positive threshold cannot unlock Fanart art.
- If no validated TVDB mapping exists for an anime/TV title, Kureha skips the Fanart request and renders a text title without creating an error or blocking ingestion.

### 13.3 Default selection

For title logos:

1. candidates matching the viewer's configured language;
2. English (`en`);
3. language-neutral (`00`, empty, or normalized null);
4. HD logo field before its legacy/SD counterpart;
5. highest numeric provider vote/rank (`likes`, parsed from a numeric string);
6. stable provider asset ID tie-break.

The same artwork query accepts profile context. If an authorized profile preference exists and remains eligible, use it. Otherwise use the canonical default. Missing/broken logos use text—not a logo from an unproven mapping.

Cover/backdrop preferences independently select among eligible AniList/TMDB assets. A user's choice never overwrites `artwork_assets`, provider rankings, or another user's preference.

## 14. Refresh queue and provider budgets

### 14.1 Cadence

- actively airing anime and next-14-day release events: every 15 minutes;
- announced/upcoming installments: every 6 hours;
- between-seasons/future-unknown groups: daily;
- recently finished installments: weekly for 90 days;
- long-finished stable titles: every 30 days or on demand;
- TMDB airing/returning TV: daily;
- TMDB recently ended: weekly;
- TMDB long-finished: every 30 days;
- Ani.zip/Fanart enrichment: after import, on mapping change, and adaptive refresh no more aggressively than provider policy permits.

### 14.2 Priority and throttling

Interactive work uses the same central per-provider budget but always precedes queued background work. Background claims pause while interactive demand exists or a provider reports low remaining capacity.

AniList budget is header-driven. The worker must honor the current `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`, and reset headers rather than assuming the documented normal 90/minute ceiling; the official docs currently warn of a degraded 30/minute limit.[1]

TMDB uses conservative configurable concurrency/rate limits and exponential backoff with jitter on 429 because its current edge limits are not a fixed contract.[2]

Ani.zip and Fanart budgets are configurable and conservative because neither is allowed to become a critical path.

### 14.3 Retry/lease behavior

- Exponential backoff with full jitter.
- Exact `Retry-After` takes precedence.
- Expired leases are reclaimable.
- Same logical job is deduplicated.
- Permanent validation/auth errors become `dead` after bounded attempts and create observable review/operations signals.
- No job logs secrets or full raw provider payloads.

## 15. Mapping version and identity preservation

- Canonical UUIDs are immutable after creation.
- Provider updates create a draft mapping version before active mapping changes.
- Activation is atomic: lock group, validate every target, supersede current version, activate draft, update lookup mappings.
- Watched episode/movie references are never rewritten merely because a provider mapping changed.
- Removed provider episodes are not physically deleted when referenced. Unsafe unmatched changes block activation or create explicit unresolved review state.
- Rollback activates a prior valid mapping version; it does not restore the database from a destructive snapshot.

## 16. Server functions

### Public

- `searchCatalogue`
- `previewProviderTitle`
- `getCanonicalMediaDetails`
- `getArtworkCandidates` (only public/default candidates; profile choices require normal profile authorization)

### Authenticated/profile-complete

- `importProviderTitle`
- `refreshMediaOnDemand` (throttled)
- `setArtworkPreference`
- `clearArtworkPreference`

### Maintainer only

- `listCatalogueReviewItems`
- `resolveCatalogueReviewItem`
- `previewMappingVersion`
- `activateMappingVersion`
- `rollbackMappingVersion`

All input uses Zod/runtime validation. Import, refresh, preference, and review mutations use idempotency receipts or naturally idempotent unique keys.

## 17. Error contract

Typed external errors include:

- `INVALID_QUERY`
- `UNAUTHORIZED`
- `PROFILE_SETUP_REQUIRED`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `PARTIAL_PROVIDER_RESULT`
- `PROVIDER_SCHEMA_CHANGED`
- `UNKNOWN_PROVIDER_ID`
- `UNCERTAIN_ANIME_REVIEW_REQUIRED`
- `AMBIGUOUS_RELATION_REVIEW_REQUIRED`
- `MAPPING_CONFLICT`
- `IMPORT_OPERATION_CONFLICT`
- `ARTWORK_NOT_ELIGIBLE`
- `FORBIDDEN_REVIEW_ACTION`
- `INTERNAL_ERROR`

Provider error details returned to clients must not include response bodies, tokens, headers containing credentials, SQL, or internal stack traces.

## 18. Migration and rollback

### Forward

1. Apply existing migrations `0000 → 0001 → 0002` in fresh PGlite.
2. Apply `0003` additions without deleting M1/M2 data.
3. Create relation/review/artwork/preference/job/sync tables and constraints.
4. Add metadata hash/timestamp columns.
5. Synchronize Drizzle journal and snapshot.
6. Seed no provider data and require no credentials for migration.

### Rollback

- Code rollback may stop M3 workers and routes while retaining additive M3 tables.
- Schema down migration may drop M3-only tables only before production data exists and only with explicit approval.
- After production usage, rollback is forward-fix only for canonical/review/artwork/job data.
- M1/M2 canonical and tracking rows must remain untouched.

## 19. Acceptance matrix

### Search and previews

1. Both providers succeed → combined tagged results.
2. AniList fails → valid TMDB results with partial marker.
3. TMDB fails → valid AniList results with partial marker.
4. Positive mapping duplicate → TMDB duplicate suppressed.
5. Similar title without mapping → both remain.
6. Likely anime TMDB TV without mapping → visible, `uncertain_anime`, import blocked.
7. Search/anonymous preview creates no canonical catalogue rows.
8. Search respects anonymous rate limit.

### Canonical import and identity

9. Unauthenticated import → `UNAUTHORIZED`.
10. Incomplete profile → `PROFILE_SETUP_REQUIRED`.
11. First AniList import creates exactly one group/mainline/installment/mapping/evidence set.
12. Re-import returns the same IDs and creates no duplicates.
13. Ten concurrent same-ID imports produce one canonical group under real Postgres.
14. Existing mapping resolves existing group.
15. Mid-import failure leaves no partial canonical graph.
16. Remap preserves watched UUID references and progress.
17. Full provider payload is not persisted; normalized hashes/provenance are.

### Anime graph

18. Linear S1→S2→S3 creates one ordered mainline.
19. Split cours become distinct ordered installments.
20. Cycle terminates safely.
21. Multiple sequel branches do not auto-attach and create one pending review item.
22. OVA/special/recap/Season 0 defaults to extras and does not affect progress.
23. Non-anime and character relations are excluded from relation cards.
24. Selected installment plus proven chain imports; unrelated direct relations remain preview edges.
25. Newly discovered unambiguous sequel auto-attaches without changing library intent or watched rows.
26. Ambiguous new season stays separate and creates a review item.

### Episodes and movies

27. Finite AniList episode count creates exact numbered stubs.
28. Unknown total grows stubs idempotently as schedules appear.
29. Ani.zip enriches exact episode rows without changing UUIDs.
30. Ani.zip timeout/malformed payload leaves core import usable.
31. Standalone anime movie imports as movie group with no episode rows.
32. Proven franchise anime movie imports as one-episode installment.
33. TMDB movie and non-anime TV choose correct M2 tracking kind.

### Release state and resilience

34. Upcoming→airing→between-seasons→future-unknown/ended cases match PRD.
35. Transient failure retains last-known-good metadata/evidence.
36. Tracking succeeds while all providers are unavailable.
37. 429 honors `Retry-After`; background work yields to interactive demand.
38. Logical refresh jobs deduplicate and expired leases recover.
39. Concurrent real-Postgres workers claim one job once.

### Artwork

40. Positive TMDB/TVDB mapping unlocks eligible Fanart logo lookup.
41. No positive mapping performs no Fanart lookup and renders text.
42. Only Fanart logo fields are normalized; Fanart poster/background fields are ignored.
43. Viewer-language→English→neutral→votes ordering is deterministic.
44. User selects logo, cover, and backdrop independently from eligible assets.
45. Authorized profile viewer receives owner's selections.
46. Unauthorized private/friends-only viewer receives no preference records.
47. User A preference does not change User B/default presentation.
48. Unavailable selected asset falls back without destroying preference reference.
49. Invalid cross-group or wrong-kind asset selection is rejected.
50. No provider secret appears in client bundles or sanitized logs.

### Quality gates

51. Fresh PGlite applies `0000 → 0001 → 0002 → 0003`.
52. All provider tests use fixtures and zero network.
53. Unit tests cover normalization, graph traversal, dedupe, cadence, release state, and artwork selection.
54. PGlite tests cover constraints, idempotent repositories, review queue, preference authorization helpers, and mapping promotion.
55. Opt-in real Postgres tests cover advisory locking and `SKIP LOCKED` claims.
56. `npm test`, typecheck, build, `git diff --check`, migration journal/snapshot verification, and secret scan pass.

## 20. Implementation order (after approval only)

1. Contract-traced failing tests and provider fixtures.
2. Additive `0003` schema/migration with PGlite checks.
3. Typed clients, validators, transport, and priority budgets.
4. Pure normalized adapters and graph/release/artwork algorithms.
5. Locked canonical import repository and mapping-version flow.
6. Search/preview/import server functions.
7. Artwork catalogue/preferences and authorization.
8. Refresh queue and separate worker.
9. Full gates, adversarial review, migration verification, durable checkpoint.

## 21. Source notes

The contract relies on official/current provider documentation for volatile operational behavior:

1. AniList rate limiting: standard 90 requests/minute, current documented degraded 30/minute, rate-limit and retry headers, and burst limiting: https://docs.anilist.co/guide/rate-limiting
2. TMDB API documentation and append-to-response behavior: https://developer.themoviedb.org/docs and https://developer.themoviedb.org/docs/append-to-response
3. TMDB authentication: https://developer.themoviedb.org/docs/authentication-application
4. AniList pagination and GraphQL errors: https://docs.anilist.co/guide/graphql/pagination and https://docs.anilist.co/guide/graphql/errors
5. Fanart.tv API v3.2 documentation: https://api.fanart.tv/
6. Fanart.tv maintained Node client field/identifier examples: https://github.com/fanart-tv/fanart.tv-api

Operational limits and provider schemas are configuration, not immutable business constants. Tests must assert header/backoff behavior without encoding today's temporary quota as a permanent assumption.
