# @silverassist/next-script-loader

Singleton, reference-counted third-party script loader for React/Next.js
apps. The shared base for `recaptcha`, and any future lead-form/vendor-script
package, instead of each one hand-rolling its own singleton-script-loading
state machine.

## Why this exists

A single, shared implementation of singleton script loading — configure
once, load with reference counting, switch variants, arbitrate ownership
between competing components — so every vendor-script integration builds on
the same tested base instead of each one maintaining its own copy.

## Install

```bash
npm install @silverassist/next-script-loader
```

## Usage

Each vendor integration should own its own instance — `new ScriptLoader()` —
rather than sharing one across unrelated vendors, so one vendor's `unload()`
never tears down a different vendor's script.

```typescript
import { ScriptLoader } from "@silverassist/next-script-loader";

const leadCaptureLoader = new ScriptLoader();

leadCaptureLoader.configure({
  urls: {
    desktop: "https://cdn.leadcapture.io/GLFT-desktop-token.js",
    mobile: "https://cdn.leadcapture.io/GLFT-mobile-token.js",
  },
});

useEffect(() => {
  leadCaptureLoader.load(isMobile ? "mobile" : "desktop");
  return () => leadCaptureLoader.unload();
}, [isMobile]);
```

Switching variants for a caller that already holds a reference — e.g. a
device-size change — uses `reload()` instead of a fresh `load()`, so the
reference count doesn't drift:

```typescript
useEffect(() => {
  leadCaptureLoader.reload(isMobile ? "mobile" : "desktop");
}, [isMobile]);
```

Ownership arbitration, for when two components might otherwise both try to
drive the same script's lifecycle (e.g. a modal and an on-page form):

```typescript
const claimed = leadCaptureLoader.setOwner("modal-form");
if (claimed) {
  // this component now owns load/unload decisions
}
// on unmount:
leadCaptureLoader.releaseOwnership("modal-form");
```

## API

| Method                 | Behavior                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| `configure(config)`    | Injects `{ urls, onLoad?, onError? }`. Safe to call more than once.      |
| `load(variant)`        | Loads (or joins an in-flight load for) `variant`; increments ref count.  |
| `reload(variant)`      | Swaps the active variant without changing the ref count.                 |
| `unload()`             | Decrements ref count; removes the `<script>` only once it reaches zero.  |
| `reset()`              | Full teardown — script, ref count, owner, and config. For tests.         |
| `setOwner(id)`         | Claims ownership if unowned or already owned by `id`. Returns `boolean`. |
| `releaseOwnership(id)` | Releases ownership, only if `id` is the current owner.                   |
| `forceSetOwner(id)`    | Unconditionally overrides the current owner.                             |
| `owner` (getter)       | The current owner id, or `null`.                                         |

`load()`/`reload()` never throw synchronously — every failure path
(unconfigured, no DOM, network/script error) resolves through the returned
promise's rejection, so a caller chaining `.catch()` always catches it.

## Known, accepted gap

Calling `unload()` while the very first `load()` for a script is still in
flight can still fire that load's `onLoad`/`onError` after the fact —
removing a `<script>` element does not reliably cancel its in-flight network
request across browsers. Real callers unload on unmount, well after `load()`
resolves, so this hasn't mattered in practice; revisit with an
`AbortController` if it ever does.

## Status

Published to npm as of 2026-08-30 (`0.1.0`). Wired into `recaptcha` as its
first consumer; not yet piloted in a real site. Uses
`@silverassist/next-testing-toolkit`'s packaging e2e
(builds against the packed tarball) — this package has no React
components, so there's no RSC-boundary contract to protect the way there
is for `icons`/`recaptcha`/`consent-banner`; what the harness confirms
here is that `exports` map resolves correctly.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium   # once
npm run e2e
```

## License

[PolyForm Noncommercial 1.0.0](./LICENSE)

---

Made with ❤️ by Silver Assist
