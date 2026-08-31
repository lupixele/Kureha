# Kureha Project File Audit — 2026-08-18

> Reconstructed on 2026-08-28 from the same mounted implementation archive. Project-owned files are weighed against the latest tracking record; generated/vendor files are not treated as product decisions.

## Audit Scope

- Source archive files: **24,046**
- Files treated as project-owned/reviewable after excluding obvious vendor/build/Git/worktree output: **309**
- Authority order used: `Tracking-Core.md` → current implementation evidence → implementation docs/decision log → older/reference material.
- A file existing in the repo is evidence of implementation, not automatic proof that its design is still desired.

## Executive Findings

- **Implemented tracker core:** Two-axis tracking is present in code: derived progress plus stored intent. Binary watched state, per-episode rewatch counts, skipped-episode detection, and season rewatch primitives exist.
- **Real web/backend wiring exists:** TanStack Start, Supabase Auth, Drizzle/Postgres adapters, authenticated library reads, mark-watched and unmark-watched server functions, and a diagnostic `/test-library` route are present.
- **Metadata source is represented but not switched:** `metadataSource: tmdb | tvdb` exists and defaults to TMDB, but the per-title TMDB→TVDB remapping workflow remains deferred.
- **Phase-1 tests exist:** Pure tracking fixtures and schema tests are present. The archive also contains real-Postgres integration tests for schema constraints and a brand-new mark-watched path.
- **DB enums are TypeScript-typed, not DB-constrained:** Drizzle uses `text(...).$type<...>()` for media type, metadata source, intent, and release state. That gives compile-time typing but no Postgres CHECK constraint preventing arbitrary strings inserted outside typed code.
- **Core progress depends on cached totalEpisodes:** For series/anime, `deriveProgress()` compares watched-row count to `totalEpisodes`. Provider changes can move caught-up/in-progress state without user action; provider renumbering/remapping is still an acknowledged later problem.
- **Runtime error visibility is inconsistent:** Server functions catch errors and return strings; the diagnostic UI should be treated as developer tooling, not product UX. Production error taxonomy and user-facing recovery are not yet designed.
- **Integration tests touch configured DATABASE_URL:** The real-DB tests operate on whatever DB credentials are configured. They use dedicated IDs and cleanup, but a separate test database/schema remains safer for routine automation.
- **Historical streaming/reference material must not drive tracker work:** The reboot explicitly made the web tracker a standalone service. Old torrent/extension material is reference-only for a future separate Electron app.

## Project-Owned File Inventory

### Authentication

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `src/auth/auth.functions.ts` | 567 | 17 | `ab82bea614f6` |  |
| `src/auth/auth.server.ts` | 747 | 33 | `7bdef70fa2c8` |  |
| `src/auth/middleware.ts` | 676 | 25 | `a51e2ba5f2ed` |  |
| `src/auth/supabase-browser.ts` | 353 | 10 | `82dcfc610f4d` |  |
| `src/auth/supabase.server.ts` | 541 | 20 | `e5fd75ba2dbe` |  |

### Core tracking domain

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `src/core/progress.ts` | 1,025 | 45 | `e44a1c504d4f` | Derived progress logic; no stored progress field. |
| `src/core/schema.sql` | 1,215 | 27 | `8f8c4b800920` |  |
| `src/core/tracking.ts` | 4,644 | 143 | `f5380da58242` | Binary mark/unmark, intent, skipped episodes, season rewatch. |
| `src/core/types.ts` | 1,041 | 39 | `122f0f5c7926` |  |

### Database / migrations

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `drizzle.config.ts` | 338 | 17 | `38a984696c99` |  |
| `drizzle/0000_great_scarlet_witch.sql` | 1,102 | 24 | `1cc063b3d8ca` |  |
| `drizzle/meta/0000_snapshot.json` | 4,396 | 173 | `b6343f18afcb` |  |
| `drizzle/meta/_journal.json` | 213 | 13 | `c099f3273bf8` |  |
| `src/db/adapter.ts` | 1,682 | 54 | `65a546a19fc8` |  |
| `src/db/client.ts` | 390 | 15 | `027382e81176` |  |
| `src/db/schema.ts` | 1,797 | 47 | `b16a6065e481` | Drizzle Postgres schema; composite PK/FK. |

### Implementation records

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `IMPLEMENTAION/DECISIONS_LOG.md` | 5,605 | 53 | `6189fc9cd647` | Historical decision record; tracking core/implementation can supersede stale entries. |
| `IMPLEMENTAION/METADATA_SOURCE_CHECK.md` | 1,045 | 11 | `b9413c0f5573` |  |
| `IMPLEMENTAION/Phase 1 —IMP.md` | 3,758 | 78 | `775c06acb2df` |  |
| `IMPLEMENTAION/Phase 2 — Wiring the Tracker Implementation Plan.md` | 10,440 | 210 | `39d4802ada52` |  |
| `IMPLEMENTAION/PHASE_1_APPROVAL_AND_VERIFICATION.md` | 1,996 | 25 | `615c648579a9` |  |
| `IMPLEMENTAION/PHASE_1_BUG_FOUND.md` | 3,980 | 47 | `ffa034694b99` |  |
| `IMPLEMENTAION/PHASE_1_FINAL_VERIFICATION.md` | 1,798 | 21 | `6cdfd6c005d2` |  |
| `IMPLEMENTAION/PHASE_1_GEMINI_CORRECTION.md` | 3,796 | 53 | `d97515de4ac3` |  |
| `IMPLEMENTAION/PHASE_1_METADATA_SOURCE_ADDENDUM.md` | 2,648 | 61 | `21cb60c8160b` |  |
| `IMPLEMENTAION/PHASE_1_SIGNATURE_CLEANUP.md` | 3,006 | 41 | `29958465aed9` |  |
| `IMPLEMENTAION/PHASE_1_SPOTCHECK.md` | 1,910 | 21 | `e53a67dbcf50` |  |
| `IMPLEMENTAION/PHASE_1_TEST_APPROVAL.md` | 1,616 | 23 | `22aeb35a3fcb` |  |
| `IMPLEMENTAION/PHASE_1_TRACKING_CORE.md` | 16,912 | 308 | `b1dd074b4e93` |  |
| `IMPLEMENTAION/PHASE_2_PLAN_APPROVAL.md` | 4,120 | 55 | `2b0c8696020e` |  |
| `IMPLEMENTAION/PHASE_2_WIRING.md` | 14,368 | 215 | `5dca6d509ddf` |  |
| `IMPLEMENTAION/Tracking Core Implementation Walkthrough.md` | 2,291 | 28 | `88bfcf730ea0` |  |

### Other project-owned

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `.claude/CLAUDE.md` | 229 | 4 | `62232e3b673b` |  |
| `.claude/skills/banner-design/references/banner-sizes-and-styles.md` | 4,993 | 119 | `c8906fb1073a` |  |
| `.claude/skills/banner-design/SKILL.md` | 8,326 | 197 | `913d9c4b2a3b` |  |
| `.claude/skills/brand/references/approval-checklist.md` | 4,245 | 170 | `4bf8549687f5` |  |
| `.claude/skills/brand/references/asset-organization.md` | 5,110 | 158 | `de98123417e9` |  |
| `.claude/skills/brand/references/brand-guideline-template.md` | 3,572 | 141 | `392db8cf10fe` |  |
| `.claude/skills/brand/references/color-palette-management.md` | 4,254 | 187 | `c429298ffe39` |  |
| `.claude/skills/brand/references/consistency-checklist.md` | 1,926 | 95 | `56d8b2d4852c` |  |
| `.claude/skills/brand/references/logo-usage-rules.md` | 5,464 | 186 | `044c5ddf30cf` |  |
| `.claude/skills/brand/references/messaging-framework.md` | 1,763 | 86 | `24b2500a7286` |  |
| `.claude/skills/brand/references/typography-specifications.md` | 5,042 | 215 | `921c3d9e6ddf` |  |
| `.claude/skills/brand/references/update.md` | 3,365 | 119 | `537cb55ebe26` |  |
| `.claude/skills/brand/references/visual-identity.md` | 1,884 | 97 | `63f0cfc5d954` |  |
| `.claude/skills/brand/references/voice-framework.md` | 1,997 | 89 | `08c15ac79f81` |  |
| `.claude/skills/brand/SKILL.md` | 2,939 | 98 | `6a450ee1a83a` |  |
| `.claude/skills/brand/templates/brand-guidelines-starter.md` | 6,638 | 276 | `d157a57b15f0` |  |
| `.claude/skills/design-system/data/slide-backgrounds.csv` | 1,038 | 12 | `d1bb701b87be` |  |
| `.claude/skills/design-system/data/slide-charts.csv` | 8,631 | 27 | `12ef876cd76e` |  |
| `.claude/skills/design-system/data/slide-color-logic.csv` | 877 | 15 | `ea68c737075f` |  |
| `.claude/skills/design-system/data/slide-copy.csv` | 6,427 | 27 | `43152937a0e5` |  |
| `.claude/skills/design-system/data/slide-layout-logic.csv` | 981 | 17 | `26b5b75782d5` |  |
| `.claude/skills/design-system/data/slide-layouts.csv` | 8,760 | 27 | `95d558c1b7d2` |  |
| `.claude/skills/design-system/data/slide-strategies.csv` | 8,232 | 17 | `f656be0ab0b3` |  |
| `.claude/skills/design-system/data/slide-typography.csv` | 735 | 16 | `b96cd11dd4ff` |  |
| `.claude/skills/design-system/references/component-specs.md` | 6,914 | 237 | `b265d979a741` |  |
| `.claude/skills/design-system/references/component-tokens.md` | 4,986 | 215 | `e27f8f5999ba` |  |
| `.claude/skills/design-system/references/primitive-tokens.md` | 4,562 | 204 | `91e6caa12646` |  |
| `.claude/skills/design-system/references/semantic-tokens.md` | 4,245 | 216 | `97e16d8061bb` |  |
| `.claude/skills/design-system/references/states-and-variants.md` | 4,771 | 242 | `8dacb95d57d4` |  |
| `.claude/skills/design-system/references/tailwind-integration.md` | 5,633 | 252 | `6d01092db147` |  |
| `.claude/skills/design-system/references/token-architecture.md` | 5,365 | 225 | `925f4049c4c4` |  |
| `.claude/skills/design-system/SKILL.md` | 6,875 | 245 | `655468bb723a` |  |
| `.claude/skills/design/data/cip/deliverables.csv` | 13,385 | 51 | `229912f35c2f` |  |
| `.claude/skills/design/data/cip/industries.csv` | 4,935 | 21 | `729b1dea6d6f` |  |
| `.claude/skills/design/data/cip/mockup-contexts.csv` | 5,205 | 21 | `15d61cef16e6` |  |
| `.claude/skills/design/data/cip/styles.csv` | 5,967 | 21 | `4e7f9e209bc9` |  |
| `.claude/skills/design/data/icon/styles.csv` | 2,250 | 17 | `a4aa7d326ffe` |  |
| `.claude/skills/design/data/logo/colors.csv` | 10,674 | 57 | `d60218f0705b` |  |
| `.claude/skills/design/data/logo/industries.csv` | 13,274 | 57 | `e58dda4b9d28` |  |
| `.claude/skills/design/data/logo/styles.csv` | 13,678 | 57 | `ea08bdfb7aa5` |  |
| `.claude/skills/design/references/banner-sizes-and-styles.md` | 4,993 | 119 | `c8906fb1073a` |  |
| `.claude/skills/design/references/cip-deliverable-guide.md` | 1,735 | 96 | `1424e120b967` |  |
| `.claude/skills/design/references/cip-design.md` | 4,589 | 122 | `47a3b2e445bc` |  |
| `.claude/skills/design/references/cip-prompt-engineering.md` | 2,493 | 85 | `4bf3a0c858f3` |  |
| `.claude/skills/design/references/cip-style-guide.md` | 2,357 | 69 | `f3e15408cd98` |  |
| `.claude/skills/design/references/design-routing.md` | 5,826 | 208 | `32914a913f4f` |  |
| `.claude/skills/design/references/icon-design.md` | 4,343 | 123 | `39281931d070` |  |
| `.claude/skills/design/references/logo-color-psychology.md` | 3,341 | 102 | `3fd0e93e24c3` |  |
| `.claude/skills/design/references/logo-design.md` | 3,163 | 93 | `2e845fe165c8` |  |
| `.claude/skills/design/references/logo-prompt-engineering.md` | 4,314 | 159 | `e50f55bf3232` |  |
| `.claude/skills/design/references/logo-style-guide.md` | 3,435 | 110 | `611baa841eed` |  |
| `.claude/skills/design/references/slides-copywriting-formulas.md` | 2,604 | 85 | `03733d5916ab` |  |
| `.claude/skills/design/references/slides-create.md` | 153 | 5 | `792d647a5d4f` |  |
| `.claude/skills/design/references/slides-html-template.md` | 9,004 | 296 | `fd5b051a3736` |  |
| `.claude/skills/design/references/slides-layout-patterns.md` | 3,691 | 138 | `0a967ca3bd82` |  |
| `.claude/skills/design/references/slides-strategies.md` | 2,715 | 95 | `27ee3e53ffa0` |  |
| `.claude/skills/design/references/slides.md` | 1,742 | 43 | `5630d5daec94` |  |
| `.claude/skills/design/references/social-photos-design.md` | 11,251 | 330 | `2544c143ff3a` |  |
| `.claude/skills/design/SKILL.md` | 12,322 | 314 | `413f4ab913d0` |  |
| `.claude/skills/graphify/.graphify_version` | 6 | 1 | `3ab30c1e42e5` |  |
| `.claude/skills/graphify/references/add-watch.md` | 2,486 | 57 | `b3f675702405` |  |
| `.claude/skills/graphify/references/exports.md` | 3,362 | 88 | `ee47fae477f1` |  |
| `.claude/skills/graphify/references/extraction-spec.md` | 7,960 | 71 | `f72a6d2dfa67` |  |
| `.claude/skills/graphify/references/github-and-merge.md` | 2,177 | 47 | `e5ebd90c7686` |  |
| `.claude/skills/graphify/references/hooks.md` | 1,267 | 34 | `b9a4e9f66813` |  |
| `.claude/skills/graphify/references/query.md` | 13,456 | 312 | `e563ddcb1e15` |  |
| `.claude/skills/graphify/references/transcribe.md` | 3,173 | 53 | `676a1e39aa6d` |  |
| `.claude/skills/graphify/references/update.md` | 10,425 | 211 | `661f559b3ff4` |  |
| `.claude/skills/graphify/SKILL.md` | 43,292 | 751 | `43011be55152` |  |
| `.claude/skills/slides/references/copywriting-formulas.md` | 2,604 | 85 | `03733d5916ab` |  |
| `.claude/skills/slides/references/create.md` | 153 | 5 | `792d647a5d4f` |  |
| `.claude/skills/slides/references/html-template.md` | 9,004 | 296 | `fd5b051a3736` |  |
| `.claude/skills/slides/references/layout-patterns.md` | 3,691 | 138 | `0a967ca3bd82` |  |
| `.claude/skills/slides/references/slide-strategies.md` | 2,715 | 95 | `27ee3e53ffa0` |  |
| `.claude/skills/slides/SKILL.md` | 1,137 | 41 | `2b90bdaf63f2` |  |
| `.claude/skills/ui-styling/canvas-fonts/ArsenalSC-OFL.txt` | 4,373 | 94 | `8ddd61b18ba2` |  |
| `.claude/skills/ui-styling/canvas-fonts/ArsenalSC-Regular.ttf` | 165,848 | — | `65e6f89df58f` |  |
| `.claude/skills/ui-styling/canvas-fonts/BigShoulders-Bold.ttf` | 94,528 | — | `b43bcd198b9f` |  |
| `.claude/skills/ui-styling/canvas-fonts/BigShoulders-OFL.txt` | 4,397 | 94 | `fbc746aabf0e` |  |
| `.claude/skills/ui-styling/canvas-fonts/BigShoulders-Regular.ttf` | 94,396 | — | `18a879fc7197` |  |
| `.claude/skills/ui-styling/canvas-fonts/Boldonse-OFL.txt` | 4,390 | 94 | `45cc82ab4032` |  |
| `.claude/skills/ui-styling/canvas-fonts/Boldonse-Regular.ttf` | 77,168 | — | `cc2e54060456` |  |
| `.claude/skills/ui-styling/canvas-fonts/BricolageGrotesque-Bold.ttf` | 90,952 | — | `a737b146fe0d` |  |
| `.claude/skills/ui-styling/canvas-fonts/BricolageGrotesque-OFL.txt` | 4,403 | 94 | `0e4f4eb8534b` |  |
| `.claude/skills/ui-styling/canvas-fonts/BricolageGrotesque-Regular.ttf` | 90,920 | — | `972a6d098c98` |  |
| `.claude/skills/ui-styling/canvas-fonts/CrimsonPro-Bold.ttf` | 107,352 | — | `48f191e38355` |  |
| `.claude/skills/ui-styling/canvas-fonts/CrimsonPro-Italic.ttf` | 108,828 | — | `52318db3526b` |  |
| `.claude/skills/ui-styling/canvas-fonts/CrimsonPro-OFL.txt` | 4,394 | 94 | `35680d14547b` |  |
| `.claude/skills/ui-styling/canvas-fonts/CrimsonPro-Regular.ttf` | 106,696 | — | `48fad08cb191` |  |
| `.claude/skills/ui-styling/canvas-fonts/DMMono-OFL.txt` | 4,392 | 94 | `bfe7842fcb88` |  |
| `.claude/skills/ui-styling/canvas-fonts/DMMono-Regular.ttf` | 48,852 | — | `f98ada968dc3` |  |
| `.claude/skills/ui-styling/canvas-fonts/EricaOne-OFL.txt` | 4,410 | 95 | `e0de629968b5` |  |
| `.claude/skills/ui-styling/canvas-fonts/EricaOne-Regular.ttf` | 24,872 | — | `db1d89e80e33` |  |
| `.claude/skills/ui-styling/canvas-fonts/GeistMono-Bold.ttf` | 78,304 | — | `75c0828d5c1e` |  |
| `.claude/skills/ui-styling/canvas-fonts/GeistMono-OFL.txt` | 4,388 | 94 | `6a873c900f58` |  |
| `.claude/skills/ui-styling/canvas-fonts/GeistMono-Regular.ttf` | 78,232 | — | `a55c1b51cda4` |  |
| `.claude/skills/ui-styling/canvas-fonts/Gloock-OFL.txt` | 4,381 | 94 | `c0a3f3125ac4` |  |
| `.claude/skills/ui-styling/canvas-fonts/Gloock-Regular.ttf` | 95,156 | — | `e86b4ce66dbd` |  |
| `.claude/skills/ui-styling/canvas-fonts/IBMPlexMono-Bold.ttf` | 136,008 | — | `dbd2a2fb0245` |  |
| `.claude/skills/ui-styling/canvas-fonts/IBMPlexMono-OFL.txt` | 4,363 | 94 | `5294ce778857` |  |
| `.claude/skills/ui-styling/canvas-fonts/IBMPlexMono-Regular.ttf` | 133,796 | — | `ab08018ccd27` |  |
| `.claude/skills/ui-styling/canvas-fonts/IBMPlexSerif-Bold.ttf` | 161,000 | — | `b8d294e9b5c5` |  |
| `.claude/skills/ui-styling/canvas-fonts/IBMPlexSerif-BoldItalic.ttf` | 169,840 | — | `da64b75f4284` |  |
| `.claude/skills/ui-styling/canvas-fonts/IBMPlexSerif-Italic.ttf` | 170,004 | — | `b11f1048745e` |  |
| `.claude/skills/ui-styling/canvas-fonts/IBMPlexSerif-Regular.ttf` | 160,380 | — | `77cd233a2af8` |  |
| `.claude/skills/ui-styling/canvas-fonts/InstrumentSans-Bold.ttf` | 68,084 | — | `444f85bf1c4b` |  |
| `.claude/skills/ui-styling/canvas-fonts/InstrumentSans-BoldItalic.ttf` | 70,004 | — | `3762f6cef95d` |  |
| `.claude/skills/ui-styling/canvas-fonts/InstrumentSans-Italic.ttf` | 69,900 | — | `78e85858e371` |  |
| `.claude/skills/ui-styling/canvas-fonts/InstrumentSans-OFL.txt` | 4,403 | 94 | `bf4dc6d13a8c` |  |
| `.claude/skills/ui-styling/canvas-fonts/InstrumentSans-Regular.ttf` | 68,028 | — | `a22cb26e48fd` |  |
| `.claude/skills/ui-styling/canvas-fonts/InstrumentSerif-Italic.ttf` | 70,868 | — | `9c86e4d5a47b` |  |
| `.claude/skills/ui-styling/canvas-fonts/InstrumentSerif-Regular.ttf` | 69,312 | — | `56ac3be03ac3` |  |
| `.claude/skills/ui-styling/canvas-fonts/Italiana-OFL.txt` | 4,394 | 94 | `8373b11312ac` |  |
| `.claude/skills/ui-styling/canvas-fonts/Italiana-Regular.ttf` | 27,184 | — | `15c4dd6ab8cf` |  |
| `.claude/skills/ui-styling/canvas-fonts/JetBrainsMono-Bold.ttf` | 114,828 | — | `a2349098b9e4` |  |
| `.claude/skills/ui-styling/canvas-fonts/JetBrainsMono-OFL.txt` | 4,399 | 94 | `a76abf002c49` |  |
| `.claude/skills/ui-styling/canvas-fonts/JetBrainsMono-Regular.ttf` | 114,904 | — | `b6b1ff4ddefe` |  |
| `.claude/skills/ui-styling/canvas-fonts/Jura-Light.ttf` | 154,308 | — | `c891a381df05` |  |
| `.claude/skills/ui-styling/canvas-fonts/Jura-Medium.ttf` | 154,488 | — | `c72965cb732a` |  |
| `.claude/skills/ui-styling/canvas-fonts/Jura-OFL.txt` | 4,380 | 94 | `eaf9bdb675f6` |  |
| `.claude/skills/ui-styling/canvas-fonts/LibreBaskerville-OFL.txt` | 4,449 | 94 | `55959eef5b0c` |  |
| `.claude/skills/ui-styling/canvas-fonts/LibreBaskerville-Regular.ttf` | 147,584 | — | `2101302538d9` |  |
| `.claude/skills/ui-styling/canvas-fonts/Lora-Bold.ttf` | 133,828 | — | `7d74015e950c` |  |
| `.claude/skills/ui-styling/canvas-fonts/Lora-BoldItalic.ttf` | 140,332 | — | `152f87e71f5d` |  |
| `.claude/skills/ui-styling/canvas-fonts/Lora-Italic.ttf` | 139,328 | — | `be627e595184` |  |
| `.claude/skills/ui-styling/canvas-fonts/Lora-OFL.txt` | 4,423 | 94 | `62e37a82d3f1` |  |
| `.claude/skills/ui-styling/canvas-fonts/Lora-Regular.ttf` | 133,888 | — | `7ed00e7c9cdf` |  |
| `.claude/skills/ui-styling/canvas-fonts/NationalPark-Bold.ttf` | 79,208 | — | `69ac4c301c4a` |  |
| `.claude/skills/ui-styling/canvas-fonts/NationalPark-OFL.txt` | 4,399 | 94 | `81c6c71d83b5` |  |
| `.claude/skills/ui-styling/canvas-fonts/NationalPark-Regular.ttf` | 76,424 | — | `a477338b7e18` |  |
| `.claude/skills/ui-styling/canvas-fonts/NothingYouCouldDo-OFL.txt` | 4,363 | 94 | `7c2a6970584d` |  |
| `.claude/skills/ui-styling/canvas-fonts/NothingYouCouldDo-Regular.ttf` | 32,020 | — | `d866f985896d` |  |
| `.claude/skills/ui-styling/canvas-fonts/Outfit-Bold.ttf` | 55,392 | — | `6654b93d2130` |  |
| `.claude/skills/ui-styling/canvas-fonts/Outfit-OFL.txt` | 4,389 | 94 | `1945b62cd76d` |  |
| `.claude/skills/ui-styling/canvas-fonts/Outfit-Regular.ttf` | 54,912 | — | `f24945365147` |  |
| `.claude/skills/ui-styling/canvas-fonts/PixelifySans-Medium.ttf` | 51,072 | — | `38397504f71c` |  |
| `.claude/skills/ui-styling/canvas-fonts/PixelifySans-OFL.txt` | 4,395 | 94 | `7f54d1d9f1ae` |  |
| `.claude/skills/ui-styling/canvas-fonts/PoiretOne-OFL.txt` | 4,366 | 94 | `2eaf541f7eb8` |  |
| `.claude/skills/ui-styling/canvas-fonts/PoiretOne-Regular.ttf` | 45,244 | — | `9cf265b13964` |  |
| `.claude/skills/ui-styling/canvas-fonts/RedHatMono-Bold.ttf` | 34,420 | — | `7ef48353f4be` |  |
| `.claude/skills/ui-styling/canvas-fonts/RedHatMono-OFL.txt` | 4,394 | 94 | `435fbfb7e669` |  |
| `.claude/skills/ui-styling/canvas-fonts/RedHatMono-Regular.ttf` | 34,488 | — | `452fe826871b` |  |
| `.claude/skills/ui-styling/canvas-fonts/Silkscreen-OFL.txt` | 4,394 | 94 | `6b849745119b` |  |
| `.claude/skills/ui-styling/canvas-fonts/Silkscreen-Regular.ttf` | 31,960 | — | `495674086008` |  |
| `.claude/skills/ui-styling/canvas-fonts/SmoochSans-Medium.ttf` | 59,704 | — | `dd76e6e77cce` |  |
| `.claude/skills/ui-styling/canvas-fonts/SmoochSans-OFL.txt` | 4,396 | 94 | `74c9c4eb88e8` |  |
| `.claude/skills/ui-styling/canvas-fonts/Tektur-Medium.ttf` | 76,248 | — | `52bbe8c9b057` |  |
| `.claude/skills/ui-styling/canvas-fonts/Tektur-OFL.txt` | 4,385 | 94 | `3f1466cb5438` |  |
| `.claude/skills/ui-styling/canvas-fonts/Tektur-Regular.ttf` | 75,604 | — | `162e1b36c471` |  |
| `.claude/skills/ui-styling/canvas-fonts/WorkSans-Bold.ttf` | 191,304 | — | `240d125fc9f8` |  |
| `.claude/skills/ui-styling/canvas-fonts/WorkSans-BoldItalic.ttf` | 175,772 | — | `a5b2cad813df` |  |
| `.claude/skills/ui-styling/canvas-fonts/WorkSans-Italic.ttf` | 174,280 | — | `6b7f7002e0b0` |  |
| `.claude/skills/ui-styling/canvas-fonts/WorkSans-OFL.txt` | 4,397 | 94 | `ace8c22a3326` |  |
| `.claude/skills/ui-styling/canvas-fonts/WorkSans-Regular.ttf` | 188,916 | — | `e67985a843df` |  |
| `.claude/skills/ui-styling/canvas-fonts/YoungSerif-OFL.txt` | 4,398 | 94 | `cdcb8039606b` |  |
| `.claude/skills/ui-styling/canvas-fonts/YoungSerif-Regular.ttf` | 105,136 | — | `f8dc08f77aba` |  |
| `.claude/skills/ui-styling/LICENSE.txt` | 11,357 | 202 | `58d1e17ffe51` |  |
| `.claude/skills/ui-styling/references/canvas-design-system.md` | 7,888 | 321 | `f5de85ff39d9` |  |
| `.claude/skills/ui-styling/references/shadcn-accessibility.md` | 9,976 | 472 | `a22cd4ccf82b` |  |
| `.claude/skills/ui-styling/references/shadcn-components.md` | 11,155 | 425 | `79c4f91cbf68` |  |
| `.claude/skills/ui-styling/references/shadcn-theming.md` | 8,672 | 374 | `d17d64147422` |  |
| `.claude/skills/ui-styling/references/tailwind-customization.md` | 10,171 | 484 | `4c5adeed6263` |  |
| `.claude/skills/ui-styling/references/tailwind-responsive.md` | 8,270 | 383 | `8d00ae620df2` |  |
| `.claude/skills/ui-styling/references/tailwind-utilities.md` | 9,980 | 456 | `aba1c40ef84f` |  |
| `.claude/skills/ui-styling/SKILL.md` | 10,045 | 325 | `f8b6c3832d2a` |  |
| `.claude/skills/ui-ux-pro-max/data/app-interface.csv` | 9,743 | 31 | `2a17ef810dab` |  |
| `.claude/skills/ui-ux-pro-max/data/charts.csv` | 19,365 | 27 | `a70ef7460b0e` |  |
| `.claude/skills/ui-ux-pro-max/data/colors.csv` | 32,271 | 162 | `5a6cb6c5d6f1` |  |
| `.claude/skills/ui-ux-pro-max/data/google-fonts.csv` | 743,272 | 1925 | `3fd2898fb0fd` |  |
| `.claude/skills/ui-ux-pro-max/data/icons.csv` | 20,637 | 106 | `f376c29fb4df` |  |
| `.claude/skills/ui-ux-pro-max/data/landing.csv` | 16,685 | 36 | `121a2cac7cf2` |  |
| `.claude/skills/ui-ux-pro-max/data/motion.csv` | 10,517 | 18 | `528be0332478` |  |
| `.claude/skills/ui-ux-pro-max/data/products.csv` | 58,006 | 163 | `9fd9e776ba84` |  |
| `.claude/skills/ui-ux-pro-max/data/react-performance.csv` | 14,822 | 46 | `904c8afcda22` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/angular.csv` | 18,269 | 52 | `dd7cc2a2b34c` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/astro.csv` | 11,868 | 55 | `ad18dae3ab6d` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/flutter.csv` | 10,416 | 54 | `fe36d404c799` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/html-tailwind.csv` | 11,305 | 57 | `7aef38e75c53` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/jetpack-compose.csv` | 8,195 | 54 | `6c8fd4b0391c` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/laravel.csv` | 18,378 | 52 | `50e11e60a64b` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/nextjs.csv` | 12,493 | 54 | `e828ccc04843` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/nuxt-ui.csv` | 14,010 | 52 | `05d6e74501b2` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/nuxtjs.csv` | 16,539 | 60 | `f7a3f2d95428` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/react-native.csv` | 9,983 | 53 | `077aefc81d19` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/react.csv` | 12,962 | 55 | `e5624ab41d33` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/shadcn.csv` | 15,921 | 62 | `395c2e415ef6` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/svelte.csv` | 11,009 | 55 | `71af52d64f26` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/swiftui.csv` | 10,821 | 52 | `c9c2d2510f8e` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/threejs.csv` | 44,787 | 55 | `f1c05f8f269f` |  |
| `.claude/skills/ui-ux-pro-max/data/stacks/vue.csv` | 11,006 | 51 | `c2724915d3c1` |  |
| `.claude/skills/ui-ux-pro-max/data/styles.csv` | 142,605 | 86 | `f37eb20e7403` |  |
| `.claude/skills/ui-ux-pro-max/data/typography.csv` | 49,667 | 75 | `dbea262a54e3` |  |
| `.claude/skills/ui-ux-pro-max/data/ui-reasoning.csv` | 52,908 | 163 | `06e436944538` |  |
| `.claude/skills/ui-ux-pro-max/data/ux-guidelines.csv` | 18,667 | 100 | `e01943c433b2` |  |
| `.claude/skills/ui-ux-pro-max/SKILL.md` | 47,699 | 691 | `360d09d9a309` |  |
| `.env` | 1,843 | 23 | `cd09c3e8188e` |  |
| `.gitattributes` | 39 | 2 | `d1580533de3f` |  |
| `.opencode/plugins/graphify.js` | 1,432 | 31 | `f44668d0be8a` |  |
| `84_20260712004149.svg` | 276,847 | 67 | `dff078509bb0` |  |
| `84_20260712010557.svg` | 285,002 | 63 | `dac48ebfe9a3` |  |
| `app.config.ts` | 184 | 8 | `b0083929e2f2` |  |
| `CLAUDE.md` | 781 | 10 | `4b9346ec24bd` |  |
| `index.md` | 731 | 20 | `b5a3cf7a7f10` |  |
| `Kureha_Backup/App.tsx` | 191,039 | 3393 | `aa1535188083` |  |
| `Kureha_Backup/PlayerUI.tsx` | 75,876 | 1549 | `755154c36d5d` |  |
| `Kureha_Backup/torrent.ts` | 3,598 | 115 | `eb8f977e2aac` |  |
| `Kureha_Backup/torrentProcess.ts` | 10,591 | 285 | `757199ce9545` |  |
| `KUREHA_COMPLETE_PROJECT_BRIEFING.md` | 14,836 | 110 | `f91468f9ba3c` |  |
| `Multi_Source_Media_Addon_Architecture_Report.md` | 3,164 | 269 | `09f117159f52` |  |
| `PROGRESS.md` | 610 | 17 | `64d35734c972` |  |
| `src/client.tsx` | 148 | 4 | `767f648835eb` |  |
| `src/server.tsx` | 254 | 9 | `efd6b811ce31` |  |
| `src/ssr.tsx` | 145 | 2 | `16fcf95f610f` |  |
| `test-err.ts` | 426 | 17 | `60fc1bc0b11e` |  |
| `test-run.ts` | 100 | 3 | `928aed3d1394` |  |
| `vite.config.ts` | 353 | 12 | `da78205d1c00` |  |

### Project/config

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `.claude/settings.json` | 436 | 24 | `44871c28a43e` |  |
| `.claude/settings.local.json` | 4,563 | 83 | `52ea8798034f` |  |
| `.claude/skills/design-system/templates/design-tokens-starter.json` | 7,184 | 144 | `5444f477b06b` |  |
| `.gitignore` | 111 | 13 | `5c8a4e4a48be` |  |
| `.opencode/opencode.json` | 61 | 5 | `0a640dda699c` |  |
| `Kureha_Backup/package.json` | 534 | 25 | `c2fa32a852bb` |  |
| `package-lock.json` | 385,159 | 11169 | `daecbd4e0a6d` |  |
| `package.json` | 1,128 | 44 | `a1ff06fb67ac` | TanStack Start + Supabase + Drizzle + Vitest stack. |
| `tsconfig.json` | 534 | 20 | `a120583f61fb` |  |

### Routes / UI wiring

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `src/router.tsx` | 353 | 16 | `116b5fb82472` |  |
| `src/routes/__root.tsx` | 2,293 | 86 | `a21c497123be` |  |
| `src/routes/api/test-auth.tsx` | 1,194 | 41 | `fe9014a16901` |  |
| `src/routes/auth/callback.tsx` | 1,807 | 60 | `74e4bbbe0506` |  |
| `src/routes/index.tsx` | 866 | 29 | `bbda015b75d7` |  |
| `src/routes/login.tsx` | 1,098 | 43 | `d889fadf23cd` |  |
| `src/routes/test-library.tsx` | 11,426 | 264 | `9b426f04a0fd` | Diagnostic/test UI, not final product library UX. |
| `src/routeTree.gen.ts` | 4,459 | 148 | `a1dab179fd23` |  |

### Scripts / verification

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `.claude/skills/brand/scripts/extract-colors.cjs` | 9,328 | 342 | `36d21f3905e5` |  |
| `.claude/skills/brand/scripts/inject-brand-context.cjs` | 9,677 | 350 | `5b98abdeb5c6` |  |
| `.claude/skills/brand/scripts/sync-brand-to-tokens.cjs` | 9,545 | 249 | `390a760570fd` |  |
| `.claude/skills/brand/scripts/validate-asset.cjs` | 10,173 | 388 | `4546c9109fb0` |  |
| `.claude/skills/design-system/scripts/embed-tokens.cjs` | 2,558 | 100 | `23a9ce214e3c` |  |
| `.claude/skills/design-system/scripts/fetch-background.py` | 12,287 | 318 | `cecedad0a905` |  |
| `.claude/skills/design-system/scripts/generate-slide.py` | 28,595 | 771 | `0463c98efea5` |  |
| `.claude/skills/design-system/scripts/generate-tokens.cjs` | 4,968 | 206 | `aac8a0f4ec4d` |  |
| `.claude/skills/design-system/scripts/html-token-validator.py` | 11,894 | 328 | `9556a65e7aac` |  |
| `.claude/skills/design-system/scripts/search-slides.py` | 9,210 | 219 | `fded9548bc1b` |  |
| `.claude/skills/design-system/scripts/slide-token-validator.py` | 973 | 36 | `66da5da5e8e6` |  |
| `.claude/skills/design-system/scripts/slide_search_core.py` | 14,756 | 454 | `2464050ae338` |  |
| `.claude/skills/design-system/scripts/validate-tokens.cjs` | 5,942 | 247 | `65f03a29290b` |  |
| `.claude/skills/design/scripts/cip/core.py` | 8,062 | 216 | `78a78a51f12d` |  |
| `.claude/skills/design/scripts/cip/generate.py` | 19,430 | 485 | `2745040c9b53` |  |
| `.claude/skills/design/scripts/cip/render-html.py` | 13,941 | 425 | `a49a89a017ea` |  |
| `.claude/skills/design/scripts/cip/search.py` | 4,524 | 128 | `6619fbbe7198` |  |
| `.claude/skills/design/scripts/icon/generate.py` | 17,151 | 488 | `1a6be99dc233` |  |
| `.claude/skills/design/scripts/logo/core.py` | 6,023 | 176 | `4f8b36ffe538` |  |
| `.claude/skills/design/scripts/logo/generate.py` | 14,630 | 363 | `6e4358f21cd8` |  |
| `.claude/skills/design/scripts/logo/search.py` | 4,745 | 115 | `693b3a182483` |  |
| `.claude/skills/ui-styling/scripts/.coverage` | 53,248 | — | `a1f68d7a1d63` |  |
| `.claude/skills/ui-styling/scripts/requirements.txt` | 444 | 18 | `09402d2d2742` |  |
| `.claude/skills/ui-styling/scripts/shadcn_add.py` | 8,799 | 309 | `0c11d28ce9f1` |  |
| `.claude/skills/ui-styling/scripts/tailwind_config_gen.py` | 14,418 | 474 | `2e264ec87149` |  |
| `.claude/skills/ui-ux-pro-max/scripts/core.py` | 13,231 | 275 | `ab9f398b493e` |  |
| `.claude/skills/ui-ux-pro-max/scripts/design_system.py` | 57,828 | 1341 | `db272c664932` |  |
| `.claude/skills/ui-ux-pro-max/scripts/search.py` | 6,808 | 128 | `d9983d2a21d3` |  |
| `scripts/seed-dev-data.ts` | 1,774 | 69 | `179fe77655b9` |  |
| `scripts/verify-postgres-schema.ts` | 5,764 | 193 | `cc6ddcdd2539` |  |

### Server/service layer

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `src/server/library.ts` | 2,575 | 73 | `0e83467b9974` | Authenticated library read + derived progress/effective state. |
| `src/server/mark-watched.ts` | 5,328 | 148 | `b0947ca816b2` | Authenticated transaction; auto-create + atomic rewatch increment. |
| `src/server/unmark-watched.ts` | 4,303 | 126 | `986b6398fa0b` | Authenticated unmark transaction. |

### Tests

| File | Bytes | Lines | SHA-256 (12) | Notes |
|---|---:|---:|---|---|
| `.claude/skills/brand/scripts/tests/test_sync_brand_to_tokens.py` | 1,970 | 53 | `0ace0cf7c6a8` |  |
| `.claude/skills/design-system/scripts/tests/test_validate_tokens.py` | 1,619 | 49 | `a32f34a9e895` |  |
| `.claude/skills/ui-styling/scripts/tests/coverage-ui.json` | 35,121 | 1 | `33bdc1f5998d` |  |
| `.claude/skills/ui-styling/scripts/tests/requirements.txt` | 52 | 4 | `80846c98ee02` |  |
| `.claude/skills/ui-styling/scripts/tests/test_shadcn_add.py` | 9,920 | 267 | `4012b1efe1e5` |  |
| `.claude/skills/ui-styling/scripts/tests/test_tailwind_config_gen.py` | 14,658 | 395 | `4efa59fdbe31` |  |
| `tests/adapter.test.ts` | 2,057 | 73 | `5c6ed0ca2363` |  |
| `tests/mark-watched.integration.test.ts` | 2,367 | 57 | `5c12c2b7ca57` |  |
| `tests/schema.integration.test.ts` | 3,192 | 95 | `3e9f2847fb6b` |  |
| `tests/schema.test.ts` | 1,520 | 31 | `d8aceb712c6c` |  |
| `tests/tracking.test.ts` | 10,750 | 277 | `5a34677df80c` |  |

## Code-Level Review

### `src/core/types.ts`

Defines `ReleaseState`, `Progress`, `Intent`, `MetadataSource`, `TrackedMedia`, `WatchedEpisode`, `EpisodeRef`, and `EffectiveState`. The user identity comment now explicitly ties `userId` to Supabase Auth UUIDs. The model cleanly separates computed progress from user intent.

### `src/core/progress.ts`

Movies are binary: any watched row means `finished`. Series/anime compare watched row count against cached `totalEpisodes`. Ongoing titles become `caught_up` when watched count reaches available count; ended titles become `finished`. Unreleased titles override watch data and remain `unreleased`.

### `src/core/tracking.ts`

`markWatched` auto-creates an active tracked-media row when absent, resets paused/watch-later to active when watched, increments per-episode rewatch count, and preserves original watched timestamp on rewatches. `unmarkWatched` decrements or returns null for deletion. `rewatchSeason` applies counts per episode.

### `src/db/schema.ts`

Matches the core tables with composite keys and FK. Important caveat: `$type<T>()` is not a database constraint. If DB-level protection matters, add CHECK constraints later for enum-like text fields and positive rewatch counts/episode numbers where appropriate.

### `src/server/mark-watched.ts`

Uses authenticated `userId`, Zod validation, a single DB transaction, domain core call, upsert for tracked media, and database-side atomic `rewatch_count + 1` on conflicts. This is materially stronger than a read-modify-write-only implementation for concurrent rewatches.

### `src/server/library.ts`

Fetches media and watched rows per authenticated user, groups episodes, adapts rows, then derives progress/effective state in the domain layer. This preserves the “progress is computed” decision.

### Integration tests

`schema.integration.test.ts` verifies real Postgres FK and PK behavior. `mark-watched.integration.test.ts` exercises the exact brand-new title auto-add path against the configured DB. These are valuable but should remain isolated from real user data.

## Risk / Follow-up Register

| Priority | Item | Why it matters | Recommended treatment |
|---|---|---|---|
| High | Dedicated integration-test DB/schema | Real-DB tests can mutate the configured database even with cleanup. | Use separate CI/test credentials or a dedicated schema/project before routine automated runs. |
| High | Provider identity/remapping | TMDB→TVDB per-title switching can invalidate episode-number-based watch mappings. | Design explicit provider IDs and remapping/migration UX in its own metadata phase before enabling switching. |
| Medium | DB CHECK constraints | Typed Drizzle strings do not stop invalid raw SQL/service-role inserts. | Add Postgres CHECK constraints when schema hardening is in scope. |
| Medium | Metadata refresh semantics | `totalEpisodes` changes alter derived progress. | Define refresh provenance, stale metadata behavior, and user-visible recalculation rules in metadata phase. |
| Medium | Production error model | Developer route/server results use generic string errors. | Create stable error codes/messages and UX recovery when replacing diagnostic UI. |
| Medium | RLS/authorization hardening | Server-derived user IDs are good, but Supabase RLS is not shown as the primary enforcement layer in the reviewed schema. | Add RLS when direct Supabase access or broader API surfaces are introduced; keep service-role server-only. |
| Low | Performance for very large libraries | Library currently loads all watched rows then groups in memory. | Keep for now; measure before optimizing. Later consider SQL aggregation/pagination only when real scale proves need. |

## Bottom Line

The implementation is no longer just Phase-1 pure logic: it contains a meaningful Phase-2 web/backend slice with real authentication, Postgres/Drizzle persistence, server-side library operations, and integration tests. The correct path is to continue hardening the tracker service itself, not revive old streaming architecture inside this codebase. The remaining risks are mostly metadata identity/remapping, database hardening/testing isolation, and replacing diagnostic UI with production UX—not a reason to discard the current tracker core.