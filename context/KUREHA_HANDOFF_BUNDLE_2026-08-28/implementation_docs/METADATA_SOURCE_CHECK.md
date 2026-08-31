## One Check Before Closing This Out

You mentioned updating "the auto-create logic in `tracking.ts` to default to `'tmdb'`" — the addendum said not to add any logic branching on `metadataSource`, only to store the field. A default value being set is likely fine, but I want to see the actual change before confirming, not just the description of it.

Paste:

1. The current, complete `markWatched` function from `tracking.ts` (post-change)
2. Confirm: is `metadataSource: 'tmdb'` simply a hardcoded literal in the object being constructed in the auto-create branch (equivalent to how `intent: 'active'` is already hardcoded there), or did you add any conditional/branching logic that reads or checks `metadataSource` anywhere?

If it's just a literal default value sitting in the same object-construction spot as `intent: 'active'` — that's correct and matches the addendum's intent. If there's any `if`/`switch` touching `metadataSource`, that's out of scope for this addendum and should be removed until the actual switching-logic phase.
