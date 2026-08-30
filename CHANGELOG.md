# Changelog

## 0.1.0 (2026-08-30)

Initial release. `ScriptLoader`: singleton, reference-counted third-party
script loading with variant switching (`reload()`) and ownership arbitration
(`setOwner`/`releaseOwnership`/`forceSetOwner`), generalized from
`leadcapture-io`'s production `ScriptManager` API.
