/**
 * @jest-environment node
 *
 * Separate from index.test.ts (which runs under jsdom, where `document`
 * always exists): this is the one branch that genuinely needs no DOM to
 * exercise — e.g. a `ScriptLoader` instance accidentally imported into
 * server-side code.
 */
import { ScriptLoader } from "../index";

it("rejects with a clear error when there is no DOM", async () => {
  const loader = new ScriptLoader();
  loader.configure({ urls: { desktop: "https://cdn.example.com/desktop.js" } });

  await expect(loader.load("desktop")).rejects.toThrow(/requires a DOM \(browser\) environment/);
});
