import { test } from "node:test";
import assert from "node:assert/strict";
import { getSiteOrigin } from "../src/lib/site-url.ts";

test("site URLs fail explicitly rather than silently pointing to another deployment", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  try {
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.throws(getSiteOrigin, /required/);
    for (const value of ["", "not-a-url", "javascript:alert(1)", "https://user:pass@example.com", "https://example.com/path", "https://example.com?query=1", "https://example.com#section"]) {
      process.env.NEXT_PUBLIC_APP_URL = value;
      assert.throws(getSiteOrigin, undefined, value);
    }
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";
    assert.equal(getSiteOrigin(), "https://example.com");
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    assert.equal(getSiteOrigin(), "http://localhost:3000");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});
