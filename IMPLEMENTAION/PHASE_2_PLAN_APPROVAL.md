## Plan Approved — With One Prerequisite Added Before Step 1

This is a good plan. Both things you flagged that weren't in the original spec — the CommonJS→ESM requirement and the stale `VITE_SUPABASE_*` keys — were real catches, and I appreciate you surfacing them instead of quietly working around them.

### Open Questions — Answers

1. **Timestamp storage**: Approved — keep `integer()`, matching Phase 1's contract exactly. Your reasoning is correct: Phase 1's functions produce/consume plain numbers, not `Date` objects, so `timestamp()` would only add unnecessary adapter-layer conversion for no real benefit right now.

2. **Seed titles**: Pick any 2-3 well-known titles yourself — this phase is a pure wiring proof, the specific titles don't matter. Just make sure at least one is a movie and at least one is a series with multiple episodes, so the "mark watched" flow gets exercised against both of Phase 1's distinct code paths (movie binary-watch vs. series episode-count math).

3. **`.env` cleanup**: Approved. Remove the stale Supabase keys from the deleted project, drop the `VITE_` prefix on the new ones since TanStack Start server functions don't need client-side exposure, leave TMDB/TVDB/Fanart keys untouched.

---

### New Prerequisite — Git Hygiene Check (Do This Before Step 1)

Your plan correctly notes that `.gitignore` doesn't exist yet and must be created before any commit in this phase. That raises a real question that needs answering before we proceed: **if `.gitignore` never existed, was `node_modules/` — or worse, an earlier version of `.env` — already committed to git during Phase 1?**

This matters because Phase 1 had no real secrets (no Supabase project existed yet), so it wasn't a live risk at the time. This phase introduces actual Supabase keys into `.env`. If an old `.env` or `node_modules` is already sitting in git history, adding `.gitignore` now only stops *future* commits from including them — it doesn't remove what's already there.

**Before Step 1, run and report back:**

```bash
git log --all --full-history -- .env
git log --all --full-history --name-only | grep -i node_modules | head -20
```

- **If `.env` shows up in git history at all** (even an old, now-stale version): stop and tell me before doing anything else. Depending on what it contained, this may need history rewriting (e.g. `git filter-repo` or BFG Repo-Cleaner) rather than just a fresh commit — and if any real key was ever pushed to a remote, that key should be considered compromised and rotated regardless of what we do to local history.
- **If `node_modules/` is tracked**: this isn't a security issue, just repo bloat — fine to simply `git rm -r --cached node_modules` in the same commit that adds `.gitignore`.
- **If neither shows up**: good, proceed with `.gitignore` creation as planned, no further action needed.

### `.gitignore` Contents

Once the check above is clear, create `.gitignore` with at minimum:

```
node_modules/
dist/
.vinxi/
drizzle/
.env
.env.local
.env.*.local
*.log
.DS_Store
```

Note `drizzle/` is included per your plan (migration output) — confirm that's intentional (generated migrations are often committed so the team/history has a record of schema changes over time, which is usually *desired*, not ignored). If your intent was to ignore Drizzle's local metadata/cache rather than the actual migration SQL files, clarify that distinction in the `.gitignore` comment so it's not accidentally hiding real migration history. My default lean: **commit migration SQL files, ignore only Drizzle's local cache/lock artifacts if any exist** — schema migration history is valuable to keep, not just build output.

---

### Proceed

Once the git history check is reported clean (or cleaned up if needed) and `.gitignore` is in place, proceed with Steps 1–8 exactly as planned. Confirm at each of your three proposed checkpoints (schema+FK verification, auth wiring, full end-to-end) before moving to the next — same as we did throughout Phase 1, show me actual output/code at each checkpoint, not just a summary that it worked.
