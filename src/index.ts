/**
 * @silverassist/script-loader
 *
 * Singleton, reference-counted third-party script loader for React/Next.js
 * apps.
 *
 * Generalizes a pattern that already exists twice in production, built
 * independently each time: `leadcapture-io`'s `ScriptManager` (singleton
 * script lifecycle, ref-counted load/unload, variant switching, ownership
 * arbitration between competing components — see
 * `nextjs-boilerplate/docs/LEAD_FORM_PROVIDERS.md`) and `@silverassist/recaptcha`'s
 * hand-rolled `loadRecaptchaScript()` (global `window.__recaptchaLoaded` /
 * `__recaptchaLoading` / `__recaptchaCallbacks` flags solving the exact same
 * "load once, queue callbacks while loading" problem with none of the code
 * shared). This package is the one implementation both should build on,
 * instead of a third vendor integration reinventing it a third time.
 *
 * @packageDocumentation
 */

/** Injected script-loader configuration. */
export interface ScriptLoaderConfig {
  /** Maps a variant key (e.g. a form token, a site key) to its script URL. */
  urls: Record<string, string>;
  /** Called once, the first time a script finishes loading successfully. */
  onLoad?: () => void;
  /** Called whenever a script fails to load. */
  onError?: (error: Error) => void;
}

/**
 * Loads a third-party `<script>` tag with singleton, reference-counted
 * lifecycle management. Each vendor integration should own its own
 * instance — `new ScriptLoader()` — rather than sharing one across
 * unrelated vendors, so one vendor's script never gets torn down by
 * another's `unload()`.
 *
 * @example
 * ```typescript
 * const loader = new ScriptLoader();
 * loader.configure({
 *   urls: { desktop: "https://cdn.example.com/desktop.js", mobile: "https://cdn.example.com/mobile.js" },
 * });
 *
 * useEffect(() => {
 *   loader.load("desktop");
 *   return () => loader.unload();
 * }, []);
 * ```
 */
export class ScriptLoader {
  #config: ScriptLoaderConfig | null = null;
  #scriptElement: HTMLScriptElement | null = null;
  #currentVariant: string | null = null;
  #loadingPromise: Promise<void> | null = null;
  #refCount = 0;
  #owner: string | null = null;

  /**
   * Injects this loader's configuration. Safe to call more than once (e.g.
   * in tests, or if a variant's URL changes at runtime) — the new config
   * takes effect on the next {@link load}/{@link reload} call; it does not
   * retroactively affect a script already loaded.
   */
  configure(config: ScriptLoaderConfig): void {
    this.#config = config;
  }

  /**
   * Loads the script for `variant`, incrementing the reference count.
   * Concurrent calls for the same variant while it's already loading share
   * the same in-flight promise rather than injecting a second `<script>`
   * tag. Calling with a different variant than the one currently loaded or
   * loading tears down the previous script first — this is the same
   * teardown {@link reload} performs, just also counted as a new reference;
   * prefer {@link reload} when a caller that already holds a reference is
   * switching variants, so the reference count doesn't drift.
   *
   * @param variant - Key into the configured `urls` map
   * @returns Resolves once the script has loaded; rejects if the variant is
   * unconfigured, the environment has no DOM, or the script fails to load
   */
  load(variant: string): Promise<void> {
    this.#refCount += 1;
    return this.#ensureLoaded(variant);
  }

  /**
   * Swaps the active script to `variant` without changing the reference
   * count — for a caller that already holds a reference (from an earlier
   * {@link load} call) and needs to switch which variant is active, e.g. a
   * device-size change swapping a desktop token for a mobile one.
   *
   * @param variant - Key into the configured `urls` map
   */
  reload(variant: string): Promise<void> {
    this.#teardownScript();
    return this.#ensureLoaded(variant);
  }

  /**
   * Releases one reference. The script is only removed from the DOM once
   * the reference count reaches zero, so a script shared by multiple
   * mounted components stays loaded until the last one unmounts.
   *
   * Not safe to call while the very first {@link load} for a script is
   * still in flight: the in-flight `<script>`'s `onload`/`onerror` handlers
   * still fire even after this tears down the element (removing a `<script>`
   * does not reliably cancel its in-flight network request across
   * browsers), so `onLoad`/`onError` can still fire once for a load that
   * was already unloaded. This is a known, accepted gap for v1 — real
   * callers unload on unmount, well after load resolves.
   */
  unload(): void {
    if (this.#refCount === 0) return;
    this.#refCount -= 1;
    if (this.#refCount === 0) {
      this.#teardownScript();
    }
  }

  /**
   * Full teardown: removes the script element, clears the reference count,
   * the owner, and the injected config. For tests — a real app should never
   * need this, since `unload()` already tears down at zero references.
   */
  reset(): void {
    this.#teardownScript();
    this.#refCount = 0;
    this.#owner = null;
    this.#config = null;
  }

  /**
   * Claims ownership for `id` if no other id currently owns this loader —
   * arbitrates between multiple components that might otherwise fight over
   * the same script (e.g. a modal and an on-page form both wanting to drive
   * load/unload). Idempotent for the current owner.
   *
   * @returns `true` if `id` now owns this loader (was unowned or already
   * owned by `id`), `false` if a different id already owns it
   */
  setOwner(id: string): boolean {
    if (this.#owner === null || this.#owner === id) {
      this.#owner = id;
      return true;
    }
    return false;
  }

  /** Releases ownership, but only if `id` is the current owner. */
  releaseOwnership(id: string): void {
    if (this.#owner === id) {
      this.#owner = null;
    }
  }

  /** Unconditionally overrides the current owner, whoever it is. */
  forceSetOwner(id: string): void {
    this.#owner = id;
  }

  /** The current owner id, or `null` if unowned. */
  get owner(): string | null {
    return this.#owner;
  }

  #ensureLoaded(variant: string): Promise<void> {
    if (this.#currentVariant === variant) {
      if (this.#loadingPromise) return this.#loadingPromise;
      if (this.#scriptElement) return Promise.resolve();
    }

    // `load()`/`reload()` must always communicate failure through the
    // returned promise, never a synchronous throw — a caller chaining
    // `.catch()` on the result would not catch a throw raised before any
    // promise is returned.
    let config: ScriptLoaderConfig;
    try {
      config = this.#getConfig();
    } catch (error) {
      return Promise.reject(error);
    }

    const url = config.urls[variant];
    if (!url) {
      return Promise.reject(
        new Error(`[ScriptLoader] No URL configured for variant "${variant}".`),
      );
    }

    if (this.#currentVariant !== variant) {
      this.#teardownScript();
    }
    this.#currentVariant = variant;

    this.#loadingPromise = new Promise<void>((resolve, reject) => {
      if (typeof document === "undefined") {
        reject(new Error("[ScriptLoader] load() requires a DOM (browser) environment."));
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = true;

      script.onload = () => {
        this.#loadingPromise = null;
        config.onLoad?.();
        resolve();
      };

      script.onerror = () => {
        script.remove();
        if (this.#scriptElement === script) {
          this.#scriptElement = null;
          this.#currentVariant = null;
        }
        this.#loadingPromise = null;
        const error = new Error(`[ScriptLoader] Failed to load script for variant "${variant}".`);
        config.onError?.(error);
        reject(error);
      };

      this.#scriptElement = script;
      document.head.appendChild(script);
    });

    return this.#loadingPromise;
  }

  #teardownScript(): void {
    this.#scriptElement?.remove();
    this.#scriptElement = null;
    this.#currentVariant = null;
    this.#loadingPromise = null;
  }

  #getConfig(): ScriptLoaderConfig {
    if (!this.#config) {
      throw new Error("[ScriptLoader] configure() must be called before load()/reload().");
    }
    return this.#config;
  }
}
