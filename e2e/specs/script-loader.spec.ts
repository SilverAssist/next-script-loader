/**
 * Integration spec for @silverassist/next-script-loader consumed by a real
 * Next app.
 *
 * The fixture installs the *packed tarball*, so this runs against exactly
 * what npm would publish. This package has no React components, so there
 * is no client-boundary contract to protect the way there is for
 * icons/recaptcha/consent-banner -- what matters here is that the
 * package's single export resolves to a real class from the packed
 * output, not `undefined`.
 */
import { expect, test } from "@playwright/test";

test("resolves from a Server Component page against the packed tarball", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("@silverassist/next-script-loader fixture");

  const resolved = JSON.parse((await page.locator("pre").textContent()) ?? "{}");

  expect(resolved.ScriptLoader).toBe("function");
  expect(resolved.instance).toBe("object");
  for (const method of [
    "configure",
    "load",
    "reload",
    "unload",
    "reset",
    "setOwner",
    "releaseOwnership",
    "forceSetOwner",
  ]) {
    expect(resolved[method]).toBe("function");
  }
  expect(resolved.owner).toBeNull();
});
