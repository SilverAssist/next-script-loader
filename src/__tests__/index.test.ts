/**
 * @jest-environment jsdom
 */
import { ScriptLoader, type ScriptLoaderConfig } from "../index";

const CONFIG: ScriptLoaderConfig = {
  urls: {
    desktop: "https://cdn.example.com/desktop.js",
    mobile: "https://cdn.example.com/mobile.js",
  },
};

/** Grabs the most recently appended <script> and fires its onload handler. */
function resolveScript(src: string) {
  const script = document.head.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  script?.onload?.(new Event("load"));
}

/** Grabs the most recently appended <script> and fires its onerror handler. */
function failScript(src: string) {
  const script = document.head.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  script?.onerror?.(new Event("error"));
}

describe("ScriptLoader.load", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("throws when load() is called before configure()", async () => {
    const loader = new ScriptLoader();
    await expect(loader.load("desktop")).rejects.toThrow(/configure\(\) must be called/);
  });

  it("rejects for an unconfigured variant", async () => {
    const loader = new ScriptLoader();
    loader.configure(CONFIG);
    await expect(loader.load("tablet")).rejects.toThrow(/No URL configured for variant "tablet"/);
  });

  it("appends exactly one <script> tag with the configured URL", async () => {
    const loader = new ScriptLoader();
    loader.configure(CONFIG);

    const pending = loader.load("desktop");
    resolveScript(CONFIG.urls.desktop);
    await pending;

    const scripts = document.head.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(CONFIG.urls.desktop);
  });

  it("concurrent load() calls for the same variant share one script and one promise", async () => {
    const loader = new ScriptLoader();
    loader.configure(CONFIG);

    const first = loader.load("desktop");
    const second = loader.load("desktop");
    resolveScript(CONFIG.urls.desktop);
    await Promise.all([first, second]);

    expect(document.head.querySelectorAll("script")).toHaveLength(1);
  });

  it("calls the configured onLoad callback exactly once", async () => {
    const onLoad = jest.fn();
    const loader = new ScriptLoader();
    loader.configure({ ...CONFIG, onLoad });

    const pending = loader.load("desktop");
    resolveScript(CONFIG.urls.desktop);
    await pending;

    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("rejects and calls onError when the script fails, and removes the failed tag", async () => {
    const onError = jest.fn();
    const loader = new ScriptLoader();
    loader.configure({ ...CONFIG, onError });

    const pending = loader.load("desktop");
    failScript(CONFIG.urls.desktop);

    await expect(pending).rejects.toThrow(/Failed to load script for variant "desktop"/);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });

  it("allows retrying after a failed load", async () => {
    const loader = new ScriptLoader();
    loader.configure(CONFIG);

    const failed = loader.load("desktop");
    failScript(CONFIG.urls.desktop);
    await expect(failed).rejects.toThrow();

    const retried = loader.load("desktop");
    resolveScript(CONFIG.urls.desktop);
    await expect(retried).resolves.toBeUndefined();
  });
});

describe("ScriptLoader ref counting", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("keeps the script until the reference count reaches zero", async () => {
    const loader = new ScriptLoader();
    loader.configure(CONFIG);

    const first = loader.load("desktop");
    resolveScript(CONFIG.urls.desktop);
    await first;
    await loader.load("desktop"); // second reference, already loaded — resolves immediately

    loader.unload(); // 2 -> 1
    expect(document.head.querySelectorAll("script")).toHaveLength(1);

    loader.unload(); // 1 -> 0
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });

  it("unload() is a no-op when the reference count is already zero", () => {
    const loader = new ScriptLoader();
    loader.configure(CONFIG);
    expect(() => loader.unload()).not.toThrow();
  });

  it("reload() swaps the active variant without changing the reference count", async () => {
    const loader = new ScriptLoader();
    loader.configure(CONFIG);

    const first = loader.load("desktop");
    resolveScript(CONFIG.urls.desktop);
    await first;

    const switched = loader.reload("mobile");
    resolveScript(CONFIG.urls.mobile);
    await switched;

    expect(document.head.querySelectorAll("script")).toHaveLength(1);
    expect(document.head.querySelector("script")?.src).toBe(CONFIG.urls.mobile);

    // A single unload() should bring the (still-one) reference to zero —
    // proving reload() didn't add a second reference.
    loader.unload();
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });
});

describe("ScriptLoader.reset", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("clears the script, reference count, owner, and config", async () => {
    const loader = new ScriptLoader();
    loader.configure(CONFIG);
    loader.setOwner("component-a");

    const pending = loader.load("desktop");
    resolveScript(CONFIG.urls.desktop);
    await pending;

    loader.reset();

    expect(document.head.querySelectorAll("script")).toHaveLength(0);
    expect(loader.owner).toBeNull();
    await expect(loader.load("desktop")).rejects.toThrow(/configure\(\) must be called/);
  });
});

describe("ScriptLoader ownership arbitration", () => {
  it("grants ownership to the first claimant", () => {
    const loader = new ScriptLoader();
    expect(loader.setOwner("component-a")).toBe(true);
    expect(loader.owner).toBe("component-a");
  });

  it("is idempotent for the current owner", () => {
    const loader = new ScriptLoader();
    loader.setOwner("component-a");
    expect(loader.setOwner("component-a")).toBe(true);
  });

  it("refuses a different claimant while owned", () => {
    const loader = new ScriptLoader();
    loader.setOwner("component-a");
    expect(loader.setOwner("component-b")).toBe(false);
    expect(loader.owner).toBe("component-a");
  });

  it("releaseOwnership only clears the owner that matches", () => {
    const loader = new ScriptLoader();
    loader.setOwner("component-a");
    loader.releaseOwnership("component-b"); // not the owner — no-op
    expect(loader.owner).toBe("component-a");

    loader.releaseOwnership("component-a");
    expect(loader.owner).toBeNull();
  });

  it("forceSetOwner overrides unconditionally", () => {
    const loader = new ScriptLoader();
    loader.setOwner("component-a");
    loader.forceSetOwner("component-b");
    expect(loader.owner).toBe("component-b");
  });

  it("allows a new claimant once ownership is released", () => {
    const loader = new ScriptLoader();
    loader.setOwner("component-a");
    loader.releaseOwnership("component-a");
    expect(loader.setOwner("component-b")).toBe(true);
  });
});
