import { ScriptLoader } from "@silverassist/script-loader";

/**
 * This page's only job is to import the package from the packed tarball
 * and reference its exports, so `next build` fails loudly if
 * `package.json`'s `exports` map ever points at a file the build didn't
 * actually produce. `new ScriptLoader()` is safe to construct during
 * prerendering (the constructor does no I/O); `.load()` is never called
 * here since that requires a real DOM, which a Server Component render
 * doesn't have.
 */
const loader = new ScriptLoader();

const resolved = {
  ScriptLoader: typeof ScriptLoader,
  instance: typeof loader,
  configure: typeof loader.configure,
  load: typeof loader.load,
  reload: typeof loader.reload,
  unload: typeof loader.unload,
  reset: typeof loader.reset,
  setOwner: typeof loader.setOwner,
  releaseOwnership: typeof loader.releaseOwnership,
  forceSetOwner: typeof loader.forceSetOwner,
  owner: loader.owner,
};

export default function Page() {
  return (
    <main>
      <h1>@silverassist/script-loader fixture</h1>
      <pre>{JSON.stringify(resolved, null, 2)}</pre>
    </main>
  );
}
