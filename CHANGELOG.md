# Changelog

## 0.1.1 (Unreleased)

### Fixed

- `reload()` had no re-entrancy protection: two calls for the same variant
  in quick succession (before the first's script finished loading) tore
  down and recreated the script twice. Since removing a `<script>` element
  doesn't reliably cancel its in-flight network request, both the
  superseded and the current script could go on to execute and each apply
  their side effects — the concrete case that surfaced this was
  `@silverassist/leadcapture-form`'s remount-detection effect double-firing
  under React Strict Mode's dev-only effect replay, rendering its widget
  twice. `reload()` now shares the in-flight promise for a same-variant
  call already in progress, the same way `load()` already did.

### Added

- `getGeneration()` and an optional `unload(atGeneration?)` parameter:
  a monotonically increasing counter, bumped on every `load()`/`reload()`
  call, that a delayed unmount cleanup can capture and pass back to
  `unload()` to detect it's been superseded by a newer mount and skip
  itself entirely (including the reference-count decrement). Generalizes
  the hand-rolled generation guard `leadcapture-form` carried since 0.1.0,
  needed because `reload()` doesn't change the reference count.

## 0.1.0 (2026-08-30)

Initial release. `ScriptLoader`: singleton, reference-counted third-party
script loading with variant switching (`reload()`) and ownership arbitration
(`setOwner`/`releaseOwnership`/`forceSetOwner`), generalized from
`leadcapture-io`'s production `ScriptManager` API.
